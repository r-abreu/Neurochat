require('dotenv').config();
const Imap = require('imap');
const { simpleParser } = require('mailparser');
const { v4: uuidv4 } = require('uuid');

// In-memory storage for now (replace with actual database calls)
let emailLogs = [];
let tickets = [];
let messages = [];

/**
 * Extract ticket ID from email subject
 * @param {string} subject - Email subject
 * @returns {number|null} Ticket ID or null if not found
 */
function extractTicketId(subject) {
  const match = subject.match(/Ticket\s+#(\d+)/i);
  return match ? parseInt(match[1], 10) : null;
}

/**
 * Process incoming email and add to ticket conversation
 * @param {string} body - Email body text
 * @param {string} subject - Email subject
 * @param {string} fromEmail - Sender email address
 * @param {string} messageId - Email message ID
 * @returns {Promise<object>} Processing result
 */
async function processIncomingEmail(body, subject, fromEmail, messageId) {
  try {
    console.log(`📧 Processing email from ${fromEmail} with subject: ${subject}`);
    
    const ticketId = extractTicketId(subject);
    if (!ticketId) {
      console.log('❌ No ticket ID found in subject');
      
      // Log as unprocessable email
      const errorLog = {
        id: uuidv4(),
        type: 'incoming',
        direction: 'from_customer',
        ticket_id: null,
        sender: fromEmail,
        recipient: null,
        subject,
        content: body,
        status: 'unprocessable',
        error_message: 'No ticket ID found in subject',
        message_id: messageId,
        timestamp: new Date().toISOString(),
      };
      emailLogs.push(errorLog);
      
      return {
        success: false,
        reason: 'no_ticket_id',
        message: 'No ticket ID found in email subject'
      };
    }

    // Find the ticket (in real implementation, query database)
    const ticket = tickets.find(t => t.id === ticketId.toString() && t.customer_email === fromEmail);
    
    if (!ticket) {
      console.log(`❌ Ticket #${ticketId} not found or email mismatch`);
      
      // Log as unauthorized email
      const errorLog = {
        id: uuidv4(),
        type: 'incoming',
        direction: 'from_customer',
        ticket_id: ticketId,
        sender: fromEmail,
        recipient: null,
        subject,
        content: body,
        status: 'unauthorized',
        error_message: 'Ticket not found or email mismatch',
        message_id: messageId,
        timestamp: new Date().toISOString(),
      };
      emailLogs.push(errorLog);
      
      return {
        success: false,
        reason: 'ticket_not_found',
        message: 'Ticket not found or unauthorized'
      };
    }

    // Clean up the email body (remove quoted text, signatures, etc.)
    const cleanedBody = cleanEmailBody(body);

    // Add message to conversation
    const newMessage = {
      id: uuidv4(),
      ticketId: ticketId.toString(),
      senderId: ticket.customer_id,
      content: cleanedBody,
      messageType: 'text',
      isAnonymous: false,
      senderName: null,
      createdAt: new Date().toISOString(),
      source: 'email'
    };

    messages.push(newMessage);
    console.log(`✅ Added message to ticket #${ticketId}`);

    // Auto-reopen ticket if closed or resolved
    const wasReopened = autoReopenTicket(ticket);

    // Log successful email processing
    const emailLog = {
      id: uuidv4(),
      type: 'incoming',
      direction: 'from_customer',
      ticket_id: ticketId,
      sender: fromEmail,
      recipient: null,
      subject,
      content: cleanedBody,
      status: 'processed',
      error_message: null,
      message_id: messageId,
      timestamp: new Date().toISOString(),
    };
    emailLogs.push(emailLog);

    // Notify agent if online (in real implementation, use WebSocket)
    await notifyAgentOfReply(ticket, newMessage);

    console.log(`✅ Processed reply for Ticket #${ticketId}${wasReopened ? ' (reopened)' : ''}`);
    
    return {
      success: true,
      ticketId,
      messageId: newMessage.id,
      wasReopened,
      message: 'Email processed successfully'
    };

  } catch (error) {
    console.error('❌ Error processing email:', error);
    
    // Log processing error
    const errorLog = {
      id: uuidv4(),
      type: 'error',
      direction: 'from_customer',
      ticket_id: extractTicketId(subject),
      sender: fromEmail,
      recipient: null,
      subject,
      content: body,
      status: 'error',
      error_message: error.message,
      message_id: messageId,
      timestamp: new Date().toISOString(),
    };
    emailLogs.push(errorLog);
    
    return {
      success: false,
      reason: 'processing_error',
      message: error.message
    };
  }
}

/**
 * Clean email body by removing quoted text and signatures
 * @param {string} body - Raw email body
 * @returns {string} Cleaned email body
 */
function cleanEmailBody(body) {
  if (!body) return '';

  // Remove quoted text (lines starting with >)
  let lines = body.split('\n');
  let cleanLines = [];
  
  for (let line of lines) {
    // Stop at common quote indicators
    if (line.trim().startsWith('>') || 
        line.includes('On ') && line.includes('wrote:') ||
        line.includes('From:') && line.includes('Sent:') ||
        line.includes('-----Original Message-----')) {
      break;
    }
    cleanLines.push(line);
  }
  
  let cleaned = cleanLines.join('\n').trim();
  
  // Remove common email signatures
  const signatureMarkers = ['--', '___', 'Best regards', 'Sent from my', 'This email was sent'];
  for (let marker of signatureMarkers) {
    const index = cleaned.lastIndexOf(marker);
    if (index > 0 && index > cleaned.length * 0.7) { // Only if near the end
      cleaned = cleaned.substring(0, index).trim();
    }
  }
  
  return cleaned;
}

/**
 * Auto-reopen ticket if it was closed or resolved
 * @param {object} ticket - Ticket object
 * @returns {boolean} True if ticket was reopened
 */
function autoReopenTicket(ticket) {
  if (ticket.status === 'closed' || ticket.status === 'resolved') {
    ticket.status = 'reopened';
    ticket.updated_at = new Date().toISOString();
    console.log(`🔄 Auto-reopened ticket #${ticket.id}`);
    return true;
  }
  return false;
}

/**
 * Notify agent of customer reply
 * @param {object} ticket - Ticket object
 * @param {object} message - New message object
 */
async function notifyAgentOfReply(ticket, message) {
  try {
    // In real implementation, this would:
    // 1. Send WebSocket notification to online agent
    // 2. Send push notification to mobile app
    // 3. Send email notification if agent is offline
    
    console.log(`🔔 Notifying agent of reply on ticket #${ticket.id}`);
    
    // For now, just log the notification
    console.log(`Agent notification: New customer reply on ticket #${ticket.id}`);
    
  } catch (error) {
    console.error('❌ Error notifying agent:', error);
  }
}

/**
 * Initialize IMAP connection and start monitoring
 * @returns {object} IMAP connection object
 */
function initializeEmailReceiver() {
  const imap = new Imap({
    user: process.env.IMAP_USER,
    password: process.env.IMAP_PASSWORD,
    host: process.env.IMAP_HOST || 'outlook.office365.com',
    port: parseInt(process.env.IMAP_PORT) || 993,
    tls: true,
    tlsOptions: {
      rejectUnauthorized: false
    }
  });

  imap.once('ready', () => {
    console.log('📧 IMAP connection ready, monitoring inbox...');
    
    imap.openBox('INBOX', false, (err, box) => {
      if (err) {
        console.error('❌ Error opening inbox:', err);
        return;
      }
      
      console.log(`📬 Inbox opened, ${box.messages.total} total messages`);
      
      // Process unread emails
      processUnreadEmails(imap);
      
      // Set up real-time monitoring for new emails
      imap.on('mail', (numNewMsgs) => {
        console.log(`📨 ${numNewMsgs} new email(s) received`);
        processUnreadEmails(imap);
      });
    });
  });

  imap.once('error', (err) => {
    console.error('❌ IMAP connection error:', err);
  });

  imap.once('end', () => {
    console.log('📧 IMAP connection ended');
  });

  return imap;
}

/**
 * Process all unread emails in the inbox
 * @param {object} imap - IMAP connection object
 */
function processUnreadEmails(imap) {
  imap.search(['UNSEEN'], (err, results) => {
    if (err) {
      console.error('❌ Error searching for unread emails:', err);
      return;
    }
    
    if (!results || results.length === 0) {
      console.log('📭 No unread emails found');
      return;
    }
    
    console.log(`📨 Processing ${results.length} unread email(s)...`);
    
    const fetch = imap.fetch(results, { bodies: '', markSeen: false });
    
    fetch.on('message', (msg, seqno) => {
      console.log(`📧 Processing email #${seqno}`);
      
      msg.on('body', (stream, info) => {
        simpleParser(stream, async (err, parsed) => {
          if (err) {
            console.error('❌ Error parsing email:', err);
            return;
          }
          
          const from = parsed.from.value[0].address;
          const subject = parsed.subject || '';
          const body = parsed.text || parsed.html || '';
          const messageId = parsed.messageId || '';
          
          try {
            const result = await processIncomingEmail(body, subject, from, messageId);
            
            if (result.success) {
              // Mark email as read after successful processing
              imap.addFlags(results[seqno - 1], '\\Seen', (err) => {
                if (err) {
                  console.error('❌ Error marking email as read:', err);
                } else {
                  console.log(`✅ Email #${seqno} marked as read`);
                }
              });
            }
            
          } catch (error) {
            console.error('❌ Error processing email:', error);
          }
        });
      });
      
      msg.once('attributes', (attrs) => {
        console.log(`📧 Email #${seqno} attributes:`, {
          uid: attrs.uid,
          flags: attrs.flags,
          date: attrs.date
        });
      });
      
      msg.once('end', () => {
        console.log(`✅ Finished processing email #${seqno}`);
      });
    });
    
    fetch.once('error', (err) => {
      console.error('❌ Error fetching emails:', err);
    });
    
    fetch.once('end', () => {
      console.log('✅ Finished processing all unread emails');
    });
  });
}

/**
 * Start the email receiver service
 */
function startEmailReceiver() {
  console.log('🚀 Starting email receiver service...');
  
  // Validate required environment variables
  const requiredVars = ['IMAP_USER', 'IMAP_PASSWORD'];
  const missing = requiredVars.filter(varName => !process.env[varName]);
  
  if (missing.length > 0) {
    console.error(`❌ Missing required environment variables: ${missing.join(', ')}`);
    return null;
  }
  
  const imap = initializeEmailReceiver();
  
  // Connect to IMAP server
  imap.connect();
  
  return imap;
}

/**
 * Stop the email receiver service
 * @param {object} imap - IMAP connection object
 */
function stopEmailReceiver(imap) {
  if (imap) {
    console.log('🛑 Stopping email receiver service...');
    imap.end();
  }
}

module.exports = {
  processIncomingEmail,
  extractTicketId,
  cleanEmailBody,
  autoReopenTicket,
  startEmailReceiver,
  stopEmailReceiver,
  initializeEmailReceiver,
  processUnreadEmails,
  emailLogs, // Export for audit trail access
  
  // Setters for in-memory data (for testing/integration)
  setTickets: (newTickets) => { tickets = newTickets; },
  setMessages: (newMessages) => { messages = newMessages; },
  getMessages: () => messages
}; 
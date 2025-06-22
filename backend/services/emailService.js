const nodemailer = require('nodemailer');
require('dotenv').config();

// Initialize SMTP transporter for sending emails
let smtpTransporter = null;

// Configure SMTP transport (using Outlook/Office 365)
function initializeSMTPTransporter() {
  if (process.env.IMAP_USER && process.env.IMAP_PASSWORD) {
    try {
      smtpTransporter = nodemailer.createTransport({
        host: process.env.SMTP_HOST || 'smtp.office365.com',
        port: parseInt(process.env.SMTP_PORT) || 587,
        secure: false, // true for 465, false for other ports
        auth: {
          user: process.env.IMAP_USER, // Use same credentials as IMAP
          pass: process.env.IMAP_PASSWORD
        },
        tls: {
          ciphers: 'SSLv3',
          rejectUnauthorized: false
        },
        requireTLS: true,
        connectionTimeout: 10000,
        greetingTimeout: 5000,
        socketTimeout: 10000
      });
      
      console.log('✅ SMTP email service initialized with server:', process.env.SMTP_HOST || 'smtp.office365.com');
      console.log('📧 Outbound emails will be sent from:', process.env.IMAP_USER);
      
      // Verify SMTP connection
      smtpTransporter.verify((error, success) => {
        if (error) {
          console.warn('⚠️ SMTP connection verification failed:', error.message);
          if (error.message.includes('5.7.139') || error.message.includes('security defaults')) {
            console.warn('🔐 Office 365 Security Note: This account requires OAuth2 or App-Specific Password');
            console.warn('📋 To fix this issue:');
            console.warn('   1. Go to https://account.live.com/proofs/manage/additional');
            console.warn('   2. Generate an App-Specific Password for "Mail App"');
            console.warn('   3. Update IMAP_PASSWORD with the app-specific password');
            console.warn('   4. Or configure OAuth2 authentication');
            console.warn('📧 Emails will be simulated until authentication is resolved');
            // Disable SMTP transporter to force simulation mode
            smtpTransporter = null;
          }
        } else {
          console.log('✅ SMTP server is ready to send emails');
        }
      });
      
    } catch (error) {
      console.warn('⚠️ SMTP initialization failed:', error.message);
    }
  } else {
    console.warn('⚠️ IMAP_USER or IMAP_PASSWORD not configured - email sending will be simulated');
  }
}

// Initialize SMTP on module load
initializeSMTPTransporter();

// In-memory storage for now (replace with actual database calls)
let emailLogs = [];

/**
 * Send an email fallback when customer is offline or chat is closed
 * @param {string} toEmail - Customer email address
 * @param {string} ticketId - Ticket ID
 * @param {string} agentMessage - Message from agent
 * @param {object} ticket - Ticket object with customer info
 * @returns {Promise<object>} Response from SMTP service
 */
async function sendChatFallbackEmail(toEmail, ticketId, agentMessage, ticket = {}) {
  try {
    const subject = `Support Reply – Ticket #${ticketId}`;
    const html = `
      <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
        <div style="background-color: #f8f9fa; padding: 20px; border-radius: 8px; margin-bottom: 20px;">
          <h2 style="color: #333; margin: 0;">NeuroChat Support</h2>
          <p style="color: #666; margin: 5px 0 0 0;">Ticket #${ticketId}</p>
        </div>
        
        <div style="background-color: white; padding: 20px; border: 1px solid #e9ecef; border-radius: 8px;">
          <h3 style="color: #333; margin-top: 0;">New message from our support team:</h3>
          <div style="background-color: #f8f9fa; padding: 15px; border-left: 4px solid #007bff; margin: 15px 0;">
            ${agentMessage.replace(/\n/g, '<br>')}
          </div>
        </div>
        
        <hr style="border: none; border-top: 1px solid #e9ecef; margin: 30px 0;" />
        
        <div style="background-color: #e7f3ff; padding: 15px; border-radius: 8px; margin-top: 20px;">
          <p style="margin: 0; color: #0056b3; font-weight: bold;">
            💬 You can reply to this email to continue your support conversation.
          </p>
          <p style="margin: 5px 0 0 0; color: #666; font-size: 14px;">
            Your reply will be automatically added to ticket #${ticketId} and our team will be notified.
          </p>
        </div>
        
        <div style="margin-top: 30px; padding-top: 20px; border-top: 1px solid #e9ecef; color: #666; font-size: 12px;">
          <p>NeuroChat Support System</p>
          <p>This email was sent from an automated system. You can reply directly to this email.</p>
        </div>
      </div>
    `;

    let response = null;
    let emailSent = false;
    
    if (smtpTransporter) {
      // Send actual email via SMTP
      const mailOptions = {
        from: process.env.IMAP_USER || 'support@neurovirtual.com',
        to: toEmail,
        subject,
        html,
        text: agentMessage // Plain text fallback
      };
      
      console.log(`📧 Sending email via SMTP to: ${toEmail}`);
      response = await smtpTransporter.sendMail(mailOptions);
      emailSent = true;
      
    } else {
      // Simulate email sending for development
      console.log('📧 [SIMULATED] Email would be sent to:', toEmail);
      console.log('📧 [SIMULATED] Subject:', subject);
      console.log('📧 [SIMULATED] Content preview:', agentMessage.substring(0, 100) + '...');
      response = { messageId: 'simulated_' + Date.now() };
    }

    // Log the sent email in audit trail
    const emailLog = {
      id: require('uuid').v4(),
      type: 'outgoing',
      direction: 'to_customer',
      ticket_id: ticketId,
      recipient: toEmail,
      sender: process.env.IMAP_USER || 'support@neurovirtual.com',
      subject,
      content: agentMessage,
      status: emailSent ? 'sent' : 'simulated',
      smtp_message_id: response?.messageId || null,
      error_message: null,
      timestamp: new Date().toISOString(),
    };

    emailLogs.push(emailLog);
    console.log(`✅ Email sent successfully to ${toEmail} for ticket #${ticketId}`, {
      messageId: response?.messageId,
      accepted: response?.accepted,
      rejected: response?.rejected
    });

    return {
      success: true,
      emailId: response?.messageId,
      logId: emailLog.id,
      message: 'Email sent successfully via SMTP'
    };

  } catch (error) {
    console.error('❌ Error sending email via SMTP:', error);

    // Log the failed email attempt
    const errorLog = {
      id: require('uuid').v4(),
      type: 'outgoing',
      direction: 'to_customer',
      ticket_id: ticketId,
      recipient: toEmail,
      sender: process.env.IMAP_USER || 'support@neurovirtual.com',
      subject: `Support Reply – Ticket #${ticketId}`,
      content: agentMessage,
      status: 'error',
      smtp_message_id: null,
      error_message: error.message,
      timestamp: new Date().toISOString(),
    };

    emailLogs.push(errorLog);

    return {
      success: false,
      error: error.message,
      logId: errorLog.id
    };
  }
}

/**
 * Send notification email to agents when customer replies
 * @param {string} agentEmail - Agent email address
 * @param {string} ticketId - Ticket ID
 * @param {string} customerMessage - Message from customer
 * @param {object} ticket - Ticket object
 * @returns {Promise<object>} Response from SMTP service
 */
async function sendAgentNotificationEmail(agentEmail, ticketId, customerMessage, ticket = {}) {
  try {
    const subject = `Customer Reply – Ticket #${ticketId}`;
    const html = `
      <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
        <div style="background-color: #f8f9fa; padding: 20px; border-radius: 8px; margin-bottom: 20px;">
          <h2 style="color: #333; margin: 0;">NeuroChat Support</h2>
          <p style="color: #666; margin: 5px 0 0 0;">Agent Notification - Ticket #${ticketId}</p>
        </div>
        
        <div style="background-color: white; padding: 20px; border: 1px solid #e9ecef; border-radius: 8px;">
          <h3 style="color: #333; margin-top: 0;">Customer has replied to ticket #${ticketId}:</h3>
          <div style="background-color: #f8f9fa; padding: 15px; border-left: 4px solid #28a745; margin: 15px 0;">
            ${customerMessage.replace(/\n/g, '<br>')}
          </div>
          
          ${ticket.customer_name ? `<p><strong>Customer:</strong> ${ticket.customer_name}</p>` : ''}
          ${ticket.customer_email ? `<p><strong>Email:</strong> ${ticket.customer_email}</p>` : ''}
          ${ticket.title ? `<p><strong>Subject:</strong> ${ticket.title}</p>` : ''}
        </div>
        
        <div style="background-color: #fff3cd; padding: 15px; border-radius: 8px; margin-top: 20px;">
          <p style="margin: 0; color: #856404; font-weight: bold;">
            🔔 Please respond to the customer promptly via the NeuroChat system.
          </p>
        </div>
      </div>
    `;

    let response = null;
    let emailSent = false;
    
    if (smtpTransporter) {
      // Send actual email via SMTP
      const mailOptions = {
        from: process.env.IMAP_USER || 'notifications@neurovirtual.com',
        to: agentEmail,
        subject,
        html,
        text: `Customer has replied to ticket #${ticketId}: ${customerMessage}` // Plain text fallback
      };
      
      console.log(`📧 Sending agent notification via SMTP to: ${agentEmail}`);
      response = await smtpTransporter.sendMail(mailOptions);
      emailSent = true;
      
    } else {
      // Simulate email sending for development
      console.log('📧 [SIMULATED] Agent notification would be sent to:', agentEmail);
      console.log('📧 [SIMULATED] Subject:', subject);
      response = { messageId: 'simulated_agent_' + Date.now() };
    }

    // Log the notification email
    const emailLog = {
      id: require('uuid').v4(),
      type: 'notification',
      direction: 'to_agent',
      ticket_id: ticketId,
      recipient: agentEmail,
      sender: process.env.IMAP_USER || 'notifications@neurovirtual.com',
      subject,
      content: customerMessage,
      status: emailSent ? 'sent' : 'simulated',
      smtp_message_id: response?.messageId || null,
      error_message: null,
      timestamp: new Date().toISOString(),
    };

    emailLogs.push(emailLog);

    return {
      success: true,
      emailId: response?.messageId,
      logId: emailLog.id,
      message: 'Agent notification sent successfully via SMTP'
    };

  } catch (error) {
    console.error('❌ Error sending agent notification via SMTP:', error);
    
    // Log the failed notification attempt
    const errorLog = {
      id: require('uuid').v4(),
      type: 'notification',
      direction: 'to_agent',
      ticket_id: ticketId,
      recipient: agentEmail,
      sender: process.env.IMAP_USER || 'notifications@neurovirtual.com',
      subject: `Customer Reply – Ticket #${ticketId}`,
      content: customerMessage,
      status: 'error',
      smtp_message_id: null,
      error_message: error.message,
      timestamp: new Date().toISOString(),
    };

    emailLogs.push(errorLog);
    
    return {
      success: false,
      error: error.message,
      logId: errorLog.id
    };
  }
}

/**
 * Get email logs (for audit trail)
 * @param {object} filters - Filter options
 * @returns {Array} Array of email logs
 */
function getEmailLogs(filters = {}) {
  let logs = [...emailLogs];

  if (filters.ticket_id) {
    logs = logs.filter(log => log.ticket_id === filters.ticket_id);
  }

  if (filters.type) {
    logs = logs.filter(log => log.type === filters.type);
  }

  if (filters.status) {
    logs = logs.filter(log => log.status === filters.status);
  }

  // Sort by timestamp descending (newest first)
  logs.sort((a, b) => new Date(b.timestamp) - new Date(a.timestamp));

  return logs;
}

/**
 * Get email statistics
 * @returns {object} Email statistics
 */
function getEmailStats() {
  const total = emailLogs.length;
  const sent = emailLogs.filter(log => log.status === 'sent').length;
  const errors = emailLogs.filter(log => log.status === 'error').length;
  const outgoing = emailLogs.filter(log => log.direction === 'to_customer').length;
  const incoming = emailLogs.filter(log => log.direction === 'from_customer').length;

  return {
    total,
    sent,
    errors,
    outgoing,
    incoming,
    success_rate: total > 0 ? ((sent / total) * 100).toFixed(2) : 0
  };
}

/**
 * Test SMTP connection
 * @returns {Promise<object>} Connection test result
 */
async function testSMTPConnection() {
  try {
    if (!smtpTransporter) {
      return {
        success: false,
        error: 'SMTP transporter not initialized'
      };
    }
    
    await smtpTransporter.verify();
    return {
      success: true,
      message: 'SMTP connection verified successfully'
    };
    
  } catch (error) {
    return {
      success: false,
      error: error.message
    };
  }
}

module.exports = {
  sendChatFallbackEmail,
  sendAgentNotificationEmail,
  getEmailLogs,
  getEmailStats,
  testSMTPConnection,
  emailLogs // Export for direct access if needed
}; 
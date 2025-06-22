-- ==========================================
-- EMAIL LOGS TABLE - AUDIT TRAIL FOR EMAIL INTERACTIONS
-- ==========================================

-- Drop table if exists (for re-running migration)
IF OBJECT_ID('EmailLogs', 'U') IS NOT NULL
    DROP TABLE EmailLogs;

-- Create EmailLogs table for audit trail
CREATE TABLE EmailLogs (
    email_log_id UNIQUEIDENTIFIER PRIMARY KEY DEFAULT NEWID(),
    
    -- Email type and direction
    email_type NVARCHAR(20) NOT NULL CHECK (email_type IN ('incoming', 'outgoing', 'notification', 'error')),
    direction NVARCHAR(20) NOT NULL CHECK (direction IN ('to_customer', 'from_customer', 'to_agent', 'from_agent')),
    
    -- Ticket reference
    ticket_id UNIQUEIDENTIFIER NULL,
    ticket_number NVARCHAR(20) NULL,
    
    -- Email addresses
    sender_email NVARCHAR(255) NOT NULL,
    recipient_email NVARCHAR(255) NULL,
    
    -- Email content
    subject NVARCHAR(500) NOT NULL,
    email_content NVARCHAR(MAX) NOT NULL,
    
    -- Status and processing
    status NVARCHAR(20) DEFAULT 'pending' CHECK (status IN ('pending', 'sent', 'delivered', 'failed', 'processed', 'unprocessable', 'unauthorized', 'error')),
    error_message NVARCHAR(MAX) NULL,
    
    -- External service tracking
    resend_id NVARCHAR(100) NULL, -- Resend service message ID
    message_id NVARCHAR(255) NULL, -- Email Message-ID header
    
    -- Timestamps
    created_at DATETIME2 DEFAULT GETUTCDATE(),
    sent_at DATETIME2 NULL,
    delivered_at DATETIME2 NULL,
    processed_at DATETIME2 NULL,
    
    -- Metadata
    user_agent NVARCHAR(500) NULL,
    ip_address NVARCHAR(45) NULL,
    
    -- Foreign key constraints
    FOREIGN KEY (ticket_id) REFERENCES Tickets(ticket_id) ON DELETE SET NULL,
    
    -- Indexes for performance
    INDEX IX_EmailLogs_TicketId (ticket_id),
    INDEX IX_EmailLogs_EmailType (email_type),
    INDEX IX_EmailLogs_Direction (direction),
    INDEX IX_EmailLogs_Status (status),
    INDEX IX_EmailLogs_SenderEmail (sender_email),
    INDEX IX_EmailLogs_RecipientEmail (recipient_email),
    INDEX IX_EmailLogs_CreatedAt (created_at),
    INDEX IX_EmailLogs_ResendId (resend_id),
    INDEX IX_EmailLogs_MessageId (message_id),
    INDEX IX_EmailLogs_TicketNumber (ticket_number)
);

-- ==========================================
-- ADD EMAIL TRACKING FIELDS TO TICKETS TABLE
-- ==========================================

-- Add email-related fields to Tickets table if they don't exist
IF NOT EXISTS (SELECT * FROM sys.columns WHERE object_id = OBJECT_ID('Tickets') AND name = 'last_email_sent_at')
BEGIN
    ALTER TABLE Tickets ADD last_email_sent_at DATETIME2 NULL;
END

IF NOT EXISTS (SELECT * FROM sys.columns WHERE object_id = OBJECT_ID('Tickets') AND name = 'email_fallback_enabled')
BEGIN
    ALTER TABLE Tickets ADD email_fallback_enabled BIT DEFAULT 1;
END

IF NOT EXISTS (SELECT * FROM sys.columns WHERE object_id = OBJECT_ID('Tickets') AND name = 'customer_last_seen')
BEGIN
    ALTER TABLE Tickets ADD customer_last_seen DATETIME2 NULL;
END

-- ==========================================
-- CREATE EMAIL STATISTICS VIEW
-- ==========================================

-- Drop view if exists
IF OBJECT_ID('EmailStatistics', 'V') IS NOT NULL
    DROP VIEW EmailStatistics;

-- Create view for email statistics
CREATE VIEW EmailStatistics AS
SELECT 
    -- Overall counts
    COUNT(*) as total_emails,
    COUNT(CASE WHEN email_type = 'outgoing' THEN 1 END) as outgoing_emails,
    COUNT(CASE WHEN email_type = 'incoming' THEN 1 END) as incoming_emails,
    COUNT(CASE WHEN email_type = 'notification' THEN 1 END) as notification_emails,
    COUNT(CASE WHEN email_type = 'error' THEN 1 END) as error_emails,
    
    -- Status counts
    COUNT(CASE WHEN status = 'sent' THEN 1 END) as sent_emails,
    COUNT(CASE WHEN status = 'delivered' THEN 1 END) as delivered_emails,
    COUNT(CASE WHEN status = 'failed' THEN 1 END) as failed_emails,
    COUNT(CASE WHEN status = 'processed' THEN 1 END) as processed_emails,
    COUNT(CASE WHEN status = 'error' THEN 1 END) as error_status_emails,
    
    -- Success rates
    CASE 
        WHEN COUNT(CASE WHEN email_type = 'outgoing' THEN 1 END) > 0 
        THEN CAST(COUNT(CASE WHEN email_type = 'outgoing' AND status = 'sent' THEN 1 END) AS FLOAT) / COUNT(CASE WHEN email_type = 'outgoing' THEN 1 END) * 100
        ELSE 0 
    END as outgoing_success_rate,
    
    CASE 
        WHEN COUNT(CASE WHEN email_type = 'incoming' THEN 1 END) > 0 
        THEN CAST(COUNT(CASE WHEN email_type = 'incoming' AND status = 'processed' THEN 1 END) AS FLOAT) / COUNT(CASE WHEN email_type = 'incoming' THEN 1 END) * 100
        ELSE 0 
    END as incoming_processing_rate,
    
    -- Daily statistics
    COUNT(CASE WHEN created_at >= DATEADD(day, -1, GETUTCDATE()) THEN 1 END) as emails_last_24h,
    COUNT(CASE WHEN created_at >= DATEADD(day, -7, GETUTCDATE()) THEN 1 END) as emails_last_7d,
    COUNT(CASE WHEN created_at >= DATEADD(day, -30, GETUTCDATE()) THEN 1 END) as emails_last_30d
FROM EmailLogs;

-- ==========================================
-- CREATE EMAIL LOGS BY TICKET VIEW
-- ==========================================

-- Drop view if exists
IF OBJECT_ID('EmailLogsByTicket', 'V') IS NOT NULL
    DROP VIEW EmailLogsByTicket;

-- Create view for email logs grouped by ticket
CREATE VIEW EmailLogsByTicket AS
SELECT 
    t.ticket_id,
    t.ticket_number,
    t.title as ticket_title,
    t.customer_email,
    t.status as ticket_status,
    COUNT(el.email_log_id) as total_emails,
    COUNT(CASE WHEN el.email_type = 'outgoing' THEN 1 END) as outgoing_emails,
    COUNT(CASE WHEN el.email_type = 'incoming' THEN 1 END) as incoming_emails,
    MAX(el.created_at) as last_email_at,
    MIN(el.created_at) as first_email_at
FROM Tickets t
LEFT JOIN EmailLogs el ON t.ticket_id = el.ticket_id
GROUP BY t.ticket_id, t.ticket_number, t.title, t.customer_email, t.status;

-- ==========================================
-- CREATE STORED PROCEDURES FOR EMAIL OPERATIONS
-- ==========================================

-- Drop procedures if they exist
IF OBJECT_ID('sp_LogOutgoingEmail', 'P') IS NOT NULL
    DROP PROCEDURE sp_LogOutgoingEmail;

IF OBJECT_ID('sp_LogIncomingEmail', 'P') IS NOT NULL
    DROP PROCEDURE sp_LogIncomingEmail;

-- Stored procedure to log outgoing emails
CREATE PROCEDURE sp_LogOutgoingEmail
    @ticket_id UNIQUEIDENTIFIER,
    @ticket_number NVARCHAR(20),
    @recipient_email NVARCHAR(255),
    @sender_email NVARCHAR(255),
    @subject NVARCHAR(500),
    @content NVARCHAR(MAX),
    @resend_id NVARCHAR(100) = NULL,
    @status NVARCHAR(20) = 'sent',
    @error_message NVARCHAR(MAX) = NULL
AS
BEGIN
    INSERT INTO EmailLogs (
        email_type, direction, ticket_id, ticket_number,
        sender_email, recipient_email, subject, email_content,
        status, error_message, resend_id, sent_at
    )
    VALUES (
        'outgoing', 'to_customer', @ticket_id, @ticket_number,
        @sender_email, @recipient_email, @subject, @content,
        @status, @error_message, @resend_id, 
        CASE WHEN @status = 'sent' THEN GETUTCDATE() ELSE NULL END
    );
    
    -- Update ticket last email sent timestamp
    IF @status = 'sent'
    BEGIN
        UPDATE Tickets 
        SET last_email_sent_at = GETUTCDATE()
        WHERE ticket_id = @ticket_id;
    END
END;

-- Stored procedure to log incoming emails
CREATE PROCEDURE sp_LogIncomingEmail
    @ticket_id UNIQUEIDENTIFIER,
    @ticket_number NVARCHAR(20),
    @sender_email NVARCHAR(255),
    @subject NVARCHAR(500),
    @content NVARCHAR(MAX),
    @message_id NVARCHAR(255) = NULL,
    @status NVARCHAR(20) = 'processed',
    @error_message NVARCHAR(MAX) = NULL
AS
BEGIN
    INSERT INTO EmailLogs (
        email_type, direction, ticket_id, ticket_number,
        sender_email, subject, email_content,
        status, error_message, message_id, processed_at
    )
    VALUES (
        'incoming', 'from_customer', @ticket_id, @ticket_number,
        @sender_email, @subject, @content,
        @status, @error_message, @message_id,
        CASE WHEN @status = 'processed' THEN GETUTCDATE() ELSE NULL END
    );
END;

-- ==========================================
-- PRINT COMPLETION MESSAGE
-- ==========================================

PRINT '✅ Email logs migration completed successfully!';
PRINT '📧 EmailLogs table created with audit trail support';
PRINT '📊 Email statistics views created';
PRINT '🔧 Stored procedures for email logging created';
PRINT '✨ Email system is ready for integration!'; 
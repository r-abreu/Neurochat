-- NeuroChat Ticketing System - Azure SQL Database Schema
-- This schema supports the complete ticketing system with users, tickets, messages, and categories

-- Create database (run separately as admin)
-- CREATE DATABASE NeuroChat;
-- USE NeuroChat;

-- ==========================================
-- 1. USER MANAGEMENT TABLES
-- ==========================================

-- Users table for both customers and agents
CREATE TABLE Users (
    user_id UNIQUEIDENTIFIER PRIMARY KEY DEFAULT NEWID(),
    email NVARCHAR(255) UNIQUE NOT NULL,
    password_hash NVARCHAR(255) NOT NULL,
    first_name NVARCHAR(100) NOT NULL,
    last_name NVARCHAR(100) NOT NULL,
    user_type NVARCHAR(20) NOT NULL CHECK (user_type IN ('customer', 'agent')),
    is_active BIT DEFAULT 1,
    created_at DATETIME2 DEFAULT GETUTCDATE(),
    updated_at DATETIME2 DEFAULT GETUTCDATE(),
    last_login DATETIME2 NULL,
    
    -- Agent-specific fields
    agent_status NVARCHAR(20) DEFAULT 'offline' CHECK (agent_status IN ('online', 'busy', 'offline')),
    max_concurrent_tickets INT DEFAULT 5,
    
    -- Indexes
    INDEX IX_Users_Email (email),
    INDEX IX_Users_UserType (user_type),
    INDEX IX_Users_AgentStatus (agent_status),
    
    -- New columns
    role_id UNIQUEIDENTIFIER NULL,
    CONSTRAINT FK_Users_Role FOREIGN KEY (role_id) REFERENCES Roles(role_id),
    password_reset_token NVARCHAR(255) NULL,
    password_reset_expires DATETIME2 NULL,
    must_change_password BIT DEFAULT 0
);

-- ==========================================
-- 2. TICKET CATEGORIES
-- ==========================================

CREATE TABLE Categories (
    category_id UNIQUEIDENTIFIER PRIMARY KEY DEFAULT NEWID(),
    category_name NVARCHAR(100) UNIQUE NOT NULL,
    description NVARCHAR(500),
    color_code NVARCHAR(7) DEFAULT '#007bff', -- Hex color for UI
    is_active BIT DEFAULT 1,
    created_at DATETIME2 DEFAULT GETUTCDATE(),
    
    INDEX IX_Categories_Name (category_name)
);

-- Insert default categories
INSERT INTO Categories (category_name, description, color_code) VALUES
('Software', 'Software-related issues and bugs', '#28a745'),
('Hardware', 'Hardware problems and maintenance', '#dc3545'),
('Billing', 'Billing and payment inquiries', '#ffc107'),
('Account', 'Account access and management', '#17a2b8'),
('General', 'General inquiries and support', '#6c757d');

-- ==========================================
-- 3. TICKETS TABLE
-- ==========================================

CREATE TABLE Tickets (
    ticket_id UNIQUEIDENTIFIER PRIMARY KEY DEFAULT NEWID(),
    ticket_number AS ('TKT-' + RIGHT('000000' + CAST(ABS(CHECKSUM(NEWID())) % 1000000 AS VARCHAR(6)), 6)) PERSISTED,
    customer_id UNIQUEIDENTIFIER NOT NULL,
    agent_id UNIQUEIDENTIFIER NULL,
    category_id UNIQUEIDENTIFIER NOT NULL,
    
    title NVARCHAR(200) NOT NULL,
    description NVARCHAR(MAX) NOT NULL,
    status NVARCHAR(20) DEFAULT 'new' CHECK (status IN ('new', 'in_progress', 'resolved', 'closed')),
    priority NVARCHAR(10) DEFAULT 'medium' CHECK (priority IN ('low', 'medium', 'high', 'urgent')),
    
    -- Customer information fields
    customer_name NVARCHAR(200) NULL,
    customer_email NVARCHAR(255) NULL,
    customer_phone NVARCHAR(50) NULL,
    customer_company NVARCHAR(200) NULL,
    customer_address NVARCHAR(500) NULL,
    customer_street_address NVARCHAR(500) NULL,
    customer_city NVARCHAR(100) NULL,
    customer_state NVARCHAR(100) NULL,
    customer_zip_code NVARCHAR(20) NULL,
    customer_country NVARCHAR(100) NULL,
    customer_type NVARCHAR(20) DEFAULT 'Standard' CHECK (customer_type IN ('Standard', 'VIP', 'Distributor')),
    
    -- Device information fields
    device_model NVARCHAR(20) CHECK (device_model IN ('BWIII', 'BWMini', 'Compass', 'Maxxi')),
    device_serial_number NVARCHAR(100) NULL,
    
    created_at DATETIME2 DEFAULT GETUTCDATE(),
    updated_at DATETIME2 DEFAULT GETUTCDATE(),
    assigned_at DATETIME2 NULL,
    resolved_at DATETIME2 NULL,
    closed_at DATETIME2 NULL,
    
    -- Metadata
    source NVARCHAR(50) DEFAULT 'web' CHECK (source IN ('web', 'mobile', 'email', 'phone')),
    satisfaction_rating INT NULL CHECK (satisfaction_rating BETWEEN 1 AND 5),
    
    -- Foreign keys
    FOREIGN KEY (customer_id) REFERENCES Users(user_id),
    FOREIGN KEY (agent_id) REFERENCES Users(user_id),
    FOREIGN KEY (category_id) REFERENCES Categories(category_id),
    FOREIGN KEY (resolution_summary_generated_by) REFERENCES Users(user_id),
    
    -- Indexes
    INDEX IX_Tickets_TicketNumber (ticket_number),
    INDEX IX_Tickets_CustomerId (customer_id),
    INDEX IX_Tickets_AgentId (agent_id),
    INDEX IX_Tickets_Status (status),
    INDEX IX_Tickets_Priority (priority),
    INDEX IX_Tickets_CategoryId (category_id),
    INDEX IX_Tickets_CreatedAt (created_at),
    INDEX IX_Tickets_Status_Priority (status, priority),
    INDEX IX_Tickets_CustomerCountry (customer_country),
    INDEX IX_Tickets_CustomerState (customer_state),
    INDEX IX_Tickets_CustomerCity (customer_city),
    INDEX IX_Tickets_CustomerType (customer_type),
    INDEX IX_Tickets_DeviceModel (device_model),
    INDEX IX_Tickets_DeviceSerialNumber (device_serial_number),
    INDEX IX_Tickets_ResolutionSummary (resolution_summary_generated_at) WHERE resolution_summary IS NOT NULL,
    
    -- AI-related columns
    ai_enabled BIT DEFAULT 1,
    ai_disabled_reason NVARCHAR(100) NULL CHECK (ai_disabled_reason IN ('manual', 'customer_request', 'escalation')),
    ai_disabled_at DATETIME2 NULL,
    ai_disabled_by UNIQUEIDENTIFIER NULL,
    
    -- AI Summary fields (for ticket resolution summaries)
    resolution_summary NVARCHAR(MAX) NULL,
    resolution_summary_generated_at DATETIME2 NULL,
    resolution_summary_model_version NVARCHAR(50) NULL,
    resolution_summary_generated_by UNIQUEIDENTIFIER NULL
);

-- ==========================================
-- 4. MESSAGES TABLE (Chat History)
-- ==========================================

CREATE TABLE Messages (
    message_id UNIQUEIDENTIFIER PRIMARY KEY DEFAULT NEWID(),
    ticket_id UNIQUEIDENTIFIER NOT NULL,
    sender_id UNIQUEIDENTIFIER NOT NULL,
    
    message_content NVARCHAR(MAX) NOT NULL,
    message_type NVARCHAR(20) DEFAULT 'text' CHECK (message_type IN ('text', 'file', 'image', 'system')),
    
    created_at DATETIME2 DEFAULT GETUTCDATE(),
    is_read BIT DEFAULT 0,
    read_at DATETIME2 NULL,
    
    -- File attachments (optional)
    file_name NVARCHAR(255) NULL,
    file_path NVARCHAR(500) NULL,
    file_size INT NULL,
    
    -- Foreign keys
    FOREIGN KEY (ticket_id) REFERENCES Tickets(ticket_id) ON DELETE CASCADE,
    FOREIGN KEY (sender_id) REFERENCES Users(user_id),
    
    -- Indexes
    INDEX IX_Messages_TicketId (ticket_id),
    INDEX IX_Messages_SenderId (sender_id),
    INDEX IX_Messages_CreatedAt (created_at),
    INDEX IX_Messages_IsRead (is_read)
);

-- ==========================================
-- 5. TICKET HISTORY (Status Changes)
-- ==========================================

CREATE TABLE TicketHistory (
    history_id UNIQUEIDENTIFIER PRIMARY KEY DEFAULT NEWID(),
    ticket_id UNIQUEIDENTIFIER NOT NULL,
    changed_by UNIQUEIDENTIFIER NOT NULL,
    
    field_name NVARCHAR(50) NOT NULL, -- status, priority, category, agent_id, etc.
    old_value NVARCHAR(255),
    new_value NVARCHAR(255),
    
    change_reason NVARCHAR(500),
    created_at DATETIME2 DEFAULT GETUTCDATE(),
    
    -- Foreign keys
    FOREIGN KEY (ticket_id) REFERENCES Tickets(ticket_id) ON DELETE CASCADE,
    FOREIGN KEY (changed_by) REFERENCES Users(user_id),
    
    -- Indexes
    INDEX IX_TicketHistory_TicketId (ticket_id),
    INDEX IX_TicketHistory_ChangedBy (changed_by),
    INDEX IX_TicketHistory_CreatedAt (created_at)
);

-- ==========================================
-- 6. AGENT WORKLOAD TRACKING
-- ==========================================

CREATE TABLE AgentWorkload (
    workload_id UNIQUEIDENTIFIER PRIMARY KEY DEFAULT NEWID(),
    agent_id UNIQUEIDENTIFIER NOT NULL,
    active_tickets INT DEFAULT 0,
    total_tickets_handled INT DEFAULT 0,
    avg_resolution_time_minutes INT DEFAULT 0,
    last_updated DATETIME2 DEFAULT GETUTCDATE(),
    
    -- Foreign keys
    FOREIGN KEY (agent_id) REFERENCES Users(user_id),
    
    -- Indexes
    INDEX IX_AgentWorkload_AgentId (agent_id),
    UNIQUE INDEX UX_AgentWorkload_AgentId (agent_id)
);

-- ==========================================
-- 7. SYSTEM SETTINGS
-- ==========================================

CREATE TABLE SystemSettings (
    setting_id UNIQUEIDENTIFIER PRIMARY KEY DEFAULT NEWID(),
    setting_key NVARCHAR(100) UNIQUE NOT NULL,
    setting_value NVARCHAR(MAX) NOT NULL,
    setting_type NVARCHAR(20) DEFAULT 'string' CHECK (setting_type IN ('string', 'integer', 'boolean', 'json')),
    description NVARCHAR(500),
    created_at DATETIME2 DEFAULT GETUTCDATE(),
    updated_at DATETIME2 DEFAULT GETUTCDATE(),
    
    INDEX IX_SystemSettings_Key (setting_key)
);

-- Insert default system settings
INSERT INTO SystemSettings (setting_key, setting_value, setting_type, description) VALUES
('max_tickets_per_agent', '10', 'integer', 'Maximum number of active tickets per agent'),
('auto_assign_tickets', 'true', 'boolean', 'Automatically assign tickets to available agents'),
('business_hours_start', '09:00', 'string', 'Business hours start time (24h format)'),
('business_hours_end', '17:00', 'string', 'Business hours end time (24h format)'),
('default_ticket_priority', 'medium', 'string', 'Default priority for new tickets'),
('session_timeout_minutes', '30', 'integer', 'Session timeout in minutes');

-- ==========================================
-- 8. ROLES AND PERMISSIONS
-- ==========================================

-- Roles table
CREATE TABLE Roles (
    role_id UNIQUEIDENTIFIER PRIMARY KEY DEFAULT NEWID(),
    role_name NVARCHAR(50) UNIQUE NOT NULL,
    description NVARCHAR(255),
    is_active BIT DEFAULT 1,
    created_at DATETIME2 DEFAULT GETUTCDATE(),
    
    INDEX IX_Roles_Name (role_name)
);

-- Insert default roles
INSERT INTO Roles (role_name, description) VALUES
('Admin', 'Full system access'),
('Tier2', 'Senior support agent'),
('Tier1', 'Standard support agent'),
('Viewer', 'Read-only access');

-- Permissions table
CREATE TABLE Permissions (
    permission_id UNIQUEIDENTIFIER PRIMARY KEY DEFAULT NEWID(),
    permission_name NVARCHAR(100) UNIQUE NOT NULL,
    description NVARCHAR(255),
    category NVARCHAR(50) NOT NULL, -- tickets, users, etc.
    
    INDEX IX_Permissions_Name (permission_name),
    INDEX IX_Permissions_Category (category)
);

-- Insert default permissions
INSERT INTO Permissions (permission_name, description, category) VALUES
('tickets.create', 'Create new tickets', 'tickets'),
('tickets.edit', 'Edit existing tickets', 'tickets'),
('tickets.delete', 'Delete tickets', 'tickets'),
('tickets.view', 'View tickets', 'tickets'),
('users.access', 'Access user management', 'users'),
('users.create', 'Create new users', 'users'),
('users.edit', 'Edit existing users', 'users'),
('users.delete', 'Delete users', 'users'),
('audit.view', 'View audit trail logs', 'audit'),
('customers.view', 'View customer management', 'customers'),
('customers.create', 'Create new customers', 'customers'),
('customers.edit', 'Edit existing customers', 'customers'),
('customers.delete', 'Delete customers', 'customers'),
('insights.view', 'View insights and analytics', 'insights');

-- Role-Permission mapping
CREATE TABLE RolePermissions (
    role_id UNIQUEIDENTIFIER NOT NULL,
    permission_id UNIQUEIDENTIFIER NOT NULL,
    
    PRIMARY KEY (role_id, permission_id),
    FOREIGN KEY (role_id) REFERENCES Roles(role_id) ON DELETE CASCADE,
    FOREIGN KEY (permission_id) REFERENCES Permissions(permission_id) ON DELETE CASCADE
);

-- Assign permissions to roles
-- Admin gets all permissions
INSERT INTO RolePermissions (role_id, permission_id)
SELECT r.role_id, p.permission_id 
FROM Roles r, Permissions p 
WHERE r.role_name = 'Admin';

-- Tier2 gets ticket, user, and customer management permissions
INSERT INTO RolePermissions (role_id, permission_id)
SELECT r.role_id, p.permission_id 
FROM Roles r, Permissions p 
WHERE r.role_name = 'Tier2' 
AND p.permission_name IN ('tickets.create', 'tickets.edit', 'tickets.view', 'users.access', 'users.edit', 'customers.view', 'customers.edit', 'insights.view');

-- Tier1 gets basic ticket permissions
INSERT INTO RolePermissions (role_id, permission_id)
SELECT r.role_id, p.permission_id 
FROM Roles r, Permissions p 
WHERE r.role_name = 'Tier1' 
AND p.permission_name IN ('tickets.create', 'tickets.edit', 'tickets.view');

-- Viewer gets read-only access
INSERT INTO RolePermissions (role_id, permission_id)
SELECT r.role_id, p.permission_id 
FROM Roles r, Permissions p 
WHERE r.role_name = 'Viewer' 
AND p.permission_name IN ('tickets.view');

-- ==========================================
-- 9. AUDIT TRAIL
-- ==========================================

CREATE TABLE AuditLog (
    audit_id UNIQUEIDENTIFIER PRIMARY KEY DEFAULT NEWID(),
    timestamp DATETIME2 DEFAULT GETUTCDATE(),
    user_id UNIQUEIDENTIFIER NULL, -- NULL for system actions or anonymous customers
    user_name NVARCHAR(255) NULL, -- For anonymous customers
    user_type NVARCHAR(20) NOT NULL CHECK (user_type IN ('customer', 'agent', 'system')),
    action NVARCHAR(100) NOT NULL, -- login_attempt, ticket_created, ticket_edited, etc.
    ticket_number NVARCHAR(20) NULL, -- Reference to ticket if applicable
    target_type NVARCHAR(50) NULL, -- ticket, user, message, etc.
    target_id NVARCHAR(255) NULL, -- ID of the target object
    ip_address NVARCHAR(45) NULL, -- IPv4 or IPv6
    user_agent NVARCHAR(500) NULL,
    country NVARCHAR(100) NULL,
    details NVARCHAR(MAX) NULL, -- JSON or text description of changes
    status NVARCHAR(20) DEFAULT 'success' CHECK (status IN ('success', 'failed', 'warning')),
    
    -- Foreign keys
    FOREIGN KEY (user_id) REFERENCES Users(user_id),
    
    -- Indexes
    INDEX IX_AuditLog_Timestamp (timestamp),
    INDEX IX_AuditLog_UserId (user_id),
    INDEX IX_AuditLog_UserType (user_type),
    INDEX IX_AuditLog_Action (action),
    INDEX IX_AuditLog_TicketNumber (ticket_number),
    INDEX IX_AuditLog_IpAddress (ip_address),
    INDEX IX_AuditLog_Status (status)
);

-- ==========================================
-- 10. TRIGGERS
-- ==========================================

-- Trigger to update ticket updated_at timestamp
CREATE TRIGGER TR_Tickets_UpdateTimestamp
    ON Tickets
    AFTER UPDATE
AS
BEGIN
    SET NOCOUNT ON;
    
    UPDATE Tickets
    SET updated_at = GETUTCDATE()
    FROM Tickets t
    INNER JOIN inserted i ON t.ticket_id = i.ticket_id;
END;

-- Trigger to log ticket history
CREATE TRIGGER TR_Tickets_LogHistory
    ON Tickets
    AFTER UPDATE
AS
BEGIN
    SET NOCOUNT ON;
    
    -- Log status changes
    INSERT INTO TicketHistory (ticket_id, changed_by, field_name, old_value, new_value)
    SELECT 
        i.ticket_id,
        ISNULL(i.agent_id, i.customer_id),
        'status',
        d.status,
        i.status
    FROM inserted i
    INNER JOIN deleted d ON i.ticket_id = d.ticket_id
    WHERE i.status != d.status;
    
    -- Log priority changes
    INSERT INTO TicketHistory (ticket_id, changed_by, field_name, old_value, new_value)
    SELECT 
        i.ticket_id,
        ISNULL(i.agent_id, i.customer_id),
        'priority',
        d.priority,
        i.priority
    FROM inserted i
    INNER JOIN deleted d ON i.ticket_id = d.ticket_id
    WHERE i.priority != d.priority;
    
    -- Log agent assignment changes
    INSERT INTO TicketHistory (ticket_id, changed_by, field_name, old_value, new_value)
    SELECT 
        i.ticket_id,
        ISNULL(i.agent_id, i.customer_id),
        'agent_id',
        CAST(d.agent_id AS NVARCHAR(255)),
        CAST(i.agent_id AS NVARCHAR(255))
    FROM inserted i
    INNER JOIN deleted d ON i.ticket_id = d.ticket_id
    WHERE ISNULL(i.agent_id, '00000000-0000-0000-0000-000000000000') != ISNULL(d.agent_id, '00000000-0000-0000-0000-000000000000');
END;

-- ==========================================
-- 11. VIEWS FOR REPORTING
-- ==========================================

-- View for ticket statistics
CREATE VIEW TicketStatistics AS
SELECT 
    COUNT(*) as total_tickets,
    COUNT(CASE WHEN status = 'new' THEN 1 END) as new_tickets,
    COUNT(CASE WHEN status = 'in_progress' THEN 1 END) as in_progress_tickets,
    COUNT(CASE WHEN status = 'resolved' THEN 1 END) as resolved_tickets,
    COUNT(CASE WHEN status = 'closed' THEN 1 END) as closed_tickets,
    AVG(CASE 
        WHEN resolved_at IS NOT NULL 
        THEN DATEDIFF(MINUTE, created_at, resolved_at) 
        ELSE NULL 
    END) as avg_resolution_time_minutes
FROM Tickets;

-- View for agent performance
CREATE VIEW AgentPerformance AS
SELECT 
    u.user_id,
    u.first_name + ' ' + u.last_name as agent_name,
    u.email,
    COUNT(t.ticket_id) as total_tickets,
    COUNT(CASE WHEN t.status = 'resolved' THEN 1 END) as resolved_tickets,
    AVG(CASE 
        WHEN t.resolved_at IS NOT NULL 
        THEN DATEDIFF(MINUTE, t.created_at, t.resolved_at) 
        ELSE NULL 
    END) as avg_resolution_time_minutes,
    AVG(CAST(t.satisfaction_rating AS FLOAT)) as avg_satisfaction_rating
FROM Users u
LEFT JOIN Tickets t ON u.user_id = t.agent_id
WHERE u.user_type = 'agent'
GROUP BY u.user_id, u.first_name, u.last_name, u.email;

-- ==========================================
-- 9. AI AGENT SYSTEM TABLES
-- ==========================================

-- AI Agent Configuration Table
CREATE TABLE AiAgentConfig (
    config_id UNIQUEIDENTIFIER PRIMARY KEY DEFAULT NEWID(),
    model NVARCHAR(50) DEFAULT 'gpt-4o',
    agent_name NVARCHAR(100) DEFAULT 'NeuroAI',
    response_tone NVARCHAR(50) DEFAULT 'Technical',
    attitude_style NVARCHAR(50) DEFAULT 'Curious',
    context_limitations NVARCHAR(MAX) DEFAULT 'Only provide support for NeuroVirtual products',
    exceptions_behavior NVARCHAR(MAX) DEFAULT 'warranty,refund,billing',
    confidence_threshold FLOAT DEFAULT 0.7,
    enabled BIT DEFAULT 1,
    created_at DATETIME2 DEFAULT GETUTCDATE(),
    updated_at DATETIME2 DEFAULT GETUTCDATE()
);

-- Insert default AI agent configuration
INSERT INTO AiAgentConfig (model, agent_name, response_tone, attitude_style, context_limitations, exceptions_behavior, confidence_threshold, enabled)
VALUES ('gpt-4o', 'NeuroAI', 'Technical', 'Curious', 'Only provide support for NeuroVirtual products and devices', 'warranty,refund,billing,escalate,human', 0.7, 1);

-- AI Documents Table for Knowledge Base
CREATE TABLE AiDocuments (
    document_id UNIQUEIDENTIFIER PRIMARY KEY DEFAULT NEWID(),
    file_name NVARCHAR(255) NOT NULL,
    file_type NVARCHAR(10) NOT NULL CHECK (file_type IN ('pdf', 'doc', 'docx', 'txt')),
    file_path NVARCHAR(500) NOT NULL,
    file_size INT NOT NULL,
    parsed_text NVARCHAR(MAX) NOT NULL,
    embedding NVARCHAR(MAX) NULL, -- JSON string of vector embedding
    chunk_count INT DEFAULT 0,
    is_active BIT DEFAULT 1,
    created_at DATETIME2 DEFAULT GETUTCDATE(),
    updated_at DATETIME2 DEFAULT GETUTCDATE(),
    
    INDEX IX_AiDocuments_FileName (file_name),
    INDEX IX_AiDocuments_FileType (file_type),
    INDEX IX_AiDocuments_IsActive (is_active)
);

-- AI Document Chunks Table (for vector search)
CREATE TABLE AiDocumentChunks (
    chunk_id UNIQUEIDENTIFIER PRIMARY KEY DEFAULT NEWID(),
    document_id UNIQUEIDENTIFIER NOT NULL,
    chunk_text NVARCHAR(MAX) NOT NULL,
    chunk_index INT NOT NULL,
    embedding NVARCHAR(MAX) NULL, -- JSON string of vector embedding
    created_at DATETIME2 DEFAULT GETUTCDATE(),
    
    FOREIGN KEY (document_id) REFERENCES AiDocuments(document_id) ON DELETE CASCADE,
    INDEX IX_AiDocumentChunks_DocumentId (document_id),
    INDEX IX_AiDocumentChunks_ChunkIndex (chunk_index)
);

-- AI Responses Table for tracking AI interactions
CREATE TABLE AiResponses (
    response_id UNIQUEIDENTIFIER PRIMARY KEY DEFAULT NEWID(),
    ticket_id UNIQUEIDENTIFIER NOT NULL,
    message_id UNIQUEIDENTIFIER NULL,
    source_doc_ids NVARCHAR(MAX) NULL, -- JSON array of document IDs used
    user_message NVARCHAR(MAX) NOT NULL,
    ai_response NVARCHAR(MAX) NOT NULL,
    confidence_score FLOAT NOT NULL,
    model_used NVARCHAR(50) NOT NULL,
    response_time_ms INT NOT NULL,
    created_at DATETIME2 DEFAULT GETUTCDATE(),
    
    FOREIGN KEY (ticket_id) REFERENCES Tickets(ticket_id) ON DELETE CASCADE,
    INDEX IX_AiResponses_TicketId (ticket_id),
    INDEX IX_AiResponses_CreatedAt (created_at),
    INDEX IX_AiResponses_ConfidenceScore (confidence_score)
);

-- Grant permissions (adjust as needed for your security model)
-- GRANT SELECT, INSERT, UPDATE, DELETE ON Users TO [NeuroChat_App_User];
-- GRANT SELECT, INSERT, UPDATE, DELETE ON Tickets TO [NeuroChat_App_User];
-- GRANT SELECT, INSERT, UPDATE, DELETE ON Messages TO [NeuroChat_App_User];
-- GRANT SELECT, INSERT, UPDATE, DELETE ON Categories TO [NeuroChat_App_User];
-- GRANT SELECT, INSERT, UPDATE, DELETE ON TicketHistory TO [NeuroChat_App_User];
-- GRANT SELECT, INSERT, UPDATE, DELETE ON AgentWorkload TO [NeuroChat_App_User];
-- GRANT SELECT ON TicketStatistics TO [NeuroChat_App_User];
-- GRANT SELECT ON AgentPerformance TO [NeuroChat_App_User];
-- GRANT EXECUTE ON GetAvailableAgents TO [NeuroChat_App_User];
-- GRANT EXECUTE ON UpdateAgentWorkload TO [NeuroChat_App_User]; 
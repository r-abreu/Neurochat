-- Add Companies table for Account Management System
-- Migration: Add Companies/Accounts Management Tables

-- ==========================================
-- 1. COMPANIES TABLE
-- ==========================================

CREATE TABLE Companies (
    company_id UNIQUEIDENTIFIER PRIMARY KEY DEFAULT NEWID(),
    name NVARCHAR(200) NOT NULL,
    aliases NVARCHAR(MAX) NULL, -- JSON array of alternative names for fuzzy matching
    description NVARCHAR(500) NULL,
    
    -- Contact information
    primary_email NVARCHAR(255) NULL,
    primary_phone NVARCHAR(50) NULL,
    website NVARCHAR(255) NULL,
    
    -- Address information
    address NVARCHAR(500) NULL,
    city NVARCHAR(100) NULL,
    state NVARCHAR(100) NULL,
    zip_code NVARCHAR(20) NULL,
    country NVARCHAR(100) NULL,
    
    -- Metadata
    is_active BIT DEFAULT 1,
    created_at DATETIME2 DEFAULT GETUTCDATE(),
    updated_at DATETIME2 DEFAULT GETUTCDATE(),
    created_by UNIQUEIDENTIFIER NULL,
    updated_by UNIQUEIDENTIFIER NULL,
    
    -- Foreign keys
    FOREIGN KEY (created_by) REFERENCES Users(user_id),
    FOREIGN KEY (updated_by) REFERENCES Users(user_id),
    
    -- Indexes
    INDEX IX_Companies_Name (name),
    INDEX IX_Companies_Country (country),
    INDEX IX_Companies_IsActive (is_active),
    INDEX IX_Companies_CreatedAt (created_at)
);

-- ==========================================
-- 2. UPDATE EXISTING TABLES
-- ==========================================

-- Add company_id foreign key to Users table (customers)
ALTER TABLE Users ADD company_id UNIQUEIDENTIFIER NULL;
ALTER TABLE Users ADD CONSTRAINT FK_Users_Company FOREIGN KEY (company_id) REFERENCES Companies(company_id);
CREATE INDEX IX_Users_CompanyId ON Users(company_id);

-- Add company_id foreign key to Tickets table  
ALTER TABLE Tickets ADD company_id UNIQUEIDENTIFIER NULL;
ALTER TABLE Tickets ADD CONSTRAINT FK_Tickets_Company FOREIGN KEY (company_id) REFERENCES Companies(company_id);
CREATE INDEX IX_Tickets_CompanyId ON Tickets(company_id);

-- ==========================================
-- 3. FUZZY MATCHING LOG TABLE
-- ==========================================

CREATE TABLE CompanyMatchingLog (
    log_id UNIQUEIDENTIFIER PRIMARY KEY DEFAULT NEWID(),
    
    -- Matching details
    input_company_name NVARCHAR(200) NOT NULL,
    matched_company_id UNIQUEIDENTIFIER NULL,
    matched_company_name NVARCHAR(200) NULL,
    confidence_score DECIMAL(5,2) NULL, -- 0.00 to 100.00
    
    -- Context
    ticket_id UNIQUEIDENTIFIER NULL,
    customer_id UNIQUEIDENTIFIER NULL,
    
    -- Action taken
    action_taken NVARCHAR(50) NOT NULL, -- 'auto_assigned', 'suggested', 'manual_override', 'no_match'
    assigned_by UNIQUEIDENTIFIER NULL, -- agent who confirmed the match
    
    -- Metadata
    created_at DATETIME2 DEFAULT GETUTCDATE(),
    
    -- Foreign keys
    FOREIGN KEY (matched_company_id) REFERENCES Companies(company_id),
    FOREIGN KEY (ticket_id) REFERENCES Tickets(ticket_id),
    FOREIGN KEY (customer_id) REFERENCES Users(user_id),
    FOREIGN KEY (assigned_by) REFERENCES Users(user_id),
    
    -- Indexes
    INDEX IX_CompanyMatching_InputName (input_company_name),
    INDEX IX_CompanyMatching_MatchedCompany (matched_company_id),
    INDEX IX_CompanyMatching_TicketId (ticket_id),
    INDEX IX_CompanyMatching_CreatedAt (created_at),
    INDEX IX_CompanyMatching_Action (action_taken)
);

-- ==========================================
-- 4. PERMISSIONS FOR ACCOUNT MANAGEMENT
-- ==========================================

-- Add company management permissions
INSERT INTO Permissions (permission_name, description, category) VALUES
('companies.view', 'View company management', 'companies'),
('companies.create', 'Create new companies', 'companies'),
('companies.edit', 'Edit existing companies', 'companies'),
('companies.delete', 'Delete companies', 'companies'),
('companies.assign', 'Assign customers/devices to companies', 'companies');

-- Grant permissions to Admin role
INSERT INTO RolePermissions (role_id, permission_id)
SELECT r.role_id, p.permission_id 
FROM Roles r, Permissions p 
WHERE r.role_name = 'Admin' 
AND p.permission_name IN ('companies.view', 'companies.create', 'companies.edit', 'companies.delete', 'companies.assign');

-- Grant view and assign permissions to Tier2 agents  
INSERT INTO RolePermissions (role_id, permission_id)
SELECT r.role_id, p.permission_id 
FROM Roles r, Permissions p 
WHERE r.role_name = 'Tier2' 
AND p.permission_name IN ('companies.view', 'companies.assign');

-- ==========================================
-- 5. SAMPLE DATA
-- ==========================================

-- Insert sample companies for testing
INSERT INTO Companies (name, aliases, description, primary_email, country, created_at) VALUES
('NeuroVirtual Inc.', '["Neurovirtual", "NeuroVirtual USA", "NeuroVirtual America", "NV Inc"]', 'Main company for NeuroVirtual products', 'info@neurovirtual.com', 'United States', GETUTCDATE()),
('Acme Corporation', '["ACME Corp", "Acme Corp.", "ACME", "Acme Inc"]', 'Large enterprise customer', 'contact@acme.com', 'United States', GETUTCDATE()),
('Innovative Solutions Ltd', '["Innovative Solutions", "Innovation Solutions", "IS Ltd", "InnoSol"]', 'Technology solutions company', 'hello@innovativesolutions.com', 'United Kingdom', GETUTCDATE()),
('Tech Startup Inc.', '["Tech Startup", "TechStart", "TS Inc", "TechStartup Inc"]', 'Growing technology startup', 'team@techstartup.com', 'Canada', GETUTCDATE()),
('Global Healthcare Systems', '["Global Healthcare", "GHS", "Global Health", "Healthcare Systems"]', 'International healthcare provider', 'support@globalhealthcare.com', 'Germany', GETUTCDATE());

-- ==========================================
-- 6. TRIGGERS
-- ==========================================

-- Trigger to update companies updated_at timestamp
CREATE TRIGGER TR_Companies_UpdateTimestamp
    ON Companies
    AFTER UPDATE
AS
BEGIN
    SET NOCOUNT ON;
    
    UPDATE Companies
    SET updated_at = GETUTCDATE()
    FROM Companies c
    INNER JOIN inserted i ON c.company_id = i.company_id;
END;

-- ==========================================
-- 7. VIEWS FOR REPORTING
-- ==========================================

-- View for company statistics
CREATE VIEW CompanyStatistics AS
SELECT 
    c.company_id,
    c.name as company_name,
    c.country,
    c.created_at,
    
    -- Customer counts
    COUNT(DISTINCT u.user_id) as total_customers,
    COUNT(DISTINCT CASE WHEN u.is_active = 1 THEN u.user_id END) as active_customers,
    
    -- Ticket counts
    COUNT(DISTINCT t.ticket_id) as total_tickets,
    COUNT(DISTINCT CASE WHEN t.status = 'new' THEN t.ticket_id END) as new_tickets,
    COUNT(DISTINCT CASE WHEN t.status = 'in_progress' THEN t.ticket_id END) as in_progress_tickets,
    COUNT(DISTINCT CASE WHEN t.status = 'resolved' THEN t.ticket_id END) as resolved_tickets,
    COUNT(DISTINCT CASE WHEN t.status = 'closed' THEN t.ticket_id END) as closed_tickets,
    
    -- Device counts (if devices table exists)
    -- COUNT(DISTINCT d.device_id) as total_devices,
    
    -- Latest activity
    MAX(t.created_at) as last_ticket_date,
    MAX(u.last_login) as last_customer_login
    
FROM Companies c
LEFT JOIN Users u ON c.company_id = u.company_id AND u.user_type = 'customer'
LEFT JOIN Tickets t ON c.company_id = t.company_id
WHERE c.is_active = 1
GROUP BY c.company_id, c.name, c.country, c.created_at; 
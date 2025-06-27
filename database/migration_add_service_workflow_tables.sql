-- Migration: Add Service Workflow Management Tables
-- This migration adds support for device service workflow tracking with 10 sequential steps

-- ==========================================
-- SERVICE WORKFLOWS TABLE
-- ==========================================
CREATE TABLE ServiceWorkflows (
    workflow_id UNIQUEIDENTIFIER PRIMARY KEY DEFAULT NEWID(),
    ticket_id UNIQUEIDENTIFIER NOT NULL,
    device_id UNIQUEIDENTIFIER NULL,
    device_serial_number NVARCHAR(100) NOT NULL,
    workflow_number AS ('SWF-' + RIGHT('000000' + CAST(ABS(CHECKSUM(NEWID())) % 1000000 AS VARCHAR(6)), 6)) PERSISTED,
    
    -- Workflow status
    current_step INT DEFAULT 1 CHECK (current_step BETWEEN 1 AND 10),
    status NVARCHAR(20) DEFAULT 'in_progress' CHECK (status IN ('in_progress', 'completed', 'cancelled')),
    
    -- Basic information
    initiated_by UNIQUEIDENTIFIER NOT NULL,
    initiated_at DATETIME2 DEFAULT GETUTCDATE(),
    completed_at DATETIME2 NULL,
    cancelled_at DATETIME2 NULL,
    cancelled_by UNIQUEIDENTIFIER NULL,
    cancellation_reason NVARCHAR(500) NULL,
    
    created_at DATETIME2 DEFAULT GETUTCDATE(),
    updated_at DATETIME2 DEFAULT GETUTCDATE(),
    
    -- Foreign keys
    FOREIGN KEY (ticket_id) REFERENCES Tickets(ticket_id) ON DELETE CASCADE,
    FOREIGN KEY (device_id) REFERENCES Devices(device_id),
    FOREIGN KEY (initiated_by) REFERENCES Users(user_id),
    FOREIGN KEY (cancelled_by) REFERENCES Users(user_id),
    
    -- Indexes
    INDEX IX_ServiceWorkflows_TicketId (ticket_id),
    INDEX IX_ServiceWorkflows_DeviceId (device_id),
    INDEX IX_ServiceWorkflows_DeviceSerial (device_serial_number),
    INDEX IX_ServiceWorkflows_Status (status),
    INDEX IX_ServiceWorkflows_CurrentStep (current_step),
    INDEX IX_ServiceWorkflows_InitiatedAt (initiated_at)
);

-- ==========================================
-- WORKFLOW STEPS TABLE (Updated with comprehensive fields)
-- ==========================================
CREATE TABLE WorkflowSteps (
    step_id UNIQUEIDENTIFIER PRIMARY KEY DEFAULT NEWID(),
    workflow_id UNIQUEIDENTIFIER NOT NULL,
    step_number INT NOT NULL CHECK (step_number BETWEEN 1 AND 10),
    step_name NVARCHAR(100) NOT NULL,
    step_description NVARCHAR(500) NOT NULL,
    is_optional BIT DEFAULT 0,
    
    -- Step status
    status NVARCHAR(20) DEFAULT 'not_started' CHECK (status IN ('not_started', 'in_progress', 'completed', 'skipped')),
    started_at DATETIME2 NULL,
    completed_at DATETIME2 NULL,
    
    -- Agent assignment
    agent_id UNIQUEIDENTIFIER NULL,
    agent_name NVARCHAR(200) NULL,
    
    -- Common fields for all steps
    completion_date DATETIME2 NULL,
    comments NVARCHAR(MAX) NULL,
    
    -- Step 1: Request Device for Repair
    device_serial_number NVARCHAR(100) NULL,
    defect_description NVARCHAR(MAX) NULL,
    customer_tracking_number NVARCHAR(100) NULL,
    assigned_agent_id UNIQUEIDENTIFIER NULL,
    requested_date DATETIME2 NULL,
    
    -- Step 2: Ship Loaner to Customer
    send_loaner BIT DEFAULT 0,
    loaner_model NVARCHAR(100) NULL,
    loaner_serial_number NVARCHAR(100) NULL,
    loaner_tracking_number NVARCHAR(100) NULL,
    shipment_date DATETIME2 NULL,
    loaner_agent_id UNIQUEIDENTIFIER NULL,
    
    -- Step 3: Receiving, Inspection & Cleaning
    received_date DATETIME2 NULL,
    cleaning_date DATETIME2 NULL,
    product_id_confirmation_date DATETIME2 NULL,
    inspection_agent_id UNIQUEIDENTIFIER NULL,
    received_parts NVARCHAR(MAX) NULL, -- JSON array of parts
    inspection_comments NVARCHAR(MAX) NULL,
    
    -- Step 4: Defect Analysis
    analysis_date DATETIME2 NULL,
    analysis_agent_id UNIQUEIDENTIFIER NULL,
    findings_description NVARCHAR(MAX) NULL,
    replacement_parts NVARCHAR(MAX) NULL, -- JSON array of replacement parts
    diagnostic_summary NVARCHAR(MAX) NULL,
    
    -- Step 5: Quote & Approval
    quote_number NVARCHAR(100) NULL,
    quote_date DATETIME2 NULL,
    quote_agent_id UNIQUEIDENTIFIER NULL,
    approval_status NVARCHAR(20) NULL CHECK (approval_status IN ('pending', 'approved', 'rejected', NULL)),
    approval_date DATETIME2 NULL,
    invoice_number NVARCHAR(100) NULL,
    
    -- Step 6: Correction and Technical Report
    correction_date DATETIME2 NULL,
    repair_agent_id UNIQUEIDENTIFIER NULL,
    repair_description NVARCHAR(MAX) NULL,
    parts_used NVARCHAR(MAX) NULL, -- JSON array of parts used
    test_checklist NVARCHAR(MAX) NULL, -- JSON array of test results
    final_repair_approval BIT DEFAULT 0,
    
    -- Step 7: Final Service Approval
    approver_agent_id UNIQUEIDENTIFIER NULL,
    approval_declaration BIT DEFAULT 0,
    
    -- Step 8: Device Return to Customer
    return_tracking_number NVARCHAR(100) NULL,
    shipment_agent_id UNIQUEIDENTIFIER NULL,
    shipment_comments NVARCHAR(MAX) NULL,
    
    -- Step 9: Post-Service Confirmation
    confirmation_date DATETIME2 NULL,
    confirmation_agent_id UNIQUEIDENTIFIER NULL,
    contact_person NVARCHAR(200) NULL,
    confirmation_status BIT DEFAULT 0,
    confirmation_notes NVARCHAR(MAX) NULL,
    
    -- Step 10: Loaner Return to Company
    return_date DATETIME2 NULL,
    loaner_return_tracking_number NVARCHAR(100) NULL,
    receiving_agent_id UNIQUEIDENTIFIER NULL,
    
    -- Audit fields
    step_updated_at DATETIME2 DEFAULT GETUTCDATE(),
    updated_by UNIQUEIDENTIFIER NULL,
    
    created_at DATETIME2 DEFAULT GETUTCDATE(),
    updated_at DATETIME2 DEFAULT GETUTCDATE(),
    
    -- Foreign keys
    FOREIGN KEY (workflow_id) REFERENCES ServiceWorkflows(workflow_id) ON DELETE CASCADE,
    FOREIGN KEY (agent_id) REFERENCES Users(user_id),
    FOREIGN KEY (assigned_agent_id) REFERENCES Users(user_id),
    FOREIGN KEY (loaner_agent_id) REFERENCES Users(user_id),
    FOREIGN KEY (inspection_agent_id) REFERENCES Users(user_id),
    FOREIGN KEY (analysis_agent_id) REFERENCES Users(user_id),
    FOREIGN KEY (quote_agent_id) REFERENCES Users(user_id),
    FOREIGN KEY (repair_agent_id) REFERENCES Users(user_id),
    FOREIGN KEY (approver_agent_id) REFERENCES Users(user_id),
    FOREIGN KEY (shipment_agent_id) REFERENCES Users(user_id),
    FOREIGN KEY (confirmation_agent_id) REFERENCES Users(user_id),
    FOREIGN KEY (updated_by) REFERENCES Users(user_id),
    
    -- Unique constraint
    UNIQUE (workflow_id, step_number),
    
    -- Indexes
    INDEX IX_WorkflowSteps_WorkflowId (workflow_id),
    INDEX IX_WorkflowSteps_StepNumber (step_number),
    INDEX IX_WorkflowSteps_Status (status),
    INDEX IX_WorkflowSteps_AgentId (agent_id),
    INDEX IX_WorkflowSteps_CompletedAt (completed_at),
    INDEX IX_WorkflowSteps_DeviceSerial (device_serial_number),
    INDEX IX_WorkflowSteps_QuoteNumber (quote_number),
    INDEX IX_WorkflowSteps_TrackingNumbers (customer_tracking_number, loaner_tracking_number, return_tracking_number)
);

-- ==========================================
-- WORKFLOW ATTACHMENTS TABLE
-- ==========================================
CREATE TABLE WorkflowAttachments (
    attachment_id UNIQUEIDENTIFIER PRIMARY KEY DEFAULT NEWID(),
    step_id UNIQUEIDENTIFIER NOT NULL,
    workflow_id UNIQUEIDENTIFIER NOT NULL,
    
    file_name NVARCHAR(255) NOT NULL,
    original_name NVARCHAR(255) NOT NULL,
    file_path NVARCHAR(500) NOT NULL,
    file_size INT NOT NULL,
    file_type NVARCHAR(100) NOT NULL,
    mime_type NVARCHAR(100) NOT NULL,
    
    uploaded_by UNIQUEIDENTIFIER NOT NULL,
    uploaded_at DATETIME2 DEFAULT GETUTCDATE(),
    
    -- Foreign keys
    FOREIGN KEY (step_id) REFERENCES WorkflowSteps(step_id) ON DELETE CASCADE,
    FOREIGN KEY (workflow_id) REFERENCES ServiceWorkflows(workflow_id) ON DELETE CASCADE,
    FOREIGN KEY (uploaded_by) REFERENCES Users(user_id),
    
    -- Indexes
    INDEX IX_WorkflowAttachments_StepId (step_id),
    INDEX IX_WorkflowAttachments_WorkflowId (workflow_id),
    INDEX IX_WorkflowAttachments_UploadedBy (uploaded_by),
    INDEX IX_WorkflowAttachments_UploadedAt (uploaded_at)
);

-- ==========================================
-- WORKFLOW AUDIT LOG TABLE
-- ==========================================
CREATE TABLE WorkflowAuditLog (
    audit_id UNIQUEIDENTIFIER PRIMARY KEY DEFAULT NEWID(),
    workflow_id UNIQUEIDENTIFIER NOT NULL,
    step_id UNIQUEIDENTIFIER NULL,
    
    action NVARCHAR(50) NOT NULL, -- 'workflow_created', 'step_started', 'step_completed', 'workflow_completed', etc.
    description NVARCHAR(500) NOT NULL,
    
    performed_by UNIQUEIDENTIFIER NOT NULL,
    performed_at DATETIME2 DEFAULT GETUTCDATE(),
    
    -- Additional context (JSON)
    context_data NVARCHAR(MAX) NULL,
    
    -- Foreign keys
    FOREIGN KEY (workflow_id) REFERENCES ServiceWorkflows(workflow_id) ON DELETE CASCADE,
    FOREIGN KEY (step_id) REFERENCES WorkflowSteps(step_id),
    FOREIGN KEY (performed_by) REFERENCES Users(user_id),
    
    -- Indexes
    INDEX IX_WorkflowAuditLog_WorkflowId (workflow_id),
    INDEX IX_WorkflowAuditLog_StepId (step_id),
    INDEX IX_WorkflowAuditLog_Action (action),
    INDEX IX_WorkflowAuditLog_PerformedBy (performed_by),
    INDEX IX_WorkflowAuditLog_PerformedAt (performed_at)
);

-- ==========================================
-- INSERT DEFAULT STEP DEFINITIONS
-- ==========================================
-- This function will initialize workflow steps when a new workflow is created
-- The step definitions are stored as a template

-- Create a function to initialize workflow steps
CREATE OR ALTER FUNCTION GetWorkflowStepDefinitions()
RETURNS TABLE
AS
RETURN (
    SELECT * FROM (VALUES
        (1, 'Request Device for Repair', 'Initial device request with tracking and defect description', 0),
        (2, 'Ship Loaner to Customer', 'Optional loaner device shipment to customer', 1),
        (3, 'Receiving, Inspection & Cleaning', 'Device received, inspected, and cleaned', 0),
        (4, 'Defect Analysis', 'Analysis of device defects and required parts', 0),
        (5, 'Quote & Approval', 'Generate quote and obtain customer approval', 0),
        (6, 'Correction and Technical Report', 'Perform repairs and generate service report', 0),
        (7, 'Final Service Approval', 'Final service approval by different agent', 0),
        (8, 'Device Return to Customer', 'Ship repaired device back to customer', 0),
        (9, 'Post-Service Confirmation', 'Confirm customer received and tested device', 0),
        (10, 'Loaner Return to Company', 'Return of loaner device (if applicable)', 1)
    ) AS StepDefs(step_number, step_name, step_description, is_optional)
);

-- ==========================================
-- TRIGGERS
-- ==========================================

-- Trigger to update workflow updated_at timestamp
CREATE TRIGGER TR_ServiceWorkflows_UpdateTimestamp
ON ServiceWorkflows
AFTER UPDATE
AS
BEGIN
    SET NOCOUNT ON;
    
    UPDATE ServiceWorkflows
    SET updated_at = GETUTCDATE()
    FROM ServiceWorkflows sw
    INNER JOIN inserted i ON sw.workflow_id = i.workflow_id;
END;

-- Trigger to update step updated_at timestamp
CREATE TRIGGER TR_WorkflowSteps_UpdateTimestamp
ON WorkflowSteps
AFTER UPDATE
AS
BEGIN
    SET NOCOUNT ON;
    
    UPDATE WorkflowSteps
    SET updated_at = GETUTCDATE(), step_updated_at = GETUTCDATE()
    FROM WorkflowSteps ws
    INNER JOIN inserted i ON ws.step_id = i.step_id;
END;

-- ==========================================
-- VALIDATION FUNCTIONS
-- ==========================================

-- Function to validate that Step 7 approver is different from Step 6 agent
CREATE OR ALTER FUNCTION ValidateStepApprover(@workflowId UNIQUEIDENTIFIER, @approverId UNIQUEIDENTIFIER)
RETURNS BIT
AS
BEGIN
    DECLARE @step6AgentId UNIQUEIDENTIFIER;
    
    SELECT @step6AgentId = agent_id
    FROM WorkflowSteps
    WHERE workflow_id = @workflowId AND step_number = 6;
    
    IF @step6AgentId IS NULL OR @step6AgentId != @approverId
        RETURN 1; -- Valid
    ELSE
        RETURN 0; -- Invalid - same agent
END;

-- ==========================================
-- STORED PROCEDURES
-- ==========================================

-- Procedure to complete a workflow step
CREATE OR ALTER PROCEDURE CompleteWorkflowStep
    @stepId UNIQUEIDENTIFIER,
    @agentId UNIQUEIDENTIFIER,
    @stepData NVARCHAR(MAX) = NULL
AS
BEGIN
    SET NOCOUNT ON;
    
    BEGIN TRY
        BEGIN TRANSACTION;
        
        -- Update the step
        UPDATE WorkflowSteps
        SET 
            status = 'completed',
            completed_at = GETUTCDATE(),
            agent_id = @agentId,
            completion_date = GETUTCDATE(),
            updated_by = @agentId
        WHERE step_id = @stepId;
        
        -- Update the workflow current step if this is the current step
        UPDATE ServiceWorkflows
        SET 
            current_step = CASE 
                WHEN current_step = ws.step_number AND ws.step_number < 10 
                THEN current_step + 1
                ELSE current_step
            END,
            status = CASE 
                WHEN ws.step_number = 10 THEN 'completed'
                ELSE status
            END,
            completed_at = CASE 
                WHEN ws.step_number = 10 THEN GETUTCDATE()
                ELSE completed_at
            END
        FROM ServiceWorkflows sw
        INNER JOIN WorkflowSteps ws ON sw.workflow_id = ws.workflow_id
        WHERE ws.step_id = @stepId;
        
        COMMIT TRANSACTION;
    END TRY
    BEGIN CATCH
        ROLLBACK TRANSACTION;
        THROW;
    END CATCH
END;

-- Add permissions for service workflow management
IF EXISTS (SELECT 1 FROM sys.tables WHERE name = 'Permissions')
BEGIN
    INSERT INTO Permissions (permission_name, description, category) VALUES
    ('service_workflows.view', 'View service workflows', 'Service Management'),
    ('service_workflows.create', 'Create new service workflows', 'Service Management'),
    ('service_workflows.edit', 'Edit service workflow steps', 'Service Management'),
    ('service_workflows.delete', 'Delete service workflows', 'Service Management'),
    ('service_workflows.approve', 'Approve service workflow steps (Step 7)', 'Service Management');
    
    -- Grant service workflow permissions to Admin role
    IF EXISTS (SELECT 1 FROM sys.tables WHERE name = 'RolePermissions')
    BEGIN
        INSERT INTO RolePermissions (role_id, permission_id)
        SELECT 
            r.role_id,
            p.permission_id
        FROM Roles r
        CROSS JOIN Permissions p
        WHERE r.role_name IN ('Admin', 'Agent')
          AND p.permission_name LIKE 'service_workflows.%'
          AND NOT EXISTS (
              SELECT 1 FROM RolePermissions rp 
              WHERE rp.role_id = r.role_id AND rp.permission_id = p.permission_id
          );
    END
END

PRINT 'Service Workflow Management tables created successfully!'; 
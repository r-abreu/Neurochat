-- Migration: Add AI Context and Intelligence Tables
-- This migration adds tables to support enhanced AI agent context awareness and memory

-- ==========================================
-- AI CONTEXT MANAGEMENT TABLES
-- ==========================================

-- Table to store ticket-based smart context summaries
CREATE TABLE ticket_context_cache (
    context_id UNIQUEIDENTIFIER PRIMARY KEY DEFAULT NEWID(),
    ticket_id UNIQUEIDENTIFIER NOT NULL,
    
    -- Context summary data
    conversation_summary NVARCHAR(MAX) NULL,
    last_5_responses NVARCHAR(MAX) NULL, -- JSON array of last 5 AI/agent responses
    issue_keywords NVARCHAR(500) NULL, -- Comma-separated keywords extracted from conversation
    troubleshooting_stage NVARCHAR(100) NULL, -- current, initial, advanced, escalation
    
    -- Device and customer context
    device_info NVARCHAR(MAX) NULL, -- JSON with device specs and known issues
    customer_context NVARCHAR(MAX) NULL, -- JSON with customer history and preferences
    linked_tickets NVARCHAR(500) NULL, -- Comma-separated list of related ticket IDs
    
    -- Context metadata
    last_updated DATETIME2 DEFAULT GETUTCDATE(),
    context_confidence FLOAT DEFAULT 0.5,
    needs_refresh BIT DEFAULT 0,
    
    -- Foreign keys
    FOREIGN KEY (ticket_id) REFERENCES Tickets(ticket_id) ON DELETE CASCADE,
    
    -- Indexes
    INDEX IX_TicketContextCache_TicketId (ticket_id),
    INDEX IX_TicketContextCache_LastUpdated (last_updated),
    INDEX IX_TicketContextCache_NeedsRefresh (needs_refresh)
);

-- Table to log AI prompts and track question patterns
CREATE TABLE ai_prompt_log (
    prompt_id UNIQUEIDENTIFIER PRIMARY KEY DEFAULT NEWID(),
    ticket_id UNIQUEIDENTIFIER NOT NULL,
    message_id UNIQUEIDENTIFIER NULL,
    
    -- Prompt tracking
    prompt_type NVARCHAR(50) NOT NULL, -- greeting, diagnosis, instruction, follow_up, escalation
    question_category NVARCHAR(100) NULL, -- power_issue, connectivity, setup, troubleshooting
    prompt_text NVARCHAR(MAX) NOT NULL,
    
    -- Response tracking
    ai_response NVARCHAR(MAX) NULL,
    response_confidence FLOAT NULL,
    was_escalated BIT DEFAULT 0,
    response_time_ms INT NULL,
    
    -- Context used
    context_docs_used INT DEFAULT 0,
    device_info_used BIT DEFAULT 0,
    customer_history_used BIT DEFAULT 0,
    
    created_at DATETIME2 DEFAULT GETUTCDATE(),
    
    -- Foreign keys
    FOREIGN KEY (ticket_id) REFERENCES Tickets(ticket_id) ON DELETE CASCADE,
    FOREIGN KEY (message_id) REFERENCES Messages(message_id) ON DELETE SET NULL,
    
    -- Indexes
    INDEX IX_AIPromptLog_TicketId (ticket_id),
    INDEX IX_AIPromptLog_PromptType (prompt_type),
    INDEX IX_AIPromptLog_QuestionCategory (question_category),
    INDEX IX_AIPromptLog_CreatedAt (created_at)
);

-- Table to tag AI messages with categories and metadata
CREATE TABLE ai_message_tag (
    tag_id UNIQUEIDENTIFIER PRIMARY KEY DEFAULT NEWID(),
    message_id UNIQUEIDENTIFIER NOT NULL,
    ticket_id UNIQUEIDENTIFIER NOT NULL,
    
    -- Message classification
    message_type NVARCHAR(50) NOT NULL, -- greeting, diagnosis, instruction, follow_up, clarification, escalation
    intent_category NVARCHAR(100) NULL, -- troubleshooting, information, guidance, escalation
    
    -- Quality metrics
    clarity_score FLOAT DEFAULT 0.5, -- 0-1 scale
    helpfulness_score FLOAT DEFAULT 0.5, -- 0-1 scale
    contains_jargon BIT DEFAULT 0,
    sentence_count INT DEFAULT 0,
    word_count INT DEFAULT 0,
    
    -- Feedback tracking
    agent_feedback NVARCHAR(20) NULL, -- helpful, unhelpful, needs_improvement
    agent_rewrite NVARCHAR(MAX) NULL, -- Agent's improved version if provided
    customer_satisfaction INT NULL, -- 1-5 rating if available
    
    -- Metadata
    created_at DATETIME2 DEFAULT GETUTCDATE(),
    updated_at DATETIME2 DEFAULT GETUTCDATE(),
    
    -- Foreign keys
    FOREIGN KEY (message_id) REFERENCES Messages(message_id) ON DELETE CASCADE,
    FOREIGN KEY (ticket_id) REFERENCES Tickets(ticket_id) ON DELETE CASCADE,
    
    -- Indexes
    INDEX IX_AIMessageTag_MessageId (message_id),
    INDEX IX_AIMessageTag_TicketId (ticket_id),
    INDEX IX_AIMessageTag_MessageType (message_type),
    INDEX IX_AIMessageTag_AgentFeedback (agent_feedback)
);

-- Table to store context memory for each ticket
CREATE TABLE context_memory (
    memory_id UNIQUEIDENTIFIER PRIMARY KEY DEFAULT NEWID(),
    ticket_id UNIQUEIDENTIFIER NOT NULL,
    
    -- Question tracking
    questions_asked NVARCHAR(MAX) NULL, -- JSON array of question types already asked
    information_gathered NVARCHAR(MAX) NULL, -- JSON object of confirmed details
    troubleshooting_steps_completed NVARCHAR(MAX) NULL, -- JSON array of completed steps
    
    -- Customer interaction patterns
    customer_communication_style NVARCHAR(100) NULL, -- technical, non_technical, impatient, detailed
    preferred_response_length NVARCHAR(20) NULL, -- brief, detailed, step_by_step
    escalation_triggers NVARCHAR(MAX) NULL, -- JSON array of phrases that suggest escalation needed
    
    -- Issue tracking
    primary_issue_category NVARCHAR(100) NULL,
    secondary_issues NVARCHAR(500) NULL, -- Comma-separated list
    resolution_attempts INT DEFAULT 0,
    customer_frustration_level NVARCHAR(20) DEFAULT 'low', -- low, medium, high, critical
    
    -- Memory metadata
    last_updated DATETIME2 DEFAULT GETUTCDATE(),
    confidence_level FLOAT DEFAULT 0.5,
    
    -- Foreign keys
    FOREIGN KEY (ticket_id) REFERENCES Tickets(ticket_id) ON DELETE CASCADE,
    
    -- Indexes
    INDEX IX_ContextMemory_TicketId (ticket_id),
    INDEX IX_ContextMemory_LastUpdated (last_updated),
    INDEX IX_ContextMemory_PrimaryIssueCategory (primary_issue_category)
);

-- Table to store troubleshooting flow patterns and guides
CREATE TABLE troubleshooting_flows (
    flow_id UNIQUEIDENTIFIER PRIMARY KEY DEFAULT NEWID(),
    
    -- Flow identification
    issue_pattern NVARCHAR(200) NOT NULL, -- Regex or keyword pattern to match
    device_model NVARCHAR(50) NULL, -- BWMini, BWIII, Compass, Maxxi, or NULL for all
    flow_name NVARCHAR(100) NOT NULL,
    description NVARCHAR(500) NULL,
    
    -- Flow steps (JSON array of step objects)
    flow_steps NVARCHAR(MAX) NOT NULL, -- JSON: [{"step": 1, "instruction": "...", "expected_response": "...", "next_step_success": 2, "next_step_failure": 3}]
    
    -- Flow metadata
    priority INT DEFAULT 1, -- Higher priority flows are checked first
    success_rate FLOAT DEFAULT 0.0, -- Track how often this flow resolves issues
    usage_count INT DEFAULT 0,
    is_active BIT DEFAULT 1,
    
    -- Audit fields
    created_at DATETIME2 DEFAULT GETUTCDATE(),
    updated_at DATETIME2 DEFAULT GETUTCDATE(),
    created_by UNIQUEIDENTIFIER NULL,
    
    -- Indexes
    INDEX IX_TroubleshootingFlows_IssuePattern (issue_pattern),
    INDEX IX_TroubleshootingFlows_DeviceModel (device_model),
    INDEX IX_TroubleshootingFlows_Priority (priority),
    INDEX IX_TroubleshootingFlows_IsActive (is_active)
);

-- Insert some default troubleshooting flows
INSERT INTO troubleshooting_flows (issue_pattern, device_model, flow_name, description, flow_steps, priority) VALUES 
(
    'won''t power on|not turning on|no power|dead|not starting',
    NULL,
    'Device Power Issues',
    'Step-by-step guide for devices that won''t power on',
    '[
        {
            "step": 1,
            "instruction": "Let''s walk through a few quick checks to power on your device. Step 1: Make sure the power cord is firmly connected to both your device and the wall outlet.",
            "expected_response": "confirmation or issue found",
            "next_step_success": 2,
            "next_step_failure": 4
        },
        {
            "step": 2,
            "instruction": "Step 2: Try a different power outlet to rule out outlet issues.",
            "expected_response": "device powers on or still no power",
            "next_step_success": 0,
            "next_step_failure": 3
        },
        {
            "step": 3,
            "instruction": "Step 3: Look for any LED lights or indicators on your device. Are you seeing any lights at all?",
            "expected_response": "yes or no to LED indicators",
            "next_step_success": 5,
            "next_step_failure": 4
        },
        {
            "step": 4,
            "instruction": "It appears there may be a hardware issue with your device. To proceed with warranty or repair options, I''ll need your device''s serial number. Can you provide that?",
            "expected_response": "serial number",
            "next_step_success": -1,
            "next_step_failure": -1
        }
    ]',
    10
),
(
    'connection|connect|wifi|network|bluetooth|pairing',
    NULL,
    'Connectivity Issues',
    'Guide for connection and network problems',
    '[
        {
            "step": 1,
            "instruction": "I can help you with connection issues. First, what type of connection are you trying to establish - WiFi, Bluetooth, or USB?",
            "expected_response": "connection type specified",
            "next_step_success": 2,
            "next_step_failure": 2
        },
        {
            "step": 2,
            "instruction": "Let''s start by restarting your device and the device you''re trying to connect to. Please power both devices off for 10 seconds, then power them back on.",
            "expected_response": "completed restart",
            "next_step_success": 3,
            "next_step_failure": 3
        },
        {
            "step": 3,
            "instruction": "Now try the connection again. Did this resolve the issue?",
            "expected_response": "yes or no",
            "next_step_success": 0,
            "next_step_failure": 4
        }
    ]',
    8
);

-- ==========================================
-- INDEXES AND TRIGGERS
-- ==========================================

-- Trigger to update context cache when messages are added
CREATE TRIGGER TR_Messages_UpdateContextCache
    ON Messages
    AFTER INSERT
AS
BEGIN
    SET NOCOUNT ON;
    
    -- Mark context cache as needing refresh for affected tickets
    UPDATE ticket_context_cache
    SET needs_refresh = 1,
        last_updated = GETUTCDATE()
    WHERE ticket_id IN (SELECT DISTINCT ticket_id FROM inserted);
    
    -- Insert context cache record if it doesn't exist
    INSERT INTO ticket_context_cache (ticket_id, needs_refresh)
    SELECT DISTINCT i.ticket_id, 1
    FROM inserted i
    WHERE NOT EXISTS (
        SELECT 1 FROM ticket_context_cache tcc 
        WHERE tcc.ticket_id = i.ticket_id
    );
END;

-- Function to get ticket context summary (can be called from application)
-- Note: This would be implemented in the application layer as stored procedures
-- are more complex in this context. The structure is provided for reference.

PRINT 'AI Context and Intelligence tables created successfully!'; 
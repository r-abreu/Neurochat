-- Migration: Add AI Summarization Fields to Tickets Table
-- Run this migration against your Azure SQL Database

USE NeuroChat;
GO

-- Add resolution summary fields to Tickets table
ALTER TABLE Tickets ADD 
    resolution_summary NVARCHAR(MAX) NULL,
    resolution_summary_generated_at DATETIME2 NULL,
    resolution_summary_model_version NVARCHAR(50) NULL,
    resolution_summary_generated_by UNIQUEIDENTIFIER NULL;

-- Add foreign key constraint for who generated the summary
ALTER TABLE Tickets ADD CONSTRAINT FK_Tickets_SummaryGeneratedBy 
    FOREIGN KEY (resolution_summary_generated_by) REFERENCES Users(user_id);

-- Add index for performance when searching/filtering by summary status
CREATE INDEX IX_Tickets_ResolutionSummary ON Tickets (resolution_summary_generated_at) 
WHERE resolution_summary IS NOT NULL;

PRINT 'Migration completed: Added resolution summary fields to Tickets table'; 
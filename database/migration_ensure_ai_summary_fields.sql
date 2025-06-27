-- Migration: Ensure AI Summary Fields are Present in Tickets Table
-- This migration checks and adds the resolution summary fields if they don't exist
-- Run this migration against your Azure SQL Database

USE NeuroChat;
GO

-- Check if the columns exist and add them if they don't
IF NOT EXISTS (SELECT * FROM sys.columns WHERE object_id = OBJECT_ID('Tickets') AND name = 'resolution_summary')
BEGIN
    ALTER TABLE Tickets ADD resolution_summary NVARCHAR(MAX) NULL;
    PRINT 'Added resolution_summary column to Tickets table';
END
ELSE
BEGIN
    PRINT 'resolution_summary column already exists in Tickets table';
END

IF NOT EXISTS (SELECT * FROM sys.columns WHERE object_id = OBJECT_ID('Tickets') AND name = 'resolution_summary_generated_at')
BEGIN
    ALTER TABLE Tickets ADD resolution_summary_generated_at DATETIME2 NULL;
    PRINT 'Added resolution_summary_generated_at column to Tickets table';
END
ELSE
BEGIN
    PRINT 'resolution_summary_generated_at column already exists in Tickets table';
END

IF NOT EXISTS (SELECT * FROM sys.columns WHERE object_id = OBJECT_ID('Tickets') AND name = 'resolution_summary_model_version')
BEGIN
    ALTER TABLE Tickets ADD resolution_summary_model_version NVARCHAR(50) NULL;
    PRINT 'Added resolution_summary_model_version column to Tickets table';
END
ELSE
BEGIN
    PRINT 'resolution_summary_model_version column already exists in Tickets table';
END

IF NOT EXISTS (SELECT * FROM sys.columns WHERE object_id = OBJECT_ID('Tickets') AND name = 'resolution_summary_generated_by')
BEGIN
    ALTER TABLE Tickets ADD resolution_summary_generated_by UNIQUEIDENTIFIER NULL;
    PRINT 'Added resolution_summary_generated_by column to Tickets table';
END
ELSE
BEGIN
    PRINT 'resolution_summary_generated_by column already exists in Tickets table';
END

-- Add foreign key constraint for who generated the summary (only if it doesn't exist)
IF NOT EXISTS (SELECT * FROM sys.foreign_keys WHERE name = 'FK_Tickets_SummaryGeneratedBy')
BEGIN
    ALTER TABLE Tickets ADD CONSTRAINT FK_Tickets_SummaryGeneratedBy 
        FOREIGN KEY (resolution_summary_generated_by) REFERENCES Users(user_id);
    PRINT 'Added foreign key constraint FK_Tickets_SummaryGeneratedBy';
END
ELSE
BEGIN
    PRINT 'Foreign key constraint FK_Tickets_SummaryGeneratedBy already exists';
END

-- Add index for performance when searching/filtering by summary status (only if it doesn't exist)
IF NOT EXISTS (SELECT * FROM sys.indexes WHERE name = 'IX_Tickets_ResolutionSummary')
BEGIN
    CREATE INDEX IX_Tickets_ResolutionSummary ON Tickets (resolution_summary_generated_at) 
    WHERE resolution_summary IS NOT NULL;
    PRINT 'Added index IX_Tickets_ResolutionSummary';
END
ELSE
BEGIN
    PRINT 'Index IX_Tickets_ResolutionSummary already exists';
END

PRINT 'Migration completed: AI Summary fields are now properly configured in Tickets table'; 
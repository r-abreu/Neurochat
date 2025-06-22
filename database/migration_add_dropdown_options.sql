-- Migration: Add configurable dropdown options tables
-- This migration creates tables to manage dropdown options for Device Models and Customer Types
-- Categories already exist in the main schema

-- ==========================================
-- DEVICE MODELS TABLE
-- ==========================================

CREATE TABLE DeviceModels (
    model_id UNIQUEIDENTIFIER PRIMARY KEY DEFAULT NEWID(),
    model_name NVARCHAR(50) UNIQUE NOT NULL,
    description NVARCHAR(200),
    is_active BIT DEFAULT 1,
    display_order INT DEFAULT 0,
    created_at DATETIME2 DEFAULT GETUTCDATE(),
    updated_at DATETIME2 DEFAULT GETUTCDATE(),
    
    INDEX IX_DeviceModels_Name (model_name),
    INDEX IX_DeviceModels_Active (is_active),
    INDEX IX_DeviceModels_Order (display_order)
);

-- Insert default device models
INSERT INTO DeviceModels (model_name, description, display_order) VALUES
('BWIII', 'BrainWave III Device', 1),
('BWMini', 'BrainWave Mini Device', 2),
('Compass', 'Compass Navigation Device', 3),
('Maxxi', 'Maxxi Advanced Device', 4);

-- ==========================================
-- CUSTOMER TYPES TABLE
-- ==========================================

CREATE TABLE CustomerTypes (
    type_id UNIQUEIDENTIFIER PRIMARY KEY DEFAULT NEWID(),
    type_name NVARCHAR(50) UNIQUE NOT NULL,
    description NVARCHAR(200),
    color_code NVARCHAR(7) DEFAULT '#6c757d', -- Hex color for UI display
    is_active BIT DEFAULT 1,
    display_order INT DEFAULT 0,
    created_at DATETIME2 DEFAULT GETUTCDATE(),
    updated_at DATETIME2 DEFAULT GETUTCDATE(),
    
    INDEX IX_CustomerTypes_Name (type_name),
    INDEX IX_CustomerTypes_Active (is_active),
    INDEX IX_CustomerTypes_Order (display_order)
);

-- Insert default customer types
INSERT INTO CustomerTypes (type_name, description, color_code, display_order) VALUES
('Standard', 'Standard support level customer', '#6c757d', 1),
('VIP', 'VIP customer with priority support', '#ffc107', 2),
('Distributor', 'Product distributor with special support', '#6f42c1', 3);

-- ==========================================
-- UPDATE CONSTRAINTS (Remove hardcoded constraints)
-- ==========================================

-- Note: We'll keep the existing CHECK constraints in the Tickets table for now
-- to maintain compatibility, but the UI will use the new configurable tables

-- Add audit triggers for tracking changes
CREATE TRIGGER TR_DeviceModels_UpdateTimestamp
ON DeviceModels
AFTER UPDATE
AS
BEGIN
    UPDATE DeviceModels 
    SET updated_at = GETUTCDATE()
    WHERE model_id IN (SELECT model_id FROM INSERTED);
END;

CREATE TRIGGER TR_CustomerTypes_UpdateTimestamp
ON CustomerTypes
AFTER UPDATE
AS
BEGIN
    UPDATE CustomerTypes 
    SET updated_at = GETUTCDATE()
    WHERE type_id IN (SELECT type_id FROM INSERTED);
END; 
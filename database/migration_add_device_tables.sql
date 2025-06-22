-- Migration: Add Device Management Tables
-- This migration adds support for device tracking and linking to tickets and customers

-- ==========================================
-- DEVICES TABLE
-- ==========================================
CREATE TABLE Devices (
    device_id UNIQUEIDENTIFIER PRIMARY KEY DEFAULT NEWID(),
    customer_id UNIQUEIDENTIFIER NOT NULL,
    model NVARCHAR(100) NOT NULL,
    serial_number NVARCHAR(100) UNIQUE NOT NULL,
    warranty_expires DATE NULL,
    invoice_number NVARCHAR(100) NULL,
    invoice_date DATE NULL,
    comments NVARCHAR(MAX) NULL,
    created_at DATETIME2 DEFAULT GETUTCDATE(),
    updated_at DATETIME2 DEFAULT GETUTCDATE(),
    
    -- Foreign keys
    FOREIGN KEY (customer_id) REFERENCES Users(user_id),
    
    -- Indexes
    INDEX IX_Devices_CustomerId (customer_id),
    INDEX IX_Devices_Model (model),
    INDEX IX_Devices_SerialNumber (serial_number),
    INDEX IX_Devices_WarrantyExpires (warranty_expires),
    INDEX IX_Devices_CreatedAt (created_at)
);

-- ==========================================
-- TICKET_DEVICES TABLE (Many-to-Many Relationship)
-- ==========================================
CREATE TABLE TicketDevices (
    ticket_id UNIQUEIDENTIFIER NOT NULL,
    device_id UNIQUEIDENTIFIER NOT NULL,
    linked_at DATETIME2 DEFAULT GETUTCDATE(),
    linked_by UNIQUEIDENTIFIER NULL, -- User who linked the device
    
    -- Composite primary key
    PRIMARY KEY (ticket_id, device_id),
    
    -- Foreign keys
    FOREIGN KEY (ticket_id) REFERENCES Tickets(ticket_id) ON DELETE CASCADE,
    FOREIGN KEY (device_id) REFERENCES Devices(device_id) ON DELETE CASCADE,
    FOREIGN KEY (linked_by) REFERENCES Users(user_id),
    
    -- Indexes
    INDEX IX_TicketDevices_TicketId (ticket_id),
    INDEX IX_TicketDevices_DeviceId (device_id),
    INDEX IX_TicketDevices_LinkedAt (linked_at)
);

-- ==========================================
-- ADD TRIGGER FOR AUTOMATIC DEVICE CREATION
-- ==========================================
-- This trigger will automatically create devices when tickets are created/updated with device information
CREATE TRIGGER TR_Tickets_AutoCreateDevice
ON Tickets
AFTER INSERT, UPDATE
AS
BEGIN
    SET NOCOUNT ON;
    
    -- Handle inserted/updated tickets with device information
    INSERT INTO Devices (customer_id, model, serial_number, created_at, updated_at)
    SELECT DISTINCT 
        i.customer_id,
        i.device_model,
        i.device_serial_number,
        GETUTCDATE(),
        GETUTCDATE()
    FROM inserted i
    WHERE i.device_model IS NOT NULL 
      AND i.device_serial_number IS NOT NULL
      AND i.device_serial_number != ''
      AND NOT EXISTS (
          SELECT 1 FROM Devices d 
          WHERE d.serial_number = i.device_serial_number
      );
    
    -- Link tickets to devices
    INSERT INTO TicketDevices (ticket_id, device_id, linked_at)
    SELECT DISTINCT 
        i.ticket_id,
        d.device_id,
        GETUTCDATE()
    FROM inserted i
    INNER JOIN Devices d ON d.serial_number = i.device_serial_number
    WHERE i.device_serial_number IS NOT NULL 
      AND i.device_serial_number != ''
      AND NOT EXISTS (
          SELECT 1 FROM TicketDevices td 
          WHERE td.ticket_id = i.ticket_id AND td.device_id = d.device_id
      );
END;

-- ==========================================
-- SAMPLE DATA
-- ==========================================
-- Add some sample devices for testing
INSERT INTO Devices (customer_id, model, serial_number, warranty_expires, invoice_number, invoice_date, comments) VALUES
(
    (SELECT TOP 1 user_id FROM Users WHERE user_type = 'customer'),
    'BWIII',
    'BW3-2024-001234',
    '2025-12-31',
    'INV-2024-5678',
    '2024-01-15',
    'Initial device purchase - standard warranty'
),
(
    (SELECT TOP 1 user_id FROM Users WHERE user_type = 'customer'),
    'BWMini',
    'BWM-2024-005678',
    '2025-06-30',
    'INV-2024-9012',
    '2024-02-20',
    'Replacement device under warranty'
);

-- Update device permissions in existing roles
-- This assumes the Permissions and RolePermissions tables exist
IF EXISTS (SELECT 1 FROM sys.tables WHERE name = 'Permissions')
BEGIN
    -- Insert device-related permissions
    INSERT INTO Permissions (permission_name, description, category) VALUES
    ('devices.view', 'View device list and details', 'Device Management'),
    ('devices.edit', 'Edit device information', 'Device Management'),
    ('devices.create', 'Create new devices manually', 'Device Management'),
    ('devices.delete', 'Delete devices', 'Device Management');
    
    -- Grant device permissions to Admin role (assuming role_id = 1 for Admin)
    IF EXISTS (SELECT 1 FROM sys.tables WHERE name = 'RolePermissions')
    BEGIN
        INSERT INTO RolePermissions (role_id, permission_id)
        SELECT 
            r.role_id,
            p.permission_id
        FROM Roles r
        CROSS JOIN Permissions p
        WHERE r.role_name = 'Admin'
          AND p.permission_name IN ('devices.view', 'devices.edit', 'devices.create', 'devices.delete')
          AND NOT EXISTS (
              SELECT 1 FROM RolePermissions rp 
              WHERE rp.role_id = r.role_id AND rp.permission_id = p.permission_id
          );
    END
END

PRINT 'Device Management tables and triggers created successfully!'; 
-- Migration: Add device information fields to Tickets table
-- Date: 2025-01-20
-- Description: Add device_model and device_serial_number fields for device tracking

-- Add device_model column to Tickets table
ALTER TABLE Tickets 
ADD device_model NVARCHAR(20) CHECK (device_model IN ('BWIII', 'BWMini', 'Compass', 'Maxxi'));

-- Add device_serial_number column to Tickets table
ALTER TABLE Tickets 
ADD device_serial_number NVARCHAR(100);

-- Add index for device_model for efficient filtering
CREATE INDEX IX_Tickets_DeviceModel ON Tickets(device_model);

-- Add index for device_serial_number for efficient searching
CREATE INDEX IX_Tickets_DeviceSerialNumber ON Tickets(device_serial_number);

-- Add comment for documentation
EXEC sp_addextendedproperty 
    @name = N'MS_Description', 
    @value = N'Device model: BWIII, BWMini, Compass, or Maxxi', 
    @level0type = N'Schema', @level0name = 'dbo',
    @level1type = N'Table', @level1name = 'Tickets',
    @level2type = N'Column', @level2name = 'device_model';

EXEC sp_addextendedproperty 
    @name = N'MS_Description', 
    @value = N'Serial number of the device associated with this ticket', 
    @level0type = N'Schema', @level0name = 'dbo',
    @level1type = N'Table', @level1name = 'Tickets',
    @level2type = N'Column', @level2name = 'device_serial_number';

-- Migration: Add company_id field to Devices table
-- This fixes the missing direct relationship between Companies and Devices

-- ==========================================
-- ADD COMPANY_ID TO DEVICES TABLE
-- ==========================================

-- Add company_id foreign key to Devices table
ALTER TABLE Devices ADD company_id UNIQUEIDENTIFIER NULL;
ALTER TABLE Devices ADD CONSTRAINT FK_Devices_Company FOREIGN KEY (company_id) REFERENCES Companies(company_id);
CREATE INDEX IX_Devices_CompanyId ON Devices(company_id);

-- ==========================================
-- UPDATE EXISTING DEVICES WITH COMPANY_ID
-- ==========================================

-- Update existing devices to inherit company_id from their customers
UPDATE d
SET d.company_id = u.company_id
FROM Devices d
INNER JOIN Users u ON d.customer_id = u.user_id
WHERE u.company_id IS NOT NULL;

-- ==========================================
-- UPDATE DEVICE PERMISSIONS TO INCLUDE COMPANY CONTEXT
-- ==========================================

-- Update the device trigger to also set company_id when auto-creating devices
-- This modifies the existing trigger in migration_add_device_tables.sql
DROP TRIGGER IF EXISTS TR_Tickets_AutoCreateDevice;

CREATE TRIGGER TR_Tickets_AutoCreateDevice
ON Tickets
AFTER INSERT, UPDATE
AS
BEGIN
    SET NOCOUNT ON;
    
    -- Handle inserted/updated tickets with device information
    INSERT INTO Devices (customer_id, company_id, model, serial_number, created_at, updated_at)
    SELECT DISTINCT 
        i.customer_id,
        COALESCE(i.company_id, u.company_id), -- Use ticket's company_id or customer's company_id
        i.device_model,
        i.device_serial_number,
        GETUTCDATE(),
        GETUTCDATE()
    FROM inserted i
    LEFT JOIN Users u ON i.customer_id = u.user_id
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
-- UPDATE COMPANY STATISTICS VIEW
-- ==========================================

-- Update the CompanyStatistics view to include device counts directly
DROP VIEW IF EXISTS CompanyStatistics;

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
    
    -- Device counts (now direct relationship)
    COUNT(DISTINCT d.device_id) as total_devices,
    COUNT(DISTINCT CASE WHEN d.warranty_expires > GETUTCDATE() THEN d.device_id END) as active_warranties,
    COUNT(DISTINCT CASE WHEN d.warranty_expires <= GETUTCDATE() THEN d.device_id END) as expired_warranties,
    
    -- Latest activity
    MAX(t.created_at) as last_ticket_date,
    MAX(u.last_login) as last_customer_login,
    MAX(d.created_at) as last_device_added
    
FROM Companies c
LEFT JOIN Users u ON c.company_id = u.company_id AND u.user_type = 'customer'
LEFT JOIN Tickets t ON c.company_id = t.company_id
LEFT JOIN Devices d ON c.company_id = d.company_id
WHERE c.is_active = 1
GROUP BY c.company_id, c.name, c.country, c.created_at;

PRINT 'Device-Company relationship established successfully!'; 
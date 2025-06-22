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
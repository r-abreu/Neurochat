-- Migration: Add customer_type field to Tickets table
-- Date: 2025-01-20
-- Description: Add customer_type field to support Standard, VIP, and Distributor customer types

-- Add customer_type column to Tickets table
ALTER TABLE Tickets 
ADD customer_type NVARCHAR(20) DEFAULT 'Standard' CHECK (customer_type IN ('Standard', 'VIP', 'Distributor'));

-- Add index for customer_type for efficient filtering
CREATE INDEX IX_Tickets_CustomerType ON Tickets(customer_type);

-- Update existing tickets to have Standard as default customer type
UPDATE Tickets 
SET customer_type = 'Standard' 
WHERE customer_type IS NULL; 
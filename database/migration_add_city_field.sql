-- Migration script to add customer_city field to Tickets table
-- Run this script to add the city field to existing database

-- Add customer_city column to Tickets table
ALTER TABLE Tickets 
ADD customer_city NVARCHAR(100) NULL;

-- Add index for the new customer_city field for performance
CREATE INDEX IX_Tickets_CustomerCity ON Tickets(customer_city);

PRINT 'Successfully added customer_city field to Tickets table';
PRINT 'Added field: customer_city NVARCHAR(100) NULL';
PRINT 'Created index: IX_Tickets_CustomerCity'; 
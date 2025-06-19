-- Migration script to add customer_address field to Tickets table
-- Run this script to add the address field to existing database

-- Add customer_address column to Tickets table
ALTER TABLE Tickets 
ADD customer_address NVARCHAR(500) NULL;

-- Add index for the new customer_address field if needed for search/reporting
-- CREATE INDEX IX_Tickets_CustomerAddress ON Tickets(customer_address);

-- Optional: Update existing tickets with sample addresses for testing
-- (Remove this section in production)
-- UPDATE Tickets 
-- SET customer_address = 'Sample Address' 
-- WHERE customer_address IS NULL AND isAnonymous = 1;

PRINT 'Successfully added customer_address field to Tickets table'; 
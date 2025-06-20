-- Migration script to split customer_address field into separate components
-- Run this script to add separate address fields to the Tickets table

-- Add new address fields to Tickets table
ALTER TABLE Tickets 
ADD customer_street_address NVARCHAR(500) NULL;

ALTER TABLE Tickets 
ADD customer_state NVARCHAR(100) NULL;

ALTER TABLE Tickets 
ADD customer_zip_code NVARCHAR(20) NULL;

ALTER TABLE Tickets 
ADD customer_country NVARCHAR(100) NULL;

-- Add indexes for the new fields for performance
CREATE INDEX IX_Tickets_CustomerCountry ON Tickets(customer_country);
CREATE INDEX IX_Tickets_CustomerState ON Tickets(customer_state);

-- Optional: Migrate existing address data (basic parsing example)
-- This is a simple approach - in production you might want more sophisticated parsing
UPDATE Tickets 
SET 
  customer_street_address = customer_address,
  customer_country = 'United States'  -- Default country for existing records
WHERE customer_address IS NOT NULL 
  AND customer_street_address IS NULL;

PRINT 'Successfully added separate address fields to Tickets table';
PRINT 'Added fields: customer_street_address, customer_state, customer_zip_code, customer_country';
PRINT 'Note: Existing address data has been migrated to street_address field with default country'; 
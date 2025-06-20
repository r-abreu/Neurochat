-- Migration script to add avatar field to Users table
-- Run this script to add the avatar field to existing database

-- Add avatar_url column to Users table
ALTER TABLE Users 
ADD avatar_url NVARCHAR(500) NULL;

-- Add index for the new avatar_url field if needed for performance
-- CREATE INDEX IX_Users_AvatarUrl ON Users(avatar_url);

-- Optional: Set default avatar for existing users
-- UPDATE Users 
-- SET avatar_url = NULL 
-- WHERE avatar_url IS NULL;

PRINT 'Successfully added avatar_url field to Users table'; 
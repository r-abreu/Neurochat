-- Migration to add customer and insights permissions
-- Run this script to update existing database with new permissions

-- Add new permissions if they don't exist
IF NOT EXISTS (SELECT 1 FROM Permissions WHERE permission_name = 'customers.view')
BEGIN
    INSERT INTO Permissions (permission_name, description, category) VALUES
    ('customers.view', 'View customer management', 'customers');
END

IF NOT EXISTS (SELECT 1 FROM Permissions WHERE permission_name = 'customers.create')
BEGIN
    INSERT INTO Permissions (permission_name, description, category) VALUES
    ('customers.create', 'Create new customers', 'customers');
END

IF NOT EXISTS (SELECT 1 FROM Permissions WHERE permission_name = 'customers.edit')
BEGIN
    INSERT INTO Permissions (permission_name, description, category) VALUES
    ('customers.edit', 'Edit existing customers', 'customers');
END

IF NOT EXISTS (SELECT 1 FROM Permissions WHERE permission_name = 'customers.delete')
BEGIN
    INSERT INTO Permissions (permission_name, description, category) VALUES
    ('customers.delete', 'Delete customers', 'customers');
END

IF NOT EXISTS (SELECT 1 FROM Permissions WHERE permission_name = 'insights.view')
BEGIN
    INSERT INTO Permissions (permission_name, description, category) VALUES
    ('insights.view', 'View insights and analytics', 'insights');
END

-- Add customer permissions to Admin role
INSERT INTO RolePermissions (role_id, permission_id)
SELECT r.role_id, p.permission_id 
FROM Roles r, Permissions p 
WHERE r.role_name = 'Admin'
AND p.permission_name IN ('customers.view', 'customers.create', 'customers.edit', 'customers.delete', 'insights.view')
AND NOT EXISTS (
    SELECT 1 FROM RolePermissions rp2 
    WHERE rp2.role_id = r.role_id AND rp2.permission_id = p.permission_id
);

-- Add customer permissions to Tier2 role
INSERT INTO RolePermissions (role_id, permission_id)
SELECT r.role_id, p.permission_id 
FROM Roles r, Permissions p 
WHERE r.role_name = 'Tier2'
AND p.permission_name IN ('customers.view', 'customers.edit', 'insights.view')
AND NOT EXISTS (
    SELECT 1 FROM RolePermissions rp2 
    WHERE rp2.role_id = r.role_id AND rp2.permission_id = p.permission_id
);

PRINT 'Customer and insights permissions have been added successfully!'; 
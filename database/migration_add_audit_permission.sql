-- Migration to add audit.view permission
-- Run this after the main schema.sql

-- Add the audit.view permission
INSERT INTO Permissions (permission_name, description, category) VALUES
('audit.view', 'View audit trail logs', 'audit');

-- Get the permission ID for audit.view
DECLARE @auditPermissionId UNIQUEIDENTIFIER;
SELECT @auditPermissionId = permission_id FROM Permissions WHERE permission_name = 'audit.view';

-- Add audit.view permission to Admin role
INSERT INTO RolePermissions (role_id, permission_id)
SELECT r.role_id, @auditPermissionId 
FROM Roles r 
WHERE r.role_name = 'Admin';

-- Add audit.view permission to Tier2 role
INSERT INTO RolePermissions (role_id, permission_id)
SELECT r.role_id, @auditPermissionId 
FROM Roles r 
WHERE r.role_name = 'Tier2';

-- Verify the migration
SELECT 
    r.role_name,
    p.permission_name,
    p.description
FROM Roles r
JOIN RolePermissions rp ON r.role_id = rp.role_id
JOIN Permissions p ON rp.permission_id = p.permission_id
WHERE p.permission_name = 'audit.view'
ORDER BY r.role_name; 
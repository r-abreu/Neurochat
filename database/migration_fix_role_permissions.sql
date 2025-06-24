-- Migration to fix role management permissions
-- This migration adds missing system permissions and fixes role assignments

-- Add missing system permissions
INSERT INTO Permissions (permission_name, description, category) VALUES
('system.management', 'Full system management access', 'system'),
('system.settings', 'System settings management', 'system'),
('system.ai_settings', 'AI system settings management', 'system'),
('system.user_management', 'User management access', 'system'),
('system.role_management', 'Role management access', 'system'),
('devices.view', 'View device management', 'devices'),
('devices.create', 'Create new devices', 'devices'),
('devices.edit', 'Edit existing devices', 'devices'),
('devices.delete', 'Delete devices', 'devices'),
('companies.view', 'View company management', 'companies'),
('companies.create', 'Create new companies', 'companies'),
('companies.edit', 'Edit existing companies', 'companies'),
('companies.delete', 'Delete companies', 'companies');

-- Clear existing role permissions to rebuild them properly
DELETE FROM RolePermissions;

-- Admin gets all permissions (including the new ones)
INSERT INTO RolePermissions (role_id, permission_id)
SELECT r.role_id, p.permission_id 
FROM Roles r, Permissions p 
WHERE r.role_name = 'Admin';

-- Tier2 gets ticket, user management (but NOT role management), customer, device, and insights permissions
INSERT INTO RolePermissions (role_id, permission_id)
SELECT r.role_id, p.permission_id 
FROM Roles r, Permissions p 
WHERE r.role_name = 'Tier2' 
AND p.permission_name IN (
    'tickets.create', 
    'tickets.edit', 
    'tickets.view',
    'system.user_management',  -- Can manage users
    'users.access',           -- Can access user management
    'users.create',           -- Can create users
    'users.edit',             -- Can edit users
    'customers.view', 
    'customers.edit',
    'customers.create',
    'devices.view',
    'devices.edit', 
    'devices.create',
    'companies.view',
    'companies.edit',
    'companies.create',
    'insights.view',
    'audit.view'
);

-- Tier1 gets basic ticket permissions and view access to customers/devices
INSERT INTO RolePermissions (role_id, permission_id)
SELECT r.role_id, p.permission_id 
FROM Roles r, Permissions p 
WHERE r.role_name = 'Tier1' 
AND p.permission_name IN (
    'tickets.create', 
    'tickets.edit', 
    'tickets.view',
    'customers.view',
    'devices.view',
    'companies.view'
);

-- Viewer gets read-only access
INSERT INTO RolePermissions (role_id, permission_id)
SELECT r.role_id, p.permission_id 
FROM Roles r, Permissions p 
WHERE r.role_name = 'Viewer' 
AND p.permission_name IN (
    'tickets.view',
    'customers.view',
    'devices.view',
    'companies.view'
);

-- Note: Only Admin role will have system.role_management permission
-- This ensures that only Admin users can access Role Management functionality 
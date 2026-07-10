-- Task 20/21: admin-handled password resets get their own permission key so
-- the action can be granted independently of users.edit. Granted to every
-- business's SuperAdmin role (roles are per-business; same pattern as 0019).
INSERT INTO permissions (module, action, key) VALUES
('users', 'resetPassword', 'users.resetPassword');

INSERT INTO role_permissions (role_id, permission_id)
SELECT r.id, p.id
FROM roles r
CROSS JOIN permissions p
WHERE r.name = 'SuperAdmin' AND p.key = 'users.resetPassword';

INSERT INTO permissions (module, action, key) VALUES
('categories', 'view', 'categories.view'), ('categories', 'create', 'categories.create'),
('categories', 'edit', 'categories.edit'), ('categories', 'delete', 'categories.delete');

INSERT INTO role_permissions (role_id, permission_id)
SELECT r.id, p.id
FROM roles r
CROSS JOIN permissions p
WHERE r.name = 'SuperAdmin' AND p.key IN ('categories.view', 'categories.create', 'categories.edit', 'categories.delete');

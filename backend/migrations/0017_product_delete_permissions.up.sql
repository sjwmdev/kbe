INSERT INTO permissions (module, action, key) VALUES
('products', 'forceDelete', 'products.forceDelete'),
('products', 'restore', 'products.restore');

INSERT INTO role_permissions (role_id, permission_id)
SELECT r.id, p.id
FROM roles r
CROSS JOIN permissions p
WHERE r.name = 'SuperAdmin' AND p.key IN ('products.forceDelete', 'products.restore');

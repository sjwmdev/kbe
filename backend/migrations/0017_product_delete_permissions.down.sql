DELETE FROM role_permissions
WHERE permission_id IN (SELECT id FROM permissions WHERE key IN ('products.forceDelete', 'products.restore'));

DELETE FROM permissions WHERE key IN ('products.forceDelete', 'products.restore');

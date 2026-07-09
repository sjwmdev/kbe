DELETE FROM role_permissions
WHERE permission_id IN (SELECT id FROM permissions WHERE key IN ('categories.view', 'categories.create', 'categories.edit', 'categories.delete'));

DELETE FROM permissions WHERE key IN ('categories.view', 'categories.create', 'categories.edit', 'categories.delete');

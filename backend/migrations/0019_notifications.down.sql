DELETE FROM role_permissions
WHERE permission_id IN (SELECT id FROM permissions WHERE key IN ('notifications.view', 'notifications.manage'));
DELETE FROM permissions WHERE key IN ('notifications.view', 'notifications.manage');

DROP TABLE IF EXISTS notifications;

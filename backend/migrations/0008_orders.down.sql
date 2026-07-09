DELETE FROM role_permissions WHERE permission_id IN (SELECT id FROM permissions WHERE key IN ('orders.view', 'orders.create', 'orders.edit'));
DELETE FROM permissions WHERE key IN ('orders.view', 'orders.create', 'orders.edit');

DROP TABLE IF EXISTS order_items;
DROP TABLE IF EXISTS orders;
DROP TABLE IF EXISTS customers;

ALTER TABLE products DROP COLUMN IF EXISTS low_stock_threshold;
ALTER TABLE products DROP COLUMN IF EXISTS stock_quantity;

-- A minimal, category-based notification store. Deliberately generic (not
-- "low_stock_alerts") so later categories (password_reset_request, order,
-- user, system) reuse this same table instead of needing their own.
CREATE TABLE notifications (
    id           UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    business_id  UUID NOT NULL REFERENCES businesses(id) ON DELETE CASCADE,
    category     VARCHAR(50) NOT NULL,
    message      TEXT NOT NULL,
    link_url     VARCHAR(1024) NOT NULL DEFAULT '',
    reference_id UUID,
    is_read      BOOLEAN NOT NULL DEFAULT false,
    is_resolved  BOOLEAN NOT NULL DEFAULT false,
    created_at   TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at   TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX idx_notifications_business_id ON notifications (business_id);
CREATE INDEX idx_notifications_category ON notifications (business_id, category);
CREATE INDEX idx_notifications_unresolved_ref ON notifications (business_id, category, reference_id) WHERE is_resolved = false;

INSERT INTO permissions (module, action, key) VALUES
('notifications', 'view', 'notifications.view'),
('notifications', 'manage', 'notifications.manage');

INSERT INTO role_permissions (role_id, permission_id)
SELECT r.id, p.id
FROM roles r
CROSS JOIN permissions p
WHERE r.name = 'SuperAdmin' AND p.key IN ('notifications.view', 'notifications.manage');

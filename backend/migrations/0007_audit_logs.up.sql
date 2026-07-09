CREATE TABLE audit_logs (
    id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id     UUID REFERENCES users(id) ON DELETE SET NULL,
    username    VARCHAR(255) NOT NULL DEFAULT '',
    method      VARCHAR(10) NOT NULL,
    path        VARCHAR(512) NOT NULL,
    status_code INT NOT NULL,
    duration_ms INT NOT NULL,
    ip_address  VARCHAR(64) NOT NULL DEFAULT '',
    created_at  TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX idx_audit_logs_created_at ON audit_logs (created_at DESC);

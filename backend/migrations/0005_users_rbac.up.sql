ALTER TABLE users
    ADD COLUMN role_id              UUID REFERENCES roles(id),
    ADD COLUMN is_active             BOOLEAN NOT NULL DEFAULT true,
    ADD COLUMN must_change_password  BOOLEAN NOT NULL DEFAULT true,
    ADD COLUMN failed_login_attempts INT NOT NULL DEFAULT 0,
    ADD COLUMN locked_until          TIMESTAMPTZ;

ALTER TABLE users ADD CONSTRAINT users_email_unique UNIQUE (email);

-- Existing admin: already the real operator, not a fresh account — bind to
-- SuperAdmin and don't force a password change on an account already in use.
UPDATE users SET role_id = (SELECT id FROM roles WHERE name = 'SuperAdmin'),
                  must_change_password = false
WHERE username = 'kalour';

ALTER TABLE products ADD COLUMN created_by UUID REFERENCES users(id) ON DELETE SET NULL;
UPDATE products SET created_by = (SELECT id FROM users WHERE username = 'kalour');

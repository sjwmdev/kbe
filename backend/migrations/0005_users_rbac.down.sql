ALTER TABLE products DROP COLUMN IF EXISTS created_by;

ALTER TABLE users DROP CONSTRAINT IF EXISTS users_email_unique;
ALTER TABLE users
    DROP COLUMN IF EXISTS role_id,
    DROP COLUMN IF EXISTS is_active,
    DROP COLUMN IF EXISTS must_change_password,
    DROP COLUMN IF EXISTS failed_login_attempts,
    DROP COLUMN IF EXISTS locked_until;

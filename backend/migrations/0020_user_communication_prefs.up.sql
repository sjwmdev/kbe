-- Task 18: users choose how the business should reach them (dashboard
-- notification, email, or WhatsApp) — consumed by the password-reset
-- messaging flow. Phone doubles as the WhatsApp number.
ALTER TABLE users
    ADD COLUMN phone VARCHAR(32) NOT NULL DEFAULT '',
    ADD COLUMN default_communication_channel VARCHAR(20) NOT NULL DEFAULT 'dashboard'
        CHECK (default_communication_channel IN ('dashboard', 'email', 'whatsapp'));

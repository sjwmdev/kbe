CREATE TABLE roles (
    id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    name        VARCHAR(100) NOT NULL UNIQUE,
    description VARCHAR(255) NOT NULL DEFAULT '',
    created_at  TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at  TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Permissions are a fixed, code-defined set of guardable capabilities (seeded
-- below), not admin-creatable — only which permissions a role HAS is editable.
CREATE TABLE permissions (
    id     UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    module VARCHAR(50) NOT NULL,
    action VARCHAR(50) NOT NULL,
    key    VARCHAR(100) NOT NULL UNIQUE,
    UNIQUE (module, action)
);

CREATE TABLE role_permissions (
    role_id       UUID NOT NULL REFERENCES roles(id) ON DELETE CASCADE,
    permission_id UUID NOT NULL REFERENCES permissions(id) ON DELETE CASCADE,
    PRIMARY KEY (role_id, permission_id)
);

INSERT INTO permissions (module, action, key) VALUES
('products', 'view', 'products.view'), ('products', 'create', 'products.create'),
('products', 'edit', 'products.edit'), ('products', 'delete', 'products.delete'),
('media', 'view', 'media.view'), ('media', 'upload', 'media.upload'), ('media', 'delete', 'media.delete'),
('pages', 'view', 'pages.view'), ('pages', 'edit', 'pages.edit'),
('sliders', 'view', 'sliders.view'), ('sliders', 'create', 'sliders.create'),
('sliders', 'edit', 'sliders.edit'), ('sliders', 'delete', 'sliders.delete'),
('settings', 'view', 'settings.view'), ('settings', 'edit', 'settings.edit'),
('roles', 'view', 'roles.view'), ('roles', 'create', 'roles.create'),
('roles', 'edit', 'roles.edit'), ('roles', 'delete', 'roles.delete'),
('users', 'view', 'users.view'), ('users', 'create', 'users.create'),
('users', 'edit', 'users.edit'), ('users', 'delete', 'users.delete');

INSERT INTO roles (name, description) VALUES
('SuperAdmin', 'Ufikiaji kamili wa mfumo'),
('Manager', 'Anasimamia bidhaa na maudhui'),
('Editor', 'Anahariri maudhui pekee');

INSERT INTO role_permissions (role_id, permission_id)
SELECT (SELECT id FROM roles WHERE name = 'SuperAdmin'), id FROM permissions;

CREATE INDEX idx_role_permissions_role_id ON role_permissions (role_id);

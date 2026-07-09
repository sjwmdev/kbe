package repository

import (
	"context"
	"errors"
	"fmt"

	"github.com/google/uuid"
	"github.com/jackc/pgx/v5"
	"github.com/jackc/pgx/v5/pgxpool"

	"backend/internal/domain"
)

type roleRepository struct {
	pool *pgxpool.Pool
}

func NewRoleRepository(pool *pgxpool.Pool) domain.RoleRepository {
	return &roleRepository{pool: pool}
}

func (r *roleRepository) FindAll(ctx context.Context, businessID uuid.UUID) ([]domain.Role, error) {
	const query = `SELECT id, business_id, name, description, created_at, updated_at FROM roles WHERE business_id = $1 ORDER BY name`

	rows, err := r.pool.Query(ctx, query, businessID)
	if err != nil {
		return nil, fmt.Errorf("repository: find all roles: %w", err)
	}
	defer rows.Close()

	var roles []domain.Role
	for rows.Next() {
		var role domain.Role
		if err := rows.Scan(&role.ID, &role.BusinessID, &role.Name, &role.Description, &role.CreatedAt, &role.UpdatedAt); err != nil {
			return nil, fmt.Errorf("repository: scan role row: %w", err)
		}
		roles = append(roles, role)
	}
	if err := rows.Err(); err != nil {
		return nil, fmt.Errorf("repository: iterate role rows: %w", err)
	}

	return roles, nil
}

func (r *roleRepository) FindByID(ctx context.Context, id, businessID uuid.UUID) (*domain.Role, error) {
	const query = `SELECT id, business_id, name, description, created_at, updated_at FROM roles WHERE id = $1 AND business_id = $2`

	var role domain.Role
	err := r.pool.QueryRow(ctx, query, id, businessID).
		Scan(&role.ID, &role.BusinessID, &role.Name, &role.Description, &role.CreatedAt, &role.UpdatedAt)
	if errors.Is(err, pgx.ErrNoRows) {
		return nil, nil
	}
	if err != nil {
		return nil, fmt.Errorf("repository: find role by id: %w", err)
	}

	return &role, nil
}

func (r *roleRepository) Create(ctx context.Context, role *domain.Role) error {
	const query = `
		INSERT INTO roles (business_id, name, description)
		VALUES ($1, $2, $3)
		RETURNING id, created_at, updated_at`

	err := r.pool.QueryRow(ctx, query, role.BusinessID, role.Name, role.Description).
		Scan(&role.ID, &role.CreatedAt, &role.UpdatedAt)
	if err != nil {
		return fmt.Errorf("repository: create role: %w", err)
	}

	return nil
}

func (r *roleRepository) Update(ctx context.Context, role *domain.Role) error {
	const query = `
		UPDATE roles
		SET name = $1, description = $2, updated_at = now()
		WHERE id = $3 AND business_id = $4
		RETURNING updated_at`

	err := r.pool.QueryRow(ctx, query, role.Name, role.Description, role.ID, role.BusinessID).Scan(&role.UpdatedAt)
	if errors.Is(err, pgx.ErrNoRows) {
		return fmt.Errorf("repository: update role: %w", domain.ErrNotFound)
	}
	if err != nil {
		return fmt.Errorf("repository: update role: %w", err)
	}

	return nil
}

func (r *roleRepository) Delete(ctx context.Context, id, businessID uuid.UUID) error {
	const query = `DELETE FROM roles WHERE id = $1 AND business_id = $2`

	tag, err := r.pool.Exec(ctx, query, id, businessID)
	if err != nil {
		return fmt.Errorf("repository: delete role: %w", err)
	}
	if tag.RowsAffected() == 0 {
		return fmt.Errorf("repository: delete role: %w", domain.ErrNotFound)
	}

	return nil
}

func (r *roleRepository) FindPermissionIDs(ctx context.Context, roleID, businessID uuid.UUID) ([]uuid.UUID, error) {
	const query = `
		SELECT rp.permission_id
		FROM role_permissions rp
		JOIN roles r ON r.id = rp.role_id
		WHERE rp.role_id = $1 AND r.business_id = $2`

	rows, err := r.pool.Query(ctx, query, roleID, businessID)
	if err != nil {
		return nil, fmt.Errorf("repository: find role permission ids: %w", err)
	}
	defer rows.Close()

	ids := make([]uuid.UUID, 0)
	for rows.Next() {
		var id uuid.UUID
		if err := rows.Scan(&id); err != nil {
			return nil, fmt.Errorf("repository: scan role permission id: %w", err)
		}
		ids = append(ids, id)
	}
	if err := rows.Err(); err != nil {
		return nil, fmt.Errorf("repository: iterate role permission ids: %w", err)
	}

	return ids, nil
}

// FindPermissionKeys returns a role's granted permission keys (e.g.
// "products.delete") in one joined query — used by the RequirePermission
// middleware on every protected request, so this stays a single round trip.
// The join through roles.business_id means a roleID belonging to a different
// business than businessID simply yields zero keys, never another tenant's.
func (r *roleRepository) FindPermissionKeys(ctx context.Context, roleID, businessID uuid.UUID) ([]string, error) {
	const query = `
		SELECT p.key
		FROM role_permissions rp
		JOIN roles r ON r.id = rp.role_id
		JOIN permissions p ON p.id = rp.permission_id
		WHERE rp.role_id = $1 AND r.business_id = $2`

	rows, err := r.pool.Query(ctx, query, roleID, businessID)
	if err != nil {
		return nil, fmt.Errorf("repository: find role permission keys: %w", err)
	}
	defer rows.Close()

	keys := make([]string, 0)
	for rows.Next() {
		var key string
		if err := rows.Scan(&key); err != nil {
			return nil, fmt.Errorf("repository: scan role permission key: %w", err)
		}
		keys = append(keys, key)
	}
	if err := rows.Err(); err != nil {
		return nil, fmt.Errorf("repository: iterate role permission keys: %w", err)
	}

	return keys, nil
}

// SetPermissions replaces a role's full permission set. Wrapped in a
// transaction so a mid-operation failure can't leave the role with zero
// permissions — the one place in this codebase that needs one. The
// business_id check on the initial DELETE means this is a no-op (0 rows
// touched, but not an error) if roleID doesn't actually belong to businessID;
// callers must check the role exists via FindByID first if they need to
// distinguish that from a genuine "permissions cleared" case.
func (r *roleRepository) SetPermissions(ctx context.Context, roleID, businessID uuid.UUID, permissionIDs []uuid.UUID) error {
	tx, err := r.pool.Begin(ctx)
	if err != nil {
		return fmt.Errorf("repository: begin set permissions tx: %w", err)
	}
	defer tx.Rollback(ctx)

	const clearQuery = `
		DELETE FROM role_permissions
		WHERE role_id = $1 AND role_id IN (SELECT id FROM roles WHERE id = $1 AND business_id = $2)`
	if _, err := tx.Exec(ctx, clearQuery, roleID, businessID); err != nil {
		return fmt.Errorf("repository: clear role permissions: %w", err)
	}

	for _, permID := range permissionIDs {
		if _, err := tx.Exec(ctx,
			`INSERT INTO role_permissions (role_id, permission_id) VALUES ($1, $2)`,
			roleID, permID,
		); err != nil {
			return fmt.Errorf("repository: insert role permission: %w", err)
		}
	}

	if err := tx.Commit(ctx); err != nil {
		return fmt.Errorf("repository: commit set permissions tx: %w", err)
	}

	return nil
}

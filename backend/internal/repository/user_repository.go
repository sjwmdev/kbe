package repository

import (
	"context"
	"errors"
	"fmt"
	"time"

	"github.com/google/uuid"
	"github.com/jackc/pgx/v5"
	"github.com/jackc/pgx/v5/pgxpool"

	"backend/internal/domain"
)

type userRepository struct {
	pool *pgxpool.Pool
}

func NewUserRepository(pool *pgxpool.Pool) domain.UserRepository {
	return &userRepository{pool: pool}
}

const userColumns = `
	id, business_id, username, name, email, password_hash, role_id, is_active,
	must_change_password, failed_login_attempts, locked_until, created_at, updated_at`

func scanUser(row pgx.Row) (*domain.User, error) {
	var u domain.User
	err := row.Scan(
		&u.ID, &u.BusinessID, &u.Username, &u.Name, &u.Email, &u.PasswordHash, &u.RoleID, &u.IsActive,
		&u.MustChangePassword, &u.FailedLoginAttempts, &u.LockedUntil, &u.CreatedAt, &u.UpdatedAt,
	)
	if errors.Is(err, pgx.ErrNoRows) {
		return nil, nil
	}
	if err != nil {
		return nil, err
	}
	return &u, nil
}

func (r *userRepository) FindByEmail(ctx context.Context, email string) (*domain.User, error) {
	query := fmt.Sprintf(`SELECT %s FROM users WHERE email = $1`, userColumns)

	u, err := scanUser(r.pool.QueryRow(ctx, query, email))
	if err != nil {
		return nil, fmt.Errorf("repository: find user by email: %w", err)
	}
	return u, nil
}

func (r *userRepository) FindByID(ctx context.Context, id, businessID uuid.UUID) (*domain.User, error) {
	query := fmt.Sprintf(`SELECT %s FROM users WHERE id = $1 AND business_id = $2`, userColumns)

	u, err := scanUser(r.pool.QueryRow(ctx, query, id, businessID))
	if err != nil {
		return nil, fmt.Errorf("repository: find user by id: %w", err)
	}
	return u, nil
}

func (r *userRepository) FindAll(ctx context.Context, businessID uuid.UUID) ([]domain.User, error) {
	const query = `
		SELECT
			u.id, u.business_id, u.username, u.name, u.email, u.password_hash, u.role_id, u.is_active,
			u.must_change_password, u.failed_login_attempts, u.locked_until, u.created_at, u.updated_at,
			COALESCE(r.name, '')
		FROM users u
		LEFT JOIN roles r ON r.id = u.role_id
		WHERE u.business_id = $1
		ORDER BY u.name, u.email`

	rows, err := r.pool.Query(ctx, query, businessID)
	if err != nil {
		return nil, fmt.Errorf("repository: find all users: %w", err)
	}
	defer rows.Close()

	var users []domain.User
	for rows.Next() {
		var u domain.User
		if err := rows.Scan(
			&u.ID, &u.BusinessID, &u.Username, &u.Name, &u.Email, &u.PasswordHash, &u.RoleID, &u.IsActive,
			&u.MustChangePassword, &u.FailedLoginAttempts, &u.LockedUntil, &u.CreatedAt, &u.UpdatedAt,
			&u.RoleName,
		); err != nil {
			return nil, fmt.Errorf("repository: scan user row: %w", err)
		}
		users = append(users, u)
	}
	if err := rows.Err(); err != nil {
		return nil, fmt.Errorf("repository: iterate user rows: %w", err)
	}

	return users, nil
}

func (r *userRepository) CountActiveByRole(ctx context.Context, roleID, businessID uuid.UUID) (int, error) {
	const query = `SELECT COUNT(*) FROM users WHERE role_id = $1 AND business_id = $2 AND is_active = true`

	var count int
	if err := r.pool.QueryRow(ctx, query, roleID, businessID).Scan(&count); err != nil {
		return 0, fmt.Errorf("repository: count active users by role: %w", err)
	}
	return count, nil
}

func (r *userRepository) Create(ctx context.Context, user *domain.User) error {
	const query = `
		INSERT INTO users (business_id, username, name, email, password_hash, role_id, must_change_password)
		VALUES ($1, $2, $3, $4, $5, $6, $7)
		RETURNING id, is_active, failed_login_attempts, created_at, updated_at`

	err := r.pool.QueryRow(ctx, query,
		user.BusinessID, user.Username, user.Name, user.Email, user.PasswordHash, user.RoleID, user.MustChangePassword,
	).Scan(&user.ID, &user.IsActive, &user.FailedLoginAttempts, &user.CreatedAt, &user.UpdatedAt)
	if err != nil {
		return fmt.Errorf("repository: create user: %w", err)
	}

	return nil
}

func (r *userRepository) UpdateProfile(ctx context.Context, user *domain.User) error {
	const query = `
		UPDATE users
		SET name = $1, email = $2, updated_at = now()
		WHERE id = $3
		RETURNING updated_at`

	err := r.pool.QueryRow(ctx, query, user.Name, user.Email, user.ID).Scan(&user.UpdatedAt)
	if errors.Is(err, pgx.ErrNoRows) {
		return fmt.Errorf("repository: update user profile: %w", domain.ErrNotFound)
	}
	if err != nil {
		return fmt.Errorf("repository: update user profile: %w", err)
	}

	return nil
}

// UpdateUser is the admin-facing counterpart to UpdateProfile — also sets the
// user's role, which a user can never do to themselves via UpdateProfile.
func (r *userRepository) UpdateUser(ctx context.Context, user *domain.User) error {
	const query = `
		UPDATE users
		SET name = $1, email = $2, role_id = $3, updated_at = now()
		WHERE id = $4 AND business_id = $5
		RETURNING updated_at`

	err := r.pool.QueryRow(ctx, query, user.Name, user.Email, user.RoleID, user.ID, user.BusinessID).Scan(&user.UpdatedAt)
	if errors.Is(err, pgx.ErrNoRows) {
		return fmt.Errorf("repository: update user: %w", domain.ErrNotFound)
	}
	if err != nil {
		return fmt.Errorf("repository: update user: %w", err)
	}

	return nil
}

func (r *userRepository) SetActive(ctx context.Context, id, businessID uuid.UUID, isActive bool) error {
	const query = `UPDATE users SET is_active = $1, updated_at = now() WHERE id = $2 AND business_id = $3`

	tag, err := r.pool.Exec(ctx, query, isActive, id, businessID)
	if err != nil {
		return fmt.Errorf("repository: set user active: %w", err)
	}
	if tag.RowsAffected() == 0 {
		return fmt.Errorf("repository: set user active: %w", domain.ErrNotFound)
	}

	return nil
}

func (r *userRepository) Delete(ctx context.Context, id, businessID uuid.UUID) error {
	const query = `DELETE FROM users WHERE id = $1 AND business_id = $2`

	tag, err := r.pool.Exec(ctx, query, id, businessID)
	if err != nil {
		return fmt.Errorf("repository: delete user: %w", err)
	}
	if tag.RowsAffected() == 0 {
		return fmt.Errorf("repository: delete user: %w", domain.ErrNotFound)
	}

	return nil
}

func (r *userRepository) UpdatePasswordHash(ctx context.Context, id uuid.UUID, passwordHash string) error {
	const query = `UPDATE users SET password_hash = $1, updated_at = now() WHERE id = $2`

	tag, err := r.pool.Exec(ctx, query, passwordHash, id)
	if err != nil {
		return fmt.Errorf("repository: update user password: %w", err)
	}
	if tag.RowsAffected() == 0 {
		return fmt.Errorf("repository: update user password: %w", domain.ErrNotFound)
	}

	return nil
}

func (r *userRepository) SetMustChangePassword(ctx context.Context, id uuid.UUID, value bool) error {
	const query = `UPDATE users SET must_change_password = $1, updated_at = now() WHERE id = $2`

	tag, err := r.pool.Exec(ctx, query, value, id)
	if err != nil {
		return fmt.Errorf("repository: set must change password: %w", err)
	}
	if tag.RowsAffected() == 0 {
		return fmt.Errorf("repository: set must change password: %w", domain.ErrNotFound)
	}

	return nil
}

func (r *userRepository) IncrementFailedAttempts(ctx context.Context, id uuid.UUID) (int, error) {
	const query = `
		UPDATE users SET failed_login_attempts = failed_login_attempts + 1
		WHERE id = $1
		RETURNING failed_login_attempts`

	var attempts int
	if err := r.pool.QueryRow(ctx, query, id).Scan(&attempts); err != nil {
		return 0, fmt.Errorf("repository: increment failed login attempts: %w", err)
	}
	return attempts, nil
}

func (r *userRepository) LockUntil(ctx context.Context, id uuid.UUID, until time.Time) error {
	const query = `UPDATE users SET locked_until = $1 WHERE id = $2`

	if _, err := r.pool.Exec(ctx, query, until, id); err != nil {
		return fmt.Errorf("repository: lock user: %w", err)
	}
	return nil
}

func (r *userRepository) ResetLoginAttempts(ctx context.Context, id uuid.UUID) error {
	const query = `UPDATE users SET failed_login_attempts = 0, locked_until = NULL WHERE id = $1`

	if _, err := r.pool.Exec(ctx, query, id); err != nil {
		return fmt.Errorf("repository: reset login attempts: %w", err)
	}
	return nil
}

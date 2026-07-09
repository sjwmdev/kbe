package repository

import (
	"context"
	"errors"
	"fmt"

	"github.com/google/uuid"
	"github.com/jackc/pgx/v5"
	"github.com/jackc/pgx/v5/pgconn"
	"github.com/jackc/pgx/v5/pgxpool"

	"backend/internal/domain"
)

// foreignKeyViolation is Postgres's SQLSTATE code for a blocked
// ON DELETE RESTRICT — used to translate "a product still uses this
// category" into domain.ErrCategoryInUse instead of a raw DB error leaking
// through as a generic 500.
const foreignKeyViolation = "23503"

type categoryRepository struct {
	pool *pgxpool.Pool
}

func NewCategoryRepository(pool *pgxpool.Pool) domain.CategoryRepository {
	return &categoryRepository{pool: pool}
}

func (r *categoryRepository) FindAll(ctx context.Context, businessID uuid.UUID) ([]domain.Category, error) {
	const query = `
		SELECT id, business_id, name, slug, display_order, created_at, updated_at
		FROM categories
		WHERE business_id = $1
		ORDER BY display_order, name`

	rows, err := r.pool.Query(ctx, query, businessID)
	if err != nil {
		return nil, fmt.Errorf("repository: find all categories: %w", err)
	}
	defer rows.Close()

	var categories []domain.Category
	for rows.Next() {
		var c domain.Category
		if err := rows.Scan(&c.ID, &c.BusinessID, &c.Name, &c.Slug, &c.DisplayOrder, &c.CreatedAt, &c.UpdatedAt); err != nil {
			return nil, fmt.Errorf("repository: scan category row: %w", err)
		}
		categories = append(categories, c)
	}
	if err := rows.Err(); err != nil {
		return nil, fmt.Errorf("repository: iterate category rows: %w", err)
	}

	return categories, nil
}

func (r *categoryRepository) FindByID(ctx context.Context, id, businessID uuid.UUID) (*domain.Category, error) {
	const query = `
		SELECT id, business_id, name, slug, display_order, created_at, updated_at
		FROM categories
		WHERE id = $1 AND business_id = $2`

	var c domain.Category
	err := r.pool.QueryRow(ctx, query, id, businessID).
		Scan(&c.ID, &c.BusinessID, &c.Name, &c.Slug, &c.DisplayOrder, &c.CreatedAt, &c.UpdatedAt)
	if errors.Is(err, pgx.ErrNoRows) {
		return nil, nil
	}
	if err != nil {
		return nil, fmt.Errorf("repository: find category by id: %w", err)
	}

	return &c, nil
}

func (r *categoryRepository) Create(ctx context.Context, category *domain.Category) error {
	const query = `
		INSERT INTO categories (business_id, name, slug, display_order)
		VALUES ($1, $2, $3, $4)
		RETURNING id, created_at, updated_at`

	err := r.pool.QueryRow(ctx, query, category.BusinessID, category.Name, category.Slug, category.DisplayOrder).
		Scan(&category.ID, &category.CreatedAt, &category.UpdatedAt)
	if err != nil {
		return fmt.Errorf("repository: create category: %w", err)
	}

	return nil
}

func (r *categoryRepository) Update(ctx context.Context, category *domain.Category) error {
	const query = `
		UPDATE categories
		SET name = $1, slug = $2, display_order = $3, updated_at = now()
		WHERE id = $4 AND business_id = $5
		RETURNING updated_at`

	err := r.pool.QueryRow(ctx, query,
		category.Name, category.Slug, category.DisplayOrder, category.ID, category.BusinessID,
	).Scan(&category.UpdatedAt)
	if errors.Is(err, pgx.ErrNoRows) {
		return fmt.Errorf("repository: update category: %w", domain.ErrNotFound)
	}
	if err != nil {
		return fmt.Errorf("repository: update category: %w", err)
	}

	return nil
}

func (r *categoryRepository) Delete(ctx context.Context, id, businessID uuid.UUID) error {
	const query = `DELETE FROM categories WHERE id = $1 AND business_id = $2`

	tag, err := r.pool.Exec(ctx, query, id, businessID)
	var pgErr *pgconn.PgError
	if errors.As(err, &pgErr) && pgErr.Code == foreignKeyViolation {
		return domain.ErrCategoryInUse
	}
	if err != nil {
		return fmt.Errorf("repository: delete category: %w", err)
	}
	if tag.RowsAffected() == 0 {
		return fmt.Errorf("repository: delete category: %w", domain.ErrNotFound)
	}

	return nil
}

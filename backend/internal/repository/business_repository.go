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

type businessRepository struct {
	pool *pgxpool.Pool
}

func NewBusinessRepository(pool *pgxpool.Pool) domain.BusinessRepository {
	return &businessRepository{pool: pool}
}

func (r *businessRepository) Create(ctx context.Context, business *domain.Business) error {
	const query = `
		INSERT INTO businesses (name, slug, is_active)
		VALUES ($1, $2, $3)
		RETURNING id, created_at, updated_at`

	err := r.pool.QueryRow(ctx, query, business.Name, business.Slug, business.IsActive).
		Scan(&business.ID, &business.CreatedAt, &business.UpdatedAt)
	if err != nil {
		return fmt.Errorf("repository: create business: %w", err)
	}

	return nil
}

func (r *businessRepository) FindByID(ctx context.Context, id uuid.UUID) (*domain.Business, error) {
	const query = `SELECT id, name, slug, is_active, created_at, updated_at FROM businesses WHERE id = $1`

	var b domain.Business
	err := r.pool.QueryRow(ctx, query, id).Scan(&b.ID, &b.Name, &b.Slug, &b.IsActive, &b.CreatedAt, &b.UpdatedAt)
	if errors.Is(err, pgx.ErrNoRows) {
		return nil, nil
	}
	if err != nil {
		return nil, fmt.Errorf("repository: find business by id: %w", err)
	}

	return &b, nil
}

func (r *businessRepository) FindBySlug(ctx context.Context, slug string) (*domain.Business, error) {
	const query = `SELECT id, name, slug, is_active, created_at, updated_at FROM businesses WHERE slug = $1`

	var b domain.Business
	err := r.pool.QueryRow(ctx, query, slug).Scan(&b.ID, &b.Name, &b.Slug, &b.IsActive, &b.CreatedAt, &b.UpdatedAt)
	if errors.Is(err, pgx.ErrNoRows) {
		return nil, nil
	}
	if err != nil {
		return nil, fmt.Errorf("repository: find business by slug: %w", err)
	}

	return &b, nil
}

func (r *businessRepository) FindAll(ctx context.Context) ([]domain.Business, error) {
	const query = `SELECT id, name, slug, is_active, created_at, updated_at FROM businesses ORDER BY name`

	rows, err := r.pool.Query(ctx, query)
	if err != nil {
		return nil, fmt.Errorf("repository: find all businesses: %w", err)
	}
	defer rows.Close()

	var businesses []domain.Business
	for rows.Next() {
		var b domain.Business
		if err := rows.Scan(&b.ID, &b.Name, &b.Slug, &b.IsActive, &b.CreatedAt, &b.UpdatedAt); err != nil {
			return nil, fmt.Errorf("repository: scan business row: %w", err)
		}
		businesses = append(businesses, b)
	}
	if err := rows.Err(); err != nil {
		return nil, fmt.Errorf("repository: iterate business rows: %w", err)
	}

	return businesses, nil
}

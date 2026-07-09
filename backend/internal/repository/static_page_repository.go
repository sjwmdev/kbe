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

type staticPageRepository struct {
	pool *pgxpool.Pool
}

func NewStaticPageRepository(pool *pgxpool.Pool) domain.StaticPageRepository {
	return &staticPageRepository{pool: pool}
}

func (r *staticPageRepository) FindBySlug(ctx context.Context, slug domain.StaticPageSlug, businessID uuid.UUID) (*domain.StaticPage, error) {
	const query = `SELECT business_id, slug, title, body, updated_at FROM static_pages WHERE slug = $1 AND business_id = $2`

	var p domain.StaticPage
	err := r.pool.QueryRow(ctx, query, slug, businessID).Scan(&p.BusinessID, &p.Slug, &p.Title, &p.Body, &p.UpdatedAt)
	if errors.Is(err, pgx.ErrNoRows) {
		return nil, nil
	}
	if err != nil {
		return nil, fmt.Errorf("repository: find static page by slug: %w", err)
	}

	return &p, nil
}

func (r *staticPageRepository) FindAll(ctx context.Context, businessID uuid.UUID) ([]domain.StaticPage, error) {
	const query = `SELECT business_id, slug, title, body, updated_at FROM static_pages WHERE business_id = $1 ORDER BY slug`

	rows, err := r.pool.Query(ctx, query, businessID)
	if err != nil {
		return nil, fmt.Errorf("repository: find all static pages: %w", err)
	}
	defer rows.Close()

	var pages []domain.StaticPage
	for rows.Next() {
		var p domain.StaticPage
		if err := rows.Scan(&p.BusinessID, &p.Slug, &p.Title, &p.Body, &p.UpdatedAt); err != nil {
			return nil, fmt.Errorf("repository: scan static page row: %w", err)
		}
		pages = append(pages, p)
	}
	if err := rows.Err(); err != nil {
		return nil, fmt.Errorf("repository: iterate static page rows: %w", err)
	}

	return pages, nil
}

// Create inserts one static page row for a newly-provisioned business.
func (r *staticPageRepository) Create(ctx context.Context, page *domain.StaticPage) error {
	const query = `
		INSERT INTO static_pages (business_id, slug, title, body)
		VALUES ($1, $2, $3, $4)
		RETURNING updated_at`

	err := r.pool.QueryRow(ctx, query, page.BusinessID, page.Slug, page.Title, page.Body).Scan(&page.UpdatedAt)
	if err != nil {
		return fmt.Errorf("repository: create static page: %w", err)
	}

	return nil
}

func (r *staticPageRepository) Update(ctx context.Context, page *domain.StaticPage) error {
	const query = `
		UPDATE static_pages
		SET title = $1, body = $2, updated_at = now()
		WHERE slug = $3 AND business_id = $4
		RETURNING updated_at`

	err := r.pool.QueryRow(ctx, query, page.Title, page.Body, page.Slug, page.BusinessID).Scan(&page.UpdatedAt)
	if errors.Is(err, pgx.ErrNoRows) {
		return fmt.Errorf("repository: update static page: %w", domain.ErrNotFound)
	}
	if err != nil {
		return fmt.Errorf("repository: update static page: %w", err)
	}

	return nil
}

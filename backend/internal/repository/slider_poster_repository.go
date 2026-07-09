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

type sliderPosterRepository struct {
	pool *pgxpool.Pool
}

func NewSliderPosterRepository(pool *pgxpool.Pool) domain.SliderPosterRepository {
	return &sliderPosterRepository{pool: pool}
}

func (r *sliderPosterRepository) FindAllActive(ctx context.Context, businessID uuid.UUID) ([]domain.SliderPoster, error) {
	return r.findAll(ctx, businessID, true)
}

func (r *sliderPosterRepository) FindAll(ctx context.Context, businessID uuid.UUID) ([]domain.SliderPoster, error) {
	return r.findAll(ctx, businessID, false)
}

func (r *sliderPosterRepository) findAll(ctx context.Context, businessID uuid.UUID, onlyActive bool) ([]domain.SliderPoster, error) {
	query := `
		SELECT id, business_id, image_url, link_category, display_order, is_active, created_at
		FROM slider_posters
		WHERE business_id = $1`
	if onlyActive {
		query += ` AND is_active = true`
	}
	query += ` ORDER BY display_order, created_at`

	rows, err := r.pool.Query(ctx, query, businessID)
	if err != nil {
		return nil, fmt.Errorf("repository: find all slider posters: %w", err)
	}
	defer rows.Close()

	var posters []domain.SliderPoster
	for rows.Next() {
		var p domain.SliderPoster
		if err := rows.Scan(&p.ID, &p.BusinessID, &p.ImageURL, &p.LinkCategory, &p.DisplayOrder, &p.IsActive, &p.CreatedAt); err != nil {
			return nil, fmt.Errorf("repository: scan slider poster row: %w", err)
		}
		posters = append(posters, p)
	}
	if err := rows.Err(); err != nil {
		return nil, fmt.Errorf("repository: iterate slider poster rows: %w", err)
	}

	return posters, nil
}

func (r *sliderPosterRepository) FindByID(ctx context.Context, id, businessID uuid.UUID) (*domain.SliderPoster, error) {
	const query = `
		SELECT id, business_id, image_url, link_category, display_order, is_active, created_at
		FROM slider_posters
		WHERE id = $1 AND business_id = $2`

	var p domain.SliderPoster
	err := r.pool.QueryRow(ctx, query, id, businessID).
		Scan(&p.ID, &p.BusinessID, &p.ImageURL, &p.LinkCategory, &p.DisplayOrder, &p.IsActive, &p.CreatedAt)
	if errors.Is(err, pgx.ErrNoRows) {
		return nil, nil
	}
	if err != nil {
		return nil, fmt.Errorf("repository: find slider poster by id: %w", err)
	}

	return &p, nil
}

func (r *sliderPosterRepository) Create(ctx context.Context, poster *domain.SliderPoster) error {
	const query = `
		INSERT INTO slider_posters (business_id, image_url, link_category, display_order, is_active)
		VALUES ($1, $2, $3, $4, $5)
		RETURNING id, created_at`

	err := r.pool.QueryRow(ctx, query,
		poster.BusinessID, poster.ImageURL, poster.LinkCategory, poster.DisplayOrder, poster.IsActive,
	).Scan(&poster.ID, &poster.CreatedAt)
	if err != nil {
		return fmt.Errorf("repository: create slider poster: %w", err)
	}

	return nil
}

func (r *sliderPosterRepository) Update(ctx context.Context, poster *domain.SliderPoster) error {
	const query = `
		UPDATE slider_posters
		SET image_url = $1, link_category = $2, display_order = $3, is_active = $4
		WHERE id = $5 AND business_id = $6`

	tag, err := r.pool.Exec(ctx, query,
		poster.ImageURL, poster.LinkCategory, poster.DisplayOrder, poster.IsActive, poster.ID, poster.BusinessID,
	)
	if err != nil {
		return fmt.Errorf("repository: update slider poster: %w", err)
	}
	if tag.RowsAffected() == 0 {
		return fmt.Errorf("repository: update slider poster: %w", domain.ErrNotFound)
	}

	return nil
}

func (r *sliderPosterRepository) Delete(ctx context.Context, id, businessID uuid.UUID) error {
	const query = `DELETE FROM slider_posters WHERE id = $1 AND business_id = $2`

	tag, err := r.pool.Exec(ctx, query, id, businessID)
	if err != nil {
		return fmt.Errorf("repository: delete slider poster: %w", err)
	}
	if tag.RowsAffected() == 0 {
		return fmt.Errorf("repository: delete slider poster: %w", domain.ErrNotFound)
	}

	return nil
}

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

type productImageRepository struct {
	pool *pgxpool.Pool
}

func NewProductImageRepository(pool *pgxpool.Pool) domain.ProductImageRepository {
	return &productImageRepository{pool: pool}
}

func (r *productImageRepository) FindByProductID(ctx context.Context, productID uuid.UUID) ([]domain.ProductImage, error) {
	const query = `
		SELECT id, product_id, image_url, is_primary, media_asset_id
		FROM product_images
		WHERE product_id = $1
		ORDER BY is_primary DESC`

	rows, err := r.pool.Query(ctx, query, productID)
	if err != nil {
		return nil, fmt.Errorf("repository: find images by product id: %w", err)
	}
	defer rows.Close()

	var images []domain.ProductImage
	for rows.Next() {
		var img domain.ProductImage
		if err := rows.Scan(&img.ID, &img.ProductID, &img.ImageURL, &img.IsPrimary, &img.MediaAssetID); err != nil {
			return nil, fmt.Errorf("repository: scan product image row: %w", err)
		}
		images = append(images, img)
	}
	if err := rows.Err(); err != nil {
		return nil, fmt.Errorf("repository: iterate product image rows: %w", err)
	}

	return images, nil
}

func (r *productImageRepository) FindByID(ctx context.Context, id uuid.UUID) (*domain.ProductImage, error) {
	const query = `
		SELECT id, product_id, image_url, is_primary, media_asset_id
		FROM product_images
		WHERE id = $1`

	var img domain.ProductImage
	err := r.pool.QueryRow(ctx, query, id).Scan(&img.ID, &img.ProductID, &img.ImageURL, &img.IsPrimary, &img.MediaAssetID)
	if errors.Is(err, pgx.ErrNoRows) {
		return nil, nil
	}
	if err != nil {
		return nil, fmt.Errorf("repository: find image by id: %w", err)
	}

	return &img, nil
}

func (r *productImageRepository) Create(ctx context.Context, image *domain.ProductImage) error {
	const query = `
		INSERT INTO product_images (product_id, image_url, is_primary, media_asset_id)
		VALUES ($1, $2, $3, $4)
		RETURNING id`

	err := r.pool.QueryRow(ctx, query, image.ProductID, image.ImageURL, image.IsPrimary, image.MediaAssetID).Scan(&image.ID)
	if err != nil {
		return fmt.Errorf("repository: create product image: %w", err)
	}

	return nil
}

func (r *productImageRepository) Delete(ctx context.Context, id uuid.UUID) error {
	const query = `DELETE FROM product_images WHERE id = $1`

	tag, err := r.pool.Exec(ctx, query, id)
	if err != nil {
		return fmt.Errorf("repository: delete product image: %w", err)
	}
	if tag.RowsAffected() == 0 {
		return fmt.Errorf("repository: delete product image: %w", domain.ErrNotFound)
	}

	return nil
}

// SetPrimary marks the given image as the sole primary image for its
// product, demoting any other image of that product in the same statement.
func (r *productImageRepository) SetPrimary(ctx context.Context, id uuid.UUID) error {
	const query = `
		UPDATE product_images
		SET is_primary = (id = $1)
		WHERE product_id = (SELECT product_id FROM product_images WHERE id = $1)`

	if _, err := r.pool.Exec(ctx, query, id); err != nil {
		return fmt.Errorf("repository: set primary product image: %w", err)
	}

	return nil
}

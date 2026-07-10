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

type productLikeRepository struct {
	pool *pgxpool.Pool
}

func NewProductLikeRepository(pool *pgxpool.Pool) domain.ProductLikeRepository {
	return &productLikeRepository{pool: pool}
}

// Increment atomically bumps the like count for a product, creating the
// counter row on first like, and returns the new total.
func (r *productLikeRepository) Increment(ctx context.Context, productID uuid.UUID) (int, error) {
	const query = `
		INSERT INTO product_likes (product_id, likes_count)
		VALUES ($1, 1)
		ON CONFLICT (product_id)
		DO UPDATE SET likes_count = product_likes.likes_count + 1
		RETURNING likes_count`

	var count int
	err := r.pool.QueryRow(ctx, query, productID).Scan(&count)
	if err != nil {
		return 0, fmt.Errorf("repository: increment product like count: %w", err)
	}

	return count, nil
}

// Decrement atomically lowers the like count for a product, floored at
// zero. A product with no counter row yet has nothing to decrement, so
// that case returns 0 rather than an error.
func (r *productLikeRepository) Decrement(ctx context.Context, productID uuid.UUID) (int, error) {
	const query = `
		UPDATE product_likes
		SET likes_count = GREATEST(likes_count - 1, 0)
		WHERE product_id = $1
		RETURNING likes_count`

	var count int
	err := r.pool.QueryRow(ctx, query, productID).Scan(&count)
	if errors.Is(err, pgx.ErrNoRows) {
		return 0, nil
	}
	if err != nil {
		return 0, fmt.Errorf("repository: decrement product like count: %w", err)
	}

	return count, nil
}

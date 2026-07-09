package repository

import (
	"context"
	"fmt"

	"github.com/google/uuid"
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

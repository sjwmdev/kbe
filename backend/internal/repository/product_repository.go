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

type productRepository struct {
	pool *pgxpool.Pool
}

func NewProductRepository(pool *pgxpool.Pool) domain.ProductRepository {
	return &productRepository{pool: pool}
}

// FindAllActive is the paginated public product listing for one business.
// categoryID nil means no filter. Mirrors FindAll below (COUNT(*) OVER() for
// the total in one round trip) — the public catalog can grow just as the
// admin inventory can.
func (r *productRepository) FindAllActive(ctx context.Context, businessID uuid.UUID, categoryID *uuid.UUID, page, pageSize int) ([]domain.Product, int, error) {
	if page < 1 {
		page = 1
	}
	if pageSize < 1 {
		pageSize = 20
	}
	offset := (page - 1) * pageSize

	query := `
		SELECT
			p.id, p.business_id, p.name, p.description, p.price, p.category_id, p.is_active,
			p.stock_quantity, p.low_stock_threshold, p.created_by,
			p.created_at, p.updated_at,
			c.name, c.slug,
			pi.id, pi.image_url, pi.is_primary,
			COALESCE(pl.likes_count, 0),
			COUNT(*) OVER()
		FROM products p
		JOIN categories c ON c.id = p.category_id
		LEFT JOIN product_images pi ON pi.product_id = p.id AND pi.is_primary = true
		LEFT JOIN product_likes pl ON pl.product_id = p.id
		WHERE p.business_id = $1 AND p.is_active = true`

	args := make([]any, 1, 4)
	args[0] = businessID
	if categoryID != nil {
		args = append(args, *categoryID)
		query += fmt.Sprintf(` AND p.category_id = $%d`, len(args))
	}
	query += fmt.Sprintf(` ORDER BY p.created_at DESC LIMIT $%d OFFSET $%d`, len(args)+1, len(args)+2)
	args = append(args, pageSize, offset)

	rows, err := r.pool.Query(ctx, query, args...)
	if err != nil {
		return nil, 0, fmt.Errorf("repository: find all active products: %w", err)
	}
	defer rows.Close()

	var products []domain.Product
	total := 0
	for rows.Next() {
		var p domain.Product
		var imgID *uuid.UUID
		var imgURL *string
		var imgPrimary *bool

		if err := rows.Scan(
			&p.ID, &p.BusinessID, &p.Name, &p.Description, &p.Price, &p.CategoryID, &p.IsActive,
			&p.StockQuantity, &p.LowStockThreshold, &p.CreatedBy,
			&p.CreatedAt, &p.UpdatedAt,
			&p.CategoryName, &p.CategorySlug,
			&imgID, &imgURL, &imgPrimary,
			&p.LikeCount,
			&total,
		); err != nil {
			return nil, 0, fmt.Errorf("repository: scan active product row: %w", err)
		}

		if imgID != nil {
			p.Images = []domain.ProductImage{{
				ID:        *imgID,
				ProductID: p.ID,
				ImageURL:  *imgURL,
				IsPrimary: *imgPrimary,
			}}
		}

		products = append(products, p)
	}
	if err := rows.Err(); err != nil {
		return nil, 0, fmt.Errorf("repository: iterate active product rows: %w", err)
	}

	return products, total, nil
}

// FindAll is the paginated admin inventory listing, always scoped to
// businessID; createdBy nil means no additional ownership filter within that
// business (SuperAdmin sees everything in their own tenant), non-nil scopes
// further to that user's own products. The total row count (for pagination
// controls) comes from a COUNT(*) OVER() window column — one round trip,
// not two.
func (r *productRepository) FindAll(ctx context.Context, businessID uuid.UUID, createdBy *uuid.UUID, page, pageSize int) ([]domain.Product, int, error) {
	if page < 1 {
		page = 1
	}
	if pageSize < 1 {
		pageSize = 20
	}
	offset := (page - 1) * pageSize

	query := `
		SELECT
			p.id, p.business_id, p.name, p.description, p.price, p.category_id, p.is_active,
			p.stock_quantity, p.low_stock_threshold, p.created_by,
			p.created_at, p.updated_at,
			c.name, c.slug,
			pi.id, pi.image_url, pi.is_primary,
			COALESCE(pl.likes_count, 0),
			COUNT(*) OVER()
		FROM products p
		JOIN categories c ON c.id = p.category_id
		LEFT JOIN product_images pi ON pi.product_id = p.id AND pi.is_primary = true
		LEFT JOIN product_likes pl ON pl.product_id = p.id
		WHERE p.business_id = $1`

	args := make([]any, 1, 3)
	args[0] = businessID
	if createdBy != nil {
		args = append(args, *createdBy)
		query += fmt.Sprintf(` AND p.created_by = $%d`, len(args))
	}
	query += fmt.Sprintf(` ORDER BY p.created_at DESC LIMIT $%d OFFSET $%d`, len(args)+1, len(args)+2)
	args = append(args, pageSize, offset)

	rows, err := r.pool.Query(ctx, query, args...)
	if err != nil {
		return nil, 0, fmt.Errorf("repository: find all products: %w", err)
	}
	defer rows.Close()

	var products []domain.Product
	total := 0
	for rows.Next() {
		var p domain.Product
		var imgID *uuid.UUID
		var imgURL *string
		var imgPrimary *bool

		if err := rows.Scan(
			&p.ID, &p.BusinessID, &p.Name, &p.Description, &p.Price, &p.CategoryID, &p.IsActive,
			&p.StockQuantity, &p.LowStockThreshold, &p.CreatedBy,
			&p.CreatedAt, &p.UpdatedAt,
			&p.CategoryName, &p.CategorySlug,
			&imgID, &imgURL, &imgPrimary,
			&p.LikeCount,
			&total,
		); err != nil {
			return nil, 0, fmt.Errorf("repository: scan product row: %w", err)
		}

		if imgID != nil {
			p.Images = []domain.ProductImage{{
				ID:        *imgID,
				ProductID: p.ID,
				ImageURL:  *imgURL,
				IsPrimary: *imgPrimary,
			}}
		}

		products = append(products, p)
	}
	if err := rows.Err(); err != nil {
		return nil, 0, fmt.Errorf("repository: iterate product rows: %w", err)
	}

	return products, total, nil
}

// FindByID returns a single product with its like count, unscoped by
// business — it backs both the public product page (no tenant context) and
// admin mutation flows, which compare BusinessID against the caller
// themselves (see ProductUsecase.Update/Delete). Callers needing the full
// image gallery should combine this with ProductImageRepository.
func (r *productRepository) FindByID(ctx context.Context, id uuid.UUID) (*domain.Product, error) {
	const query = `
		SELECT
			p.id, p.business_id, p.name, p.description, p.price, p.category_id, p.is_active,
			p.stock_quantity, p.low_stock_threshold, p.created_by,
			p.created_at, p.updated_at,
			c.name, c.slug,
			COALESCE(pl.likes_count, 0)
		FROM products p
		JOIN categories c ON c.id = p.category_id
		LEFT JOIN product_likes pl ON pl.product_id = p.id
		WHERE p.id = $1`

	var p domain.Product
	err := r.pool.QueryRow(ctx, query, id).Scan(
		&p.ID, &p.BusinessID, &p.Name, &p.Description, &p.Price, &p.CategoryID, &p.IsActive,
		&p.StockQuantity, &p.LowStockThreshold, &p.CreatedBy,
		&p.CreatedAt, &p.UpdatedAt,
		&p.CategoryName, &p.CategorySlug,
		&p.LikeCount,
	)
	if errors.Is(err, pgx.ErrNoRows) {
		return nil, nil
	}
	if err != nil {
		return nil, fmt.Errorf("repository: find product by id: %w", err)
	}

	return &p, nil
}

func (r *productRepository) Create(ctx context.Context, product *domain.Product) error {
	const query = `
		INSERT INTO products (business_id, name, description, price, category_id, is_active, stock_quantity, low_stock_threshold, created_by)
		VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9)
		RETURNING id, created_at, updated_at`

	err := r.pool.QueryRow(ctx, query,
		product.BusinessID, product.Name, product.Description, product.Price, product.CategoryID, product.IsActive,
		product.StockQuantity, product.LowStockThreshold, product.CreatedBy,
	).Scan(&product.ID, &product.CreatedAt, &product.UpdatedAt)
	if err != nil {
		return fmt.Errorf("repository: create product: %w", err)
	}

	return nil
}

func (r *productRepository) Update(ctx context.Context, product *domain.Product) error {
	const query = `
		UPDATE products
		SET name = $1, description = $2, price = $3, category_id = $4, is_active = $5,
			stock_quantity = $6, low_stock_threshold = $7, updated_at = now()
		WHERE id = $8
		RETURNING updated_at`

	err := r.pool.QueryRow(ctx, query,
		product.Name, product.Description, product.Price, product.CategoryID, product.IsActive,
		product.StockQuantity, product.LowStockThreshold, product.ID,
	).Scan(&product.UpdatedAt)
	if errors.Is(err, pgx.ErrNoRows) {
		return fmt.Errorf("repository: update product: %w", domain.ErrNotFound)
	}
	if err != nil {
		return fmt.Errorf("repository: update product: %w", err)
	}

	return nil
}

func (r *productRepository) SoftDelete(ctx context.Context, id uuid.UUID) error {
	const query = `UPDATE products SET is_active = false, updated_at = now() WHERE id = $1`

	tag, err := r.pool.Exec(ctx, query, id)
	if err != nil {
		return fmt.Errorf("repository: soft delete product: %w", err)
	}
	if tag.RowsAffected() == 0 {
		return fmt.Errorf("repository: soft delete product: %w", domain.ErrNotFound)
	}

	return nil
}

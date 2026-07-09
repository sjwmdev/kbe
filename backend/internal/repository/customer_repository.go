package repository

import (
	"context"
	"fmt"
	"time"

	"github.com/google/uuid"
	"github.com/jackc/pgx/v5/pgxpool"

	"backend/internal/domain"
)

type customerRepository struct {
	pool *pgxpool.Pool
}

func NewCustomerRepository(pool *pgxpool.Pool) domain.CustomerRepository {
	return &customerRepository{pool: pool}
}

// FindOrCreateByPhone upserts on the (business_id, phone) unique constraint:
// a repeat customer's name is refreshed to whatever was entered this time,
// rather than silently keeping a stale or misspelled name from their first
// order. Scoped to businessID so two different businesses' customers sharing
// a phone number by coincidence never collide.
func (r *customerRepository) FindOrCreateByPhone(ctx context.Context, businessID uuid.UUID, name, phone string) (*domain.Customer, error) {
	const query = `
		INSERT INTO customers (business_id, name, phone)
		VALUES ($1, $2, $3)
		ON CONFLICT (business_id, phone) DO UPDATE SET name = EXCLUDED.name
		RETURNING id, business_id, name, phone, created_at`

	var c domain.Customer
	err := r.pool.QueryRow(ctx, query, businessID, name, phone).
		Scan(&c.ID, &c.BusinessID, &c.Name, &c.Phone, &c.CreatedAt)
	if err != nil {
		return nil, fmt.Errorf("repository: find or create customer: %w", err)
	}

	return &c, nil
}

// CountActiveSince counts distinct customers with at least one non-cancelled
// order placed within [since, until), always scoped to businessID and
// optionally further to createdBy (nil means no additional filter —
// SuperAdmin sees everything in their own tenant).
func (r *customerRepository) CountActiveSince(ctx context.Context, businessID uuid.UUID, createdBy *uuid.UUID, since, until time.Time) (int, error) {
	query := `
		SELECT COUNT(DISTINCT o.customer_id)
		FROM orders o
		WHERE o.business_id = $1 AND o.status != 'cancelled' AND o.created_at >= $2 AND o.created_at < $3`

	args := []any{businessID, since, until}
	if createdBy != nil {
		query += ` AND o.created_by = $4`
		args = append(args, *createdBy)
	}

	var count int
	if err := r.pool.QueryRow(ctx, query, args...).Scan(&count); err != nil {
		return 0, fmt.Errorf("repository: count active customers: %w", err)
	}

	return count, nil
}

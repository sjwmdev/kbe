package repository

import (
	"context"
	"fmt"

	"github.com/jackc/pgx/v5/pgxpool"
)

// NewPostgresPool opens a connection pool against the given DSN
// (e.g. "postgres://user:password@localhost:5432/kbe?sslmode=disable")
// and verifies connectivity with a ping before returning.
func NewPostgresPool(ctx context.Context, dsn string) (*pgxpool.Pool, error) {
	pool, err := pgxpool.New(ctx, dsn)
	if err != nil {
		return nil, fmt.Errorf("repository: create postgres pool: %w", err)
	}

	if err := pool.Ping(ctx); err != nil {
		pool.Close()
		return nil, fmt.Errorf("repository: ping postgres: %w", err)
	}

	return pool, nil
}

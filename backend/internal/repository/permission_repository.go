package repository

import (
	"context"
	"fmt"

	"github.com/jackc/pgx/v5/pgxpool"

	"backend/internal/domain"
)

type permissionRepository struct {
	pool *pgxpool.Pool
}

func NewPermissionRepository(pool *pgxpool.Pool) domain.PermissionRepository {
	return &permissionRepository{pool: pool}
}

func (r *permissionRepository) FindAll(ctx context.Context) ([]domain.Permission, error) {
	const query = `SELECT id, module, action, key FROM permissions ORDER BY module, action`

	rows, err := r.pool.Query(ctx, query)
	if err != nil {
		return nil, fmt.Errorf("repository: find all permissions: %w", err)
	}
	defer rows.Close()

	var permissions []domain.Permission
	for rows.Next() {
		var p domain.Permission
		if err := rows.Scan(&p.ID, &p.Module, &p.Action, &p.Key); err != nil {
			return nil, fmt.Errorf("repository: scan permission row: %w", err)
		}
		permissions = append(permissions, p)
	}
	if err := rows.Err(); err != nil {
		return nil, fmt.Errorf("repository: iterate permission rows: %w", err)
	}

	return permissions, nil
}

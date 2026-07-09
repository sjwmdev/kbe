package repository

import (
	"context"
	"fmt"

	"github.com/google/uuid"
	"github.com/jackc/pgx/v5/pgxpool"

	"backend/internal/domain"
)

type auditLogRepository struct {
	pool *pgxpool.Pool
}

func NewAuditLogRepository(pool *pgxpool.Pool) domain.AuditLogRepository {
	return &auditLogRepository{pool: pool}
}

func (r *auditLogRepository) Create(ctx context.Context, log *domain.AuditLog) error {
	const query = `
		INSERT INTO audit_logs (business_id, user_id, username, method, path, status_code, duration_ms, ip_address)
		VALUES ($1, $2, $3, $4, $5, $6, $7, $8)
		RETURNING id, created_at`

	err := r.pool.QueryRow(ctx, query,
		log.BusinessID, log.UserID, log.Username, log.Method, log.Path, log.StatusCode, log.DurationMs, log.IPAddress,
	).Scan(&log.ID, &log.CreatedAt)
	if err != nil {
		return fmt.Errorf("repository: create audit log: %w", err)
	}

	return nil
}

func (r *auditLogRepository) List(ctx context.Context, businessID uuid.UUID, page, pageSize int) ([]domain.AuditLog, int, error) {
	if page < 1 {
		page = 1
	}
	if pageSize < 1 {
		pageSize = 20
	}
	offset := (page - 1) * pageSize

	const query = `
		SELECT id, business_id, user_id, username, method, path, status_code, duration_ms, ip_address, created_at,
			COUNT(*) OVER()
		FROM audit_logs
		WHERE business_id = $1
		ORDER BY created_at DESC
		LIMIT $2 OFFSET $3`

	rows, err := r.pool.Query(ctx, query, businessID, pageSize, offset)
	if err != nil {
		return nil, 0, fmt.Errorf("repository: list audit logs: %w", err)
	}
	defer rows.Close()

	var logs []domain.AuditLog
	total := 0
	for rows.Next() {
		var l domain.AuditLog
		if err := rows.Scan(
			&l.ID, &l.BusinessID, &l.UserID, &l.Username, &l.Method, &l.Path, &l.StatusCode, &l.DurationMs, &l.IPAddress, &l.CreatedAt,
			&total,
		); err != nil {
			return nil, 0, fmt.Errorf("repository: scan audit log row: %w", err)
		}
		logs = append(logs, l)
	}
	if err := rows.Err(); err != nil {
		return nil, 0, fmt.Errorf("repository: iterate audit log rows: %w", err)
	}

	return logs, total, nil
}

// Clear removes only businessID's own audit trail — a DELETE rather than the
// original TRUNCATE, since TRUNCATE can't be scoped to one tenant.
func (r *auditLogRepository) Clear(ctx context.Context, businessID uuid.UUID) error {
	const query = `DELETE FROM audit_logs WHERE business_id = $1`

	if _, err := r.pool.Exec(ctx, query, businessID); err != nil {
		return fmt.Errorf("repository: clear audit logs: %w", err)
	}

	return nil
}

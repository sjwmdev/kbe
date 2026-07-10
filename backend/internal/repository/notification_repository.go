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

type notificationRepository struct {
	pool *pgxpool.Pool
}

func NewNotificationRepository(pool *pgxpool.Pool) domain.NotificationRepository {
	return &notificationRepository{pool: pool}
}

func (r *notificationRepository) Create(ctx context.Context, n *domain.Notification) error {
	const query = `
		INSERT INTO notifications (business_id, category, message, link_url, reference_id)
		VALUES ($1, $2, $3, $4, $5)
		RETURNING id, is_read, is_resolved, created_at, updated_at`

	err := r.pool.QueryRow(ctx, query, n.BusinessID, n.Category, n.Message, n.LinkURL, n.ReferenceID).
		Scan(&n.ID, &n.IsRead, &n.IsResolved, &n.CreatedAt, &n.UpdatedAt)
	if err != nil {
		return fmt.Errorf("repository: create notification: %w", err)
	}

	return nil
}

func (r *notificationRepository) List(ctx context.Context, businessID uuid.UUID, filter domain.NotificationFilter, page, pageSize int) ([]domain.Notification, int, error) {
	if page < 1 {
		page = 1
	}
	if pageSize < 1 {
		pageSize = 20
	}
	offset := (page - 1) * pageSize

	query := `
		SELECT id, business_id, category, message, link_url, reference_id, is_read, is_resolved, created_at, updated_at, COUNT(*) OVER()
		FROM notifications
		WHERE business_id = $1`
	args := []any{businessID}

	if filter.Category != "" {
		args = append(args, filter.Category)
		query += fmt.Sprintf(" AND category = $%d", len(args))
	}
	if filter.IsRead != nil {
		args = append(args, *filter.IsRead)
		query += fmt.Sprintf(" AND is_read = $%d", len(args))
	}
	if filter.IsResolved != nil {
		args = append(args, *filter.IsResolved)
		query += fmt.Sprintf(" AND is_resolved = $%d", len(args))
	}

	args = append(args, pageSize, offset)
	query += fmt.Sprintf(" ORDER BY created_at DESC LIMIT $%d OFFSET $%d", len(args)-1, len(args))

	rows, err := r.pool.Query(ctx, query, args...)
	if err != nil {
		return nil, 0, fmt.Errorf("repository: list notifications: %w", err)
	}
	defer rows.Close()

	var notifications []domain.Notification
	total := 0
	for rows.Next() {
		var n domain.Notification
		if err := rows.Scan(
			&n.ID, &n.BusinessID, &n.Category, &n.Message, &n.LinkURL, &n.ReferenceID,
			&n.IsRead, &n.IsResolved, &n.CreatedAt, &n.UpdatedAt, &total,
		); err != nil {
			return nil, 0, fmt.Errorf("repository: scan notification row: %w", err)
		}
		notifications = append(notifications, n)
	}
	if err := rows.Err(); err != nil {
		return nil, 0, fmt.Errorf("repository: iterate notification rows: %w", err)
	}

	return notifications, total, nil
}

func (r *notificationRepository) CountUnread(ctx context.Context, businessID uuid.UUID) (int, error) {
	const query = `SELECT COUNT(*) FROM notifications WHERE business_id = $1 AND is_read = false`

	var count int
	if err := r.pool.QueryRow(ctx, query, businessID).Scan(&count); err != nil {
		return 0, fmt.Errorf("repository: count unread notifications: %w", err)
	}

	return count, nil
}

func (r *notificationRepository) MarkRead(ctx context.Context, id, businessID uuid.UUID) error {
	const query = `UPDATE notifications SET is_read = true, is_resolved = true, updated_at = now() WHERE id = $1 AND business_id = $2`

	tag, err := r.pool.Exec(ctx, query, id, businessID)
	if err != nil {
		return fmt.Errorf("repository: mark notification read: %w", err)
	}
	if tag.RowsAffected() == 0 {
		return fmt.Errorf("repository: mark notification read: %w", domain.ErrNotFound)
	}

	return nil
}

func (r *notificationRepository) Delete(ctx context.Context, id, businessID uuid.UUID) error {
	const query = `DELETE FROM notifications WHERE id = $1 AND business_id = $2`

	tag, err := r.pool.Exec(ctx, query, id, businessID)
	if err != nil {
		return fmt.Errorf("repository: delete notification: %w", err)
	}
	if tag.RowsAffected() == 0 {
		return fmt.Errorf("repository: delete notification: %w", domain.ErrNotFound)
	}

	return nil
}

func (r *notificationRepository) Clear(ctx context.Context, businessID uuid.UUID) error {
	const query = `DELETE FROM notifications WHERE business_id = $1`

	if _, err := r.pool.Exec(ctx, query, businessID); err != nil {
		return fmt.Errorf("repository: clear notifications: %w", err)
	}

	return nil
}

func (r *notificationRepository) ResolveByReference(ctx context.Context, businessID uuid.UUID, category string, referenceID uuid.UUID) error {
	const query = `
		UPDATE notifications
		SET is_read = true, is_resolved = true, updated_at = now()
		WHERE business_id = $1 AND category = $2 AND reference_id = $3 AND is_resolved = false`

	if _, err := r.pool.Exec(ctx, query, businessID, category, referenceID); err != nil {
		return fmt.Errorf("repository: resolve notifications by reference: %w", err)
	}

	return nil
}

func (r *notificationRepository) FindUnresolvedByReference(ctx context.Context, businessID uuid.UUID, category string, referenceID uuid.UUID) (*domain.Notification, error) {
	const query = `
		SELECT id, business_id, category, message, link_url, reference_id, is_read, is_resolved, created_at, updated_at
		FROM notifications
		WHERE business_id = $1 AND category = $2 AND reference_id = $3 AND is_resolved = false
		LIMIT 1`

	var n domain.Notification
	err := r.pool.QueryRow(ctx, query, businessID, category, referenceID).Scan(
		&n.ID, &n.BusinessID, &n.Category, &n.Message, &n.LinkURL, &n.ReferenceID,
		&n.IsRead, &n.IsResolved, &n.CreatedAt, &n.UpdatedAt,
	)
	if errors.Is(err, pgx.ErrNoRows) {
		return nil, nil
	}
	if err != nil {
		return nil, fmt.Errorf("repository: find unresolved notification: %w", err)
	}

	return &n, nil
}

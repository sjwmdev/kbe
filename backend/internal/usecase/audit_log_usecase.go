package usecase

import (
	"context"

	"github.com/google/uuid"

	"backend/internal/domain"
)

// AuditLogUsecase is a thin wrapper over AuditLogRepository — there's no
// business rule beyond persistence and pagination, same shape as
// MediaUsecase/RoleUsecase.
type AuditLogUsecase struct {
	logs domain.AuditLogRepository
}

func NewAuditLogUsecase(logs domain.AuditLogRepository) *AuditLogUsecase {
	return &AuditLogUsecase{logs: logs}
}

func (u *AuditLogUsecase) Record(ctx context.Context, log *domain.AuditLog) error {
	return u.logs.Create(ctx, log)
}

func (u *AuditLogUsecase) List(ctx context.Context, businessID uuid.UUID, page, pageSize int) ([]domain.AuditLog, int, error) {
	return u.logs.List(ctx, businessID, page, pageSize)
}

func (u *AuditLogUsecase) Clear(ctx context.Context, businessID uuid.UUID) error {
	return u.logs.Clear(ctx, businessID)
}

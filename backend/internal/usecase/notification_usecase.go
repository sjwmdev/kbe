package usecase

import (
	"context"
	"fmt"
	"strconv"

	"github.com/google/uuid"

	"backend/internal/domain"
)

type NotificationUsecase struct {
	notifications domain.NotificationRepository
}

func NewNotificationUsecase(notifications domain.NotificationRepository) *NotificationUsecase {
	return &NotificationUsecase{notifications: notifications}
}

func (u *NotificationUsecase) List(ctx context.Context, businessID uuid.UUID, filter domain.NotificationFilter, page, pageSize int) ([]domain.Notification, int, error) {
	if filter.Category != "" && !domain.IsValidNotificationCategory(filter.Category) {
		return nil, 0, fmt.Errorf("%w: invalid notification category", ErrValidation)
	}
	return u.notifications.List(ctx, businessID, filter, page, pageSize)
}

func (u *NotificationUsecase) CountUnread(ctx context.Context, businessID uuid.UUID) (int, error) {
	return u.notifications.CountUnread(ctx, businessID)
}

func (u *NotificationUsecase) MarkRead(ctx context.Context, id, businessID uuid.UUID) error {
	return u.notifications.MarkRead(ctx, id, businessID)
}

func (u *NotificationUsecase) Delete(ctx context.Context, id, businessID uuid.UUID) error {
	return u.notifications.Delete(ctx, id, businessID)
}

func (u *NotificationUsecase) Clear(ctx context.Context, businessID uuid.UUID) error {
	return u.notifications.Clear(ctx, businessID)
}

// NotifyPasswordResetRequest raises a password_reset_request notification
// for userID's business, unless one is already open for that same user —
// repeated forgot-password submissions while an admin hasn't acted yet
// don't spam fresh alerts. The notification links to the users page where
// the admin performs the actual reset.
func (u *NotificationUsecase) NotifyPasswordResetRequest(ctx context.Context, businessID, userID uuid.UUID, userName, email string) error {
	existing, err := u.notifications.FindUnresolvedByReference(ctx, businessID, domain.NotificationCategoryPasswordReset, userID)
	if err != nil {
		return err
	}
	if existing != nil {
		return nil
	}

	if userName == "" {
		userName = email
	}
	tmpl := domain.FindMessageTemplate(domain.TemplatePasswordResetDashboard)
	message := domain.RenderMessageTemplate(tmpl.Body, map[string]string{
		"user_name": userName,
		"email":     email,
	})

	refID := userID
	notification := &domain.Notification{
		BusinessID:  businessID,
		Category:    domain.NotificationCategoryPasswordReset,
		Message:     message,
		LinkURL:     "/admin/users",
		ReferenceID: &refID,
	}

	return u.notifications.Create(ctx, notification)
}

// ResolvePasswordResetRequest closes any open password_reset_request
// notification for userID — called once an admin actually resets the
// password, so the alert doesn't linger as unresolved.
func (u *NotificationUsecase) ResolvePasswordResetRequest(ctx context.Context, businessID, userID uuid.UUID) error {
	return u.notifications.ResolveByReference(ctx, businessID, domain.NotificationCategoryPasswordReset, userID)
}

// NotifyLowStock creates a low_stock notification for productID, unless one
// is already unresolved for that same product — this is what stops every
// single order against an already-low product from spamming a fresh alert;
// the existing one stays until an admin marks it read/resolved (or stock
// recovers and later drops low again, since MarkRead resolves it).
// Best-effort: a failure here must never fail the order that triggered it.
func (u *NotificationUsecase) NotifyLowStock(ctx context.Context, businessID, productID uuid.UUID, productName string, quantity int) error {
	existing, err := u.notifications.FindUnresolvedByReference(ctx, businessID, domain.NotificationCategoryLowStock, productID)
	if err != nil {
		return err
	}
	if existing != nil {
		return nil
	}

	refID := productID
	tmpl := domain.FindMessageTemplate(domain.TemplateLowStockDashboard)
	message := domain.RenderMessageTemplate(tmpl.Body, map[string]string{
		"product_name":   productName,
		"stock_quantity": strconv.Itoa(quantity),
	})
	notification := &domain.Notification{
		BusinessID:  businessID,
		Category:    domain.NotificationCategoryLowStock,
		Message:     message,
		LinkURL:     fmt.Sprintf("/admin/products/%s", productID),
		ReferenceID: &refID,
	}

	return u.notifications.Create(ctx, notification)
}

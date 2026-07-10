package domain

import (
	"time"

	"github.com/google/uuid"
)

// Notification categories. The table is deliberately generic so new
// categories need no schema change — just a constant here.
const (
	NotificationCategoryLowStock      = "low_stock"
	NotificationCategoryPasswordReset = "password_reset_request"
	NotificationCategorySystem        = "system"
	NotificationCategoryOrder         = "order"
	NotificationCategoryUser          = "user"
)

// IsValidNotificationCategory reports whether s is a known category —
// used to reject junk filter values at the handler boundary.
func IsValidNotificationCategory(s string) bool {
	switch s {
	case NotificationCategoryLowStock, NotificationCategoryPasswordReset,
		NotificationCategorySystem, NotificationCategoryOrder, NotificationCategoryUser:
		return true
	}
	return false
}

// NotificationFilter carries the notification list's optional filter
// dimensions — each nil/empty field means "no filter" on that dimension.
// Same shape as ProductFilter.
type NotificationFilter struct {
	Category   string
	IsRead     *bool
	IsResolved *bool
}

// Notification is a single dashboard alert — a category, a message, and an
// optional link to the resource it's about (e.g. a product's details page).
// ReferenceID lets a usecase look up "is there already an unresolved
// notification for this exact thing" before creating a duplicate.
type Notification struct {
	ID          uuid.UUID
	BusinessID  uuid.UUID
	Category    string
	Message     string
	LinkURL     string
	ReferenceID *uuid.UUID
	IsRead      bool
	IsResolved  bool
	CreatedAt   time.Time
	UpdatedAt   time.Time
}

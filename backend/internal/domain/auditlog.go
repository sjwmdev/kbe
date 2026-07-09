package domain

import (
	"time"

	"github.com/google/uuid"
)

// AuditLog records a single mutating admin action (or login attempt) for
// traceability. Username is a denormalized snapshot taken at the time of the
// action — user_id alone would lose "who did this" once that user account
// is deleted (user_id is ON DELETE SET NULL, matching every other FK to
// users in this schema).
type AuditLog struct {
	ID         uuid.UUID
	BusinessID *uuid.UUID
	UserID     *uuid.UUID
	Username   string
	Method     string
	Path       string
	StatusCode int
	DurationMs int
	IPAddress  string
	CreatedAt  time.Time
}

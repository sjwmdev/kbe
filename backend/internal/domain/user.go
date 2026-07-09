package domain

import (
	"time"

	"github.com/google/uuid"
)

type User struct {
	ID                  uuid.UUID
	BusinessID          uuid.UUID
	Username            string
	Name                string
	Email               string
	PasswordHash        string
	RoleID              *uuid.UUID
	IsActive            bool
	MustChangePassword  bool
	FailedLoginAttempts int
	LockedUntil         *time.Time
	CreatedAt           time.Time
	UpdatedAt           time.Time

	// RoleName is populated by a join in FindAll, not persisted directly on
	// the users table (mirrors how Product.Images is populated).
	RoleName string
}

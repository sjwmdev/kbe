package domain

import (
	"time"

	"github.com/google/uuid"
)

// Communication channels a user can pick as their preferred way to be
// reached (e.g. for password-reset messages). Phone doubles as the
// WhatsApp number.
const (
	CommunicationChannelDashboard = "dashboard"
	CommunicationChannelEmail     = "email"
	CommunicationChannelWhatsApp  = "whatsapp"
)

// IsValidCommunicationChannel reports whether s is a known channel.
func IsValidCommunicationChannel(s string) bool {
	switch s {
	case CommunicationChannelDashboard, CommunicationChannelEmail, CommunicationChannelWhatsApp:
		return true
	}
	return false
}

type User struct {
	ID                          uuid.UUID
	BusinessID                  uuid.UUID
	Username                    string
	Name                        string
	Email                       string
	Phone                       string
	DefaultCommunicationChannel string
	PasswordHash                string
	RoleID                      *uuid.UUID
	IsActive                    bool
	MustChangePassword          bool
	FailedLoginAttempts         int
	LockedUntil                 *time.Time
	CreatedAt                   time.Time
	UpdatedAt                   time.Time

	// RoleName is populated by a join in FindAll, not persisted directly on
	// the users table (mirrors how Product.Images is populated).
	RoleName string
}

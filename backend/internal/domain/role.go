package domain

import (
	"time"

	"github.com/google/uuid"
)

type Role struct {
	ID          uuid.UUID
	BusinessID  uuid.UUID
	Name        string
	Description string
	CreatedAt   time.Time
	UpdatedAt   time.Time
}

// SuperAdminRoleName is the one role that bypasses ordinary permission
// checks and data-isolation filters — always granted every permission (see
// RoleUsecase.GetRolePermissionKeys) and always able to see/edit every
// product regardless of who created it (see ProductUsecase). Centralized
// here as the single source of truth for that comparison, rather than
// re-deriving "role.Name == SuperAdmin" independently at each call site.
const SuperAdminRoleName = "SuperAdmin"

func (r Role) IsSuperAdmin() bool {
	return r.Name == SuperAdminRoleName
}

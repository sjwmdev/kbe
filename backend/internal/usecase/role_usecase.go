package usecase

import (
	"context"
	"fmt"

	"github.com/google/uuid"

	"backend/internal/domain"
)

// RoleUsecase composes roles and the fixed permission catalog. Like
// ContentUsecase, these are simple CRUD resources with one piece of
// cross-cutting logic (validating submitted permission IDs against the real
// catalog), so one usecase covers both rather than splitting unnecessarily.
type RoleUsecase struct {
	roles       domain.RoleRepository
	permissions domain.PermissionRepository
}

func NewRoleUsecase(roles domain.RoleRepository, permissions domain.PermissionRepository) *RoleUsecase {
	return &RoleUsecase{roles: roles, permissions: permissions}
}

func (u *RoleUsecase) ListRoles(ctx context.Context, businessID uuid.UUID) ([]domain.Role, error) {
	return u.roles.FindAll(ctx, businessID)
}

func (u *RoleUsecase) GetRole(ctx context.Context, id, businessID uuid.UUID) (*domain.Role, error) {
	role, err := u.roles.FindByID(ctx, id, businessID)
	if err != nil {
		return nil, err
	}
	if role == nil {
		return nil, domain.ErrNotFound
	}
	return role, nil
}

// IsSuperAdminRole resolves roleID within businessID and reports whether
// it's the SuperAdmin role. The single call site for "does this role bypass
// ordinary checks" — callers that only have a role ID (JWT claims, not a
// loaded Role) use this instead of independently fetching the role and
// comparing role.Name. Returns false (not an error) for a nil or
// unresolvable role ID — including a role that belongs to a *different*
// business than businessID, which is exactly the defense-in-depth this
// businessID parameter provides against a stale or tampered token.
func (u *RoleUsecase) IsSuperAdminRole(ctx context.Context, roleID *uuid.UUID, businessID uuid.UUID) bool {
	if roleID == nil {
		return false
	}
	role, err := u.roles.FindByID(ctx, *roleID, businessID)
	return err == nil && role != nil && role.IsSuperAdmin()
}

type RoleInput struct {
	Name        string
	Description string
}

func (in RoleInput) Validate() error {
	if in.Name == "" {
		return fmt.Errorf("%w: name is required", ErrValidation)
	}
	return nil
}

func (u *RoleUsecase) CreateRole(ctx context.Context, in RoleInput, businessID uuid.UUID) (*domain.Role, error) {
	if err := in.Validate(); err != nil {
		return nil, err
	}

	role := &domain.Role{BusinessID: businessID, Name: in.Name, Description: in.Description}
	if err := u.roles.Create(ctx, role); err != nil {
		return nil, err
	}

	return role, nil
}

func (u *RoleUsecase) UpdateRole(ctx context.Context, id uuid.UUID, in RoleInput, businessID uuid.UUID) (*domain.Role, error) {
	if err := in.Validate(); err != nil {
		return nil, err
	}

	existing, err := u.roles.FindByID(ctx, id, businessID)
	if err != nil {
		return nil, err
	}
	if existing == nil {
		return nil, domain.ErrNotFound
	}

	existing.Name = in.Name
	existing.Description = in.Description

	if err := u.roles.Update(ctx, existing); err != nil {
		return nil, err
	}

	return existing, nil
}

func (u *RoleUsecase) DeleteRole(ctx context.Context, id, businessID uuid.UUID) error {
	return u.roles.Delete(ctx, id, businessID)
}

func (u *RoleUsecase) ListPermissions(ctx context.Context) ([]domain.Permission, error) {
	return u.permissions.FindAll(ctx)
}

// GetRolePermissionKeys returns a role's granted permission keys (e.g.
// "products.delete") directly — used wherever we need effective permissions
// (login response, RBAC middleware) without a second ID-to-key lookup.
// SuperAdmin always gets every known permission key, regardless of what's
// actually in role_permissions, so it can never accidentally lock itself out.
func (u *RoleUsecase) GetRolePermissionKeys(ctx context.Context, roleID, businessID uuid.UUID) ([]string, error) {
	role, err := u.roles.FindByID(ctx, roleID, businessID)
	if err != nil {
		return nil, err
	}
	if role == nil {
		return nil, domain.ErrNotFound
	}

	if role.IsSuperAdmin() {
		all, err := u.permissions.FindAll(ctx)
		if err != nil {
			return nil, err
		}
		keys := make([]string, 0, len(all))
		for _, p := range all {
			keys = append(keys, p.Key)
		}
		return keys, nil
	}

	return u.roles.FindPermissionKeys(ctx, roleID, businessID)
}

func (u *RoleUsecase) GetRolePermissionIDs(ctx context.Context, roleID, businessID uuid.UUID) ([]uuid.UUID, error) {
	role, err := u.roles.FindByID(ctx, roleID, businessID)
	if err != nil {
		return nil, err
	}
	if role == nil {
		return nil, domain.ErrNotFound
	}

	return u.roles.FindPermissionIDs(ctx, roleID, businessID)
}

// SetRolePermissions replaces a role's granted permissions, rejecting any
// submitted ID that isn't a real permission so a typo/stale client can't
// silently no-op or corrupt the join table.
func (u *RoleUsecase) SetRolePermissions(ctx context.Context, roleID, businessID uuid.UUID, permissionIDs []uuid.UUID) error {
	role, err := u.roles.FindByID(ctx, roleID, businessID)
	if err != nil {
		return err
	}
	if role == nil {
		return domain.ErrNotFound
	}

	all, err := u.permissions.FindAll(ctx)
	if err != nil {
		return err
	}
	valid := make(map[uuid.UUID]bool, len(all))
	for _, p := range all {
		valid[p.ID] = true
	}
	for _, id := range permissionIDs {
		if !valid[id] {
			return fmt.Errorf("%w: unknown permission id %s", ErrValidation, id)
		}
	}

	return u.roles.SetPermissions(ctx, roleID, businessID, permissionIDs)
}

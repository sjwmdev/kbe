package usecase

import (
	"context"
	"crypto/rand"
	"fmt"
	"math/big"
	"strings"

	"github.com/google/uuid"
	"golang.org/x/crypto/bcrypt"

	"backend/internal/domain"
)

// UserUsecase manages OTHER users' accounts (admin-facing CRUD). Deliberately
// separate from AuthUsecase, which only ever acts on the currently
// authenticated caller's own profile/password — different permission
// boundaries, so keeping them apart avoids one usecase doing double duty.
type UserUsecase struct {
	users domain.UserRepository
	roles domain.RoleRepository
}

func NewUserUsecase(users domain.UserRepository, roles domain.RoleRepository) *UserUsecase {
	return &UserUsecase{users: users, roles: roles}
}

func (u *UserUsecase) ListUsers(ctx context.Context, businessID uuid.UUID) ([]domain.User, error) {
	return u.users.FindAll(ctx, businessID)
}

type UserInput struct {
	Name   string
	Email  string
	RoleID *uuid.UUID
}

func (in UserInput) Validate() error {
	if in.Name == "" {
		return fmt.Errorf("%w: name is required", ErrValidation)
	}
	if in.Email == "" {
		return fmt.Errorf("%w: email is required", ErrValidation)
	}
	return nil
}

const generatedPasswordLength = 12
const passwordChars = "ABCDEFGHJKLMNPQRSTUVWXYZabcdefghijkmnopqrstuvwxyz23456789!@#$%"

// generateRandomPassword uses crypto/rand (not math/rand) since this value is
// a real credential, not a display detail.
func generateRandomPassword(length int) (string, error) {
	result := make([]byte, length)
	max := big.NewInt(int64(len(passwordChars)))
	for i := range result {
		n, err := rand.Int(rand.Reader, max)
		if err != nil {
			return "", fmt.Errorf("usecase: generate random password: %w", err)
		}
		result[i] = passwordChars[n.Int64()]
	}
	return string(result), nil
}

// CreateUser generates a random temporary password (shown to the admin
// exactly once — the caller is responsible for not persisting it anywhere)
// and forces a change on first login.
func (u *UserUsecase) CreateUser(ctx context.Context, in UserInput, businessID uuid.UUID) (*domain.User, string, error) {
	if err := in.Validate(); err != nil {
		return nil, "", err
	}

	password, err := generateRandomPassword(generatedPasswordLength)
	if err != nil {
		return nil, "", err
	}

	hash, err := bcrypt.GenerateFromPassword([]byte(password), bcrypt.DefaultCost)
	if err != nil {
		return nil, "", fmt.Errorf("usecase: hash password: %w", err)
	}

	username := in.Email
	if at := strings.Index(in.Email, "@"); at > 0 {
		username = in.Email[:at]
	}

	user := &domain.User{
		BusinessID:         businessID,
		Username:           username,
		Name:               in.Name,
		Email:              in.Email,
		PasswordHash:       string(hash),
		RoleID:             in.RoleID,
		MustChangePassword: true,
	}
	if err := u.users.Create(ctx, user); err != nil {
		return nil, "", err
	}

	if err := u.populateRoleName(ctx, user, businessID); err != nil {
		return nil, "", err
	}

	return user, password, nil
}

func (u *UserUsecase) UpdateUser(ctx context.Context, id uuid.UUID, in UserInput, businessID uuid.UUID) (*domain.User, error) {
	if err := in.Validate(); err != nil {
		return nil, err
	}

	existing, err := u.users.FindByID(ctx, id, businessID)
	if err != nil {
		return nil, err
	}
	if existing == nil {
		return nil, domain.ErrNotFound
	}

	existing.Name = in.Name
	existing.Email = in.Email
	existing.RoleID = in.RoleID

	if err := u.users.UpdateUser(ctx, existing); err != nil {
		return nil, err
	}

	if err := u.populateRoleName(ctx, existing, businessID); err != nil {
		return nil, err
	}

	return existing, nil
}

// populateRoleName resolves the role name for responses that don't come from
// FindAll's join — Create/UpdateUser write role_id but the in-memory struct
// they return has no way to know the corresponding role's name otherwise.
func (u *UserUsecase) populateRoleName(ctx context.Context, user *domain.User, businessID uuid.UUID) error {
	if user.RoleID == nil {
		user.RoleName = ""
		return nil
	}
	role, err := u.roles.FindByID(ctx, *user.RoleID, businessID)
	if err != nil {
		return err
	}
	if role != nil {
		user.RoleName = role.Name
	}
	return nil
}

// SetActive toggles a user's active flag, refusing to let a caller deactivate
// their own account or remove the last active SuperAdmin. Returns the
// updated user (matching every other single-resource PUT in this API,
// rather than a bare 204) so the caller doesn't need a second round trip to
// see the new state reflected.
func (u *UserUsecase) SetActive(ctx context.Context, businessID, callerID, targetID uuid.UUID, isActive bool) (*domain.User, error) {
	if !isActive {
		if targetID == callerID {
			return nil, fmt.Errorf("%w: you cannot deactivate your own account", ErrValidation)
		}
		if err := u.guardLastSuperAdmin(ctx, targetID, businessID); err != nil {
			return nil, err
		}
	}
	if err := u.users.SetActive(ctx, targetID, businessID, isActive); err != nil {
		return nil, err
	}

	user, err := u.users.FindByID(ctx, targetID, businessID)
	if err != nil {
		return nil, err
	}
	if user == nil {
		return nil, domain.ErrNotFound
	}
	if err := u.populateRoleName(ctx, user, businessID); err != nil {
		return nil, err
	}

	return user, nil
}

// DeleteUser refuses to let a caller delete their own account or remove the
// last remaining SuperAdmin — both are easy ways to permanently lock
// everyone out of the dashboard.
func (u *UserUsecase) DeleteUser(ctx context.Context, businessID, callerID, targetID uuid.UUID) error {
	if targetID == callerID {
		return fmt.Errorf("%w: you cannot delete your own account", ErrValidation)
	}
	if err := u.guardLastSuperAdmin(ctx, targetID, businessID); err != nil {
		return err
	}
	return u.users.Delete(ctx, targetID, businessID)
}

func (u *UserUsecase) guardLastSuperAdmin(ctx context.Context, targetID, businessID uuid.UUID) error {
	target, err := u.users.FindByID(ctx, targetID, businessID)
	if err != nil {
		return err
	}
	if target == nil {
		return domain.ErrNotFound
	}
	if target.RoleID == nil {
		return nil
	}

	role, err := u.roles.FindByID(ctx, *target.RoleID, businessID)
	if err != nil {
		return err
	}
	if role == nil || !role.IsSuperAdmin() {
		return nil
	}

	count, err := u.users.CountActiveByRole(ctx, *target.RoleID, businessID)
	if err != nil {
		return err
	}
	if count <= 1 {
		return fmt.Errorf("%w: cannot remove the last remaining SuperAdmin", ErrValidation)
	}

	return nil
}

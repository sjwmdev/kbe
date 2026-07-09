package usecase

import (
	"context"
	"fmt"
	"time"

	"github.com/google/uuid"
	"golang.org/x/crypto/bcrypt"

	"backend/internal/domain"
)

const (
	maxFailedLoginAttempts = 5
	lockoutDuration        = 15 * time.Minute
)

type AuthUsecase struct {
	users domain.UserRepository
}

func NewAuthUsecase(users domain.UserRepository) *AuthUsecase {
	return &AuthUsecase{users: users}
}

// Authenticate verifies admin credentials by email and returns the matching
// user. Token issuance is a delivery-layer concern, not a business rule.
//
// Brute-force guard: after maxFailedLoginAttempts wrong passwords in a row,
// the account is locked for lockoutDuration — checked before the password
// comparison even runs, so a locked-out attacker can't keep guessing.
func (u *AuthUsecase) Authenticate(ctx context.Context, email, password string) (*domain.User, error) {
	user, err := u.users.FindByEmail(ctx, email)
	if err != nil {
		return nil, err
	}
	if user == nil {
		return nil, domain.ErrInvalidCredentials
	}
	if !user.IsActive {
		return nil, domain.ErrAccountInactive
	}
	if user.LockedUntil != nil && user.LockedUntil.After(time.Now()) {
		return nil, domain.ErrAccountLocked
	}

	if err := bcrypt.CompareHashAndPassword([]byte(user.PasswordHash), []byte(password)); err != nil {
		attempts, incErr := u.users.IncrementFailedAttempts(ctx, user.ID)
		if incErr == nil && attempts >= maxFailedLoginAttempts {
			_ = u.users.LockUntil(ctx, user.ID, time.Now().Add(lockoutDuration))
		}
		return nil, domain.ErrInvalidCredentials
	}

	if err := u.users.ResetLoginAttempts(ctx, user.ID); err != nil {
		return nil, err
	}

	return user, nil
}

// GetProfile returns the current user's profile for the admin "Profile" page.
func (u *AuthUsecase) GetProfile(ctx context.Context, userID, businessID uuid.UUID) (*domain.User, error) {
	user, err := u.users.FindByID(ctx, userID, businessID)
	if err != nil {
		return nil, err
	}
	if user == nil {
		return nil, domain.ErrNotFound
	}
	return user, nil
}

type ProfileInput struct {
	Name  string
	Email string
}

func (in ProfileInput) Validate() error {
	if in.Name == "" {
		return fmt.Errorf("%w: name is required", ErrValidation)
	}
	if in.Email == "" {
		return fmt.Errorf("%w: email is required", ErrValidation)
	}
	return nil
}

// UpdateProfile changes the display name/email for the current admin user.
func (u *AuthUsecase) UpdateProfile(ctx context.Context, userID, businessID uuid.UUID, in ProfileInput) (*domain.User, error) {
	if err := in.Validate(); err != nil {
		return nil, err
	}

	user, err := u.users.FindByID(ctx, userID, businessID)
	if err != nil {
		return nil, err
	}
	if user == nil {
		return nil, domain.ErrNotFound
	}

	user.Name = in.Name
	user.Email = in.Email

	if err := u.users.UpdateProfile(ctx, user); err != nil {
		return nil, err
	}

	return user, nil
}

const minPasswordLength = 8

// ChangePassword requires the current password to be re-entered (even though
// the request is already authenticated via JWT) so a hijacked/left-open
// admin session can't be used to silently lock out the real owner. Clears
// MustChangePassword, lifting the forced-change gate for this user.
func (u *AuthUsecase) ChangePassword(ctx context.Context, userID, businessID uuid.UUID, currentPassword, newPassword string) error {
	if len(newPassword) < minPasswordLength {
		return fmt.Errorf("%w: new password must be at least %d characters", ErrValidation, minPasswordLength)
	}

	user, err := u.users.FindByID(ctx, userID, businessID)
	if err != nil {
		return err
	}
	if user == nil {
		return domain.ErrNotFound
	}

	if err := bcrypt.CompareHashAndPassword([]byte(user.PasswordHash), []byte(currentPassword)); err != nil {
		return domain.ErrInvalidCredentials
	}

	hash, err := bcrypt.GenerateFromPassword([]byte(newPassword), bcrypt.DefaultCost)
	if err != nil {
		return fmt.Errorf("usecase: hash new password: %w", err)
	}

	if err := u.users.UpdatePasswordHash(ctx, userID, string(hash)); err != nil {
		return err
	}

	return u.users.SetMustChangePassword(ctx, userID, false)
}

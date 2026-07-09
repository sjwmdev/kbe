package httpdelivery

import (
	"context"
	"encoding/json"
	"errors"
	"net/http"
	"time"

	"github.com/google/uuid"

	"backend/internal/domain"
	"backend/internal/usecase"
)

type AuthHandler struct {
	auth  *usecase.AuthUsecase
	roles *usecase.RoleUsecase
	audit *usecase.AuditLogUsecase
	tm    *TokenManager
}

func NewAuthHandler(auth *usecase.AuthUsecase, roles *usecase.RoleUsecase, audit *usecase.AuditLogUsecase, tm *TokenManager) *AuthHandler {
	return &AuthHandler{auth: auth, roles: roles, audit: audit, tm: tm}
}

// logLogin records a login attempt — /admin/login is public and never
// passes through the AuditLog middleware, so Login records its own attempts
// directly. userID is nil whenever the account can't be resolved (unknown
// email, wrong password) — username still records exactly what was typed,
// since "who tried this" matters even when the attempt fails.
func (h *AuthHandler) logLogin(ctx context.Context, r *http.Request, start time.Time, username string, userID *uuid.UUID, status int) {
	_ = h.audit.Record(ctx, &domain.AuditLog{
		UserID:     userID,
		Username:   username,
		Method:     r.Method,
		Path:       r.URL.Path,
		StatusCode: status,
		DurationMs: int(time.Since(start).Milliseconds()),
		IPAddress:  clientIP(r),
	})
}

// resolveRoleInfo returns a user's role name and effective permission keys
// (never nil, so JSON always serializes as [] rather than null). Shared by
// every response shape that needs to tell the frontend what the caller is
// allowed to do: login, password change (reissues a token), and /me
// (rehydrates RBAC state after a page refresh, since only the token itself
// is persisted client-side).
func (h *AuthHandler) resolveRoleInfo(ctx context.Context, user *domain.User) (roleName string, permissions []string) {
	permissions = []string{}
	if user.RoleID == nil {
		return "", permissions
	}

	if role, err := h.roles.GetRole(ctx, *user.RoleID, user.BusinessID); err == nil && role != nil {
		roleName = role.Name
	}
	if keys, err := h.roles.GetRolePermissionKeys(ctx, *user.RoleID, user.BusinessID); err == nil {
		permissions = keys
	}

	return roleName, permissions
}

type loginRequest struct {
	Email    string `json:"email"`
	Password string `json:"password"`
}

type loginResponse struct {
	Token              string   `json:"token"`
	MustChangePassword bool     `json:"must_change_password"`
	Role               string   `json:"role"`
	Permissions        []string `json:"permissions"`
}

// buildSessionResponse issues a fresh token from current DB state alongside
// the caller's role/permissions. Shared by Login and ChangePassword (the
// latter needs to reissue a token since MustChangePassword is baked into the
// JWT — see jwt.go).
func (h *AuthHandler) buildSessionResponse(ctx context.Context, user *domain.User) (loginResponse, error) {
	token, err := h.tm.Generate(user)
	if err != nil {
		return loginResponse{}, err
	}

	roleName, permissions := h.resolveRoleInfo(ctx, user)

	return loginResponse{
		Token:              token,
		MustChangePassword: user.MustChangePassword,
		Role:               roleName,
		Permissions:        permissions,
	}, nil
}

func (h *AuthHandler) Login(w http.ResponseWriter, r *http.Request) {
	start := time.Now()

	var req loginRequest
	if err := json.NewDecoder(r.Body).Decode(&req); err != nil {
		writeError(w, http.StatusBadRequest, "invalid request body")
		return
	}

	user, err := h.auth.Authenticate(r.Context(), req.Email, req.Password)
	switch {
	case errors.Is(err, domain.ErrAccountLocked):
		h.logLogin(r.Context(), r, start, req.Email, nil, http.StatusTooManyRequests)
		writeErrorCode(w, http.StatusTooManyRequests,
			"account temporarily locked due to too many failed attempts, try again later", "account_locked")
		return
	case errors.Is(err, domain.ErrAccountInactive):
		h.logLogin(r.Context(), r, start, req.Email, nil, http.StatusForbidden)
		writeErrorCode(w, http.StatusForbidden, "this account has been deactivated", "account_inactive")
		return
	case errors.Is(err, domain.ErrInvalidCredentials):
		h.logLogin(r.Context(), r, start, req.Email, nil, http.StatusUnauthorized)
		writeError(w, http.StatusUnauthorized, "invalid email or password")
		return
	case err != nil:
		h.logLogin(r.Context(), r, start, req.Email, nil, http.StatusInternalServerError)
		writeError(w, http.StatusInternalServerError, "failed to authenticate")
		return
	}

	resp, err := h.buildSessionResponse(r.Context(), user)
	if err != nil {
		h.logLogin(r.Context(), r, start, req.Email, nil, http.StatusInternalServerError)
		writeError(w, http.StatusInternalServerError, "failed to generate token")
		return
	}

	h.logLogin(r.Context(), r, start, user.Username, &user.ID, http.StatusOK)
	writeJSON(w, http.StatusOK, resp)
}

type profileDTO struct {
	ID                 string    `json:"id"`
	Username           string    `json:"username"`
	Name               string    `json:"name"`
	Email              string    `json:"email"`
	Role               string    `json:"role"`
	Permissions        []string  `json:"permissions"`
	MustChangePassword bool      `json:"must_change_password"`
	CreatedAt          time.Time `json:"created_at"`
	UpdatedAt          time.Time `json:"updated_at"`
}

func (h *AuthHandler) toProfileDTO(ctx context.Context, u domain.User) profileDTO {
	roleName, permissions := h.resolveRoleInfo(ctx, &u)

	return profileDTO{
		ID:                 u.ID.String(),
		Username:           u.Username,
		Name:               u.Name,
		Email:              u.Email,
		Role:               roleName,
		Permissions:        permissions,
		MustChangePassword: u.MustChangePassword,
		CreatedAt:          u.CreatedAt,
		UpdatedAt:          u.UpdatedAt,
	}
}

// Me handles GET /api/v1/admin/me (protected). Also used by the frontend to
// rehydrate role/permissions/must_change_password after a page refresh,
// since only the JWT itself is persisted in localStorage.
func (h *AuthHandler) Me(w http.ResponseWriter, r *http.Request) {
	claims, ok := ClaimsFromContext(r.Context())
	if !ok {
		writeError(w, http.StatusUnauthorized, "missing or malformed authorization header")
		return
	}

	user, err := h.auth.GetProfile(r.Context(), claims.UserID, claims.BusinessID)
	if handleUsecaseError(w, err) {
		return
	}

	writeJSON(w, http.StatusOK, h.toProfileDTO(r.Context(), *user))
}

type updateProfileRequest struct {
	Name  string `json:"name"`
	Email string `json:"email"`
}

// UpdateProfile handles PUT /api/v1/admin/me (protected).
func (h *AuthHandler) UpdateProfile(w http.ResponseWriter, r *http.Request) {
	claims, ok := ClaimsFromContext(r.Context())
	if !ok {
		writeError(w, http.StatusUnauthorized, "missing or malformed authorization header")
		return
	}

	var req updateProfileRequest
	if err := json.NewDecoder(r.Body).Decode(&req); err != nil {
		writeError(w, http.StatusBadRequest, "invalid request body")
		return
	}

	user, err := h.auth.UpdateProfile(r.Context(), claims.UserID, claims.BusinessID, usecase.ProfileInput{
		Name:  req.Name,
		Email: req.Email,
	})
	if handleUsecaseError(w, err) {
		return
	}

	writeJSON(w, http.StatusOK, h.toProfileDTO(r.Context(), *user))
}

type changePasswordRequest struct {
	CurrentPassword string `json:"current_password"`
	NewPassword     string `json:"new_password"`
}

// ChangePassword handles PUT /api/v1/admin/me/password (protected). Returns a
// freshly issued session (see buildSessionResponse) so the frontend can swap
// its stored token immediately and the must-change-password gate lifts
// without requiring a full re-login.
func (h *AuthHandler) ChangePassword(w http.ResponseWriter, r *http.Request) {
	claims, ok := ClaimsFromContext(r.Context())
	if !ok {
		writeError(w, http.StatusUnauthorized, "missing or malformed authorization header")
		return
	}

	var req changePasswordRequest
	if err := json.NewDecoder(r.Body).Decode(&req); err != nil {
		writeError(w, http.StatusBadRequest, "invalid request body")
		return
	}

	err := h.auth.ChangePassword(r.Context(), claims.UserID, claims.BusinessID, req.CurrentPassword, req.NewPassword)
	if errors.Is(err, domain.ErrInvalidCredentials) {
		writeError(w, http.StatusUnauthorized, "current password is incorrect")
		return
	}
	if handleUsecaseError(w, err) {
		return
	}

	user, err := h.auth.GetProfile(r.Context(), claims.UserID, claims.BusinessID)
	if err != nil {
		writeError(w, http.StatusInternalServerError, "password changed but failed to issue new session")
		return
	}

	resp, err := h.buildSessionResponse(r.Context(), user)
	if err != nil {
		writeError(w, http.StatusInternalServerError, "password changed but failed to issue new session")
		return
	}

	writeJSON(w, http.StatusOK, resp)
}

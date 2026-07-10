package httpdelivery

import (
	"encoding/json"
	"net/http"
	"time"

	"github.com/google/uuid"

	"backend/internal/domain"
	"backend/internal/usecase"
)

type UserHandler struct {
	users *usecase.UserUsecase
}

func NewUserHandler(users *usecase.UserUsecase) *UserHandler {
	return &UserHandler{users: users}
}

type userDTO struct {
	ID                          string    `json:"id"`
	Username                    string    `json:"username"`
	Name                        string    `json:"name"`
	Email                       string    `json:"email"`
	Phone                       string    `json:"phone"`
	DefaultCommunicationChannel string    `json:"default_communication_channel"`
	RoleID                      *string   `json:"role_id,omitempty"`
	RoleName                    string    `json:"role_name"`
	IsActive                    bool      `json:"is_active"`
	MustChangePassword          bool      `json:"must_change_password"`
	CreatedAt                   time.Time `json:"created_at"`
}

func toUserDTO(u domain.User) userDTO {
	var roleID *string
	if u.RoleID != nil {
		s := u.RoleID.String()
		roleID = &s
	}

	return userDTO{
		ID:                          u.ID.String(),
		Username:                    u.Username,
		Name:                        u.Name,
		Email:                       u.Email,
		Phone:                       u.Phone,
		DefaultCommunicationChannel: u.DefaultCommunicationChannel,
		RoleID:                      roleID,
		RoleName:                    u.RoleName,
		IsActive:                    u.IsActive,
		MustChangePassword:          u.MustChangePassword,
		CreatedAt:                   u.CreatedAt,
	}
}

// ListUsers handles GET /api/v1/admin/users (protected).
func (h *UserHandler) ListUsers(w http.ResponseWriter, r *http.Request) {
	claims, ok := ClaimsFromContext(r.Context())
	if !ok {
		writeError(w, http.StatusUnauthorized, "missing or malformed authorization header")
		return
	}

	users, err := h.users.ListUsers(r.Context(), claims.BusinessID)
	if err != nil {
		writeError(w, http.StatusInternalServerError, "failed to fetch users")
		return
	}

	dtos := make([]userDTO, 0, len(users))
	for _, u := range users {
		dtos = append(dtos, toUserDTO(u))
	}

	writeJSON(w, http.StatusOK, dtos)
}

type userRequest struct {
	Name   string  `json:"name"`
	Email  string  `json:"email"`
	RoleID *string `json:"role_id"`
}

func (req userRequest) toInput() (usecase.UserInput, error) {
	input := usecase.UserInput{Name: req.Name, Email: req.Email}
	if req.RoleID != nil && *req.RoleID != "" {
		id, err := uuid.Parse(*req.RoleID)
		if err != nil {
			return usecase.UserInput{}, err
		}
		input.RoleID = &id
	}
	return input, nil
}

type createUserResponse struct {
	User              userDTO `json:"user"`
	TemporaryPassword string  `json:"temporary_password"`
}

// CreateUser handles POST /api/v1/admin/users (protected). Returns the
// generated temporary password exactly once — the client must show it to the
// admin immediately and never fetch it again (it isn't stored in plaintext).
func (h *UserHandler) CreateUser(w http.ResponseWriter, r *http.Request) {
	claims, ok := ClaimsFromContext(r.Context())
	if !ok {
		writeError(w, http.StatusUnauthorized, "missing or malformed authorization header")
		return
	}

	var req userRequest
	if err := json.NewDecoder(r.Body).Decode(&req); err != nil {
		writeError(w, http.StatusBadRequest, "invalid request body")
		return
	}

	input, err := req.toInput()
	if err != nil {
		writeError(w, http.StatusBadRequest, "invalid role id")
		return
	}

	user, password, err := h.users.CreateUser(r.Context(), input, claims.BusinessID)
	if handleUsecaseError(w, err) {
		return
	}

	writeJSON(w, http.StatusCreated, createUserResponse{
		User:              toUserDTO(*user),
		TemporaryPassword: password,
	})
}

// UpdateUser handles PUT /api/v1/admin/users/{id} (protected).
func (h *UserHandler) UpdateUser(w http.ResponseWriter, r *http.Request) {
	claims, ok := ClaimsFromContext(r.Context())
	if !ok {
		writeError(w, http.StatusUnauthorized, "missing or malformed authorization header")
		return
	}

	id, err := uuid.Parse(r.PathValue("id"))
	if err != nil {
		writeError(w, http.StatusBadRequest, "invalid user id")
		return
	}

	var req userRequest
	if err := json.NewDecoder(r.Body).Decode(&req); err != nil {
		writeError(w, http.StatusBadRequest, "invalid request body")
		return
	}

	input, err := req.toInput()
	if err != nil {
		writeError(w, http.StatusBadRequest, "invalid role id")
		return
	}

	user, err := h.users.UpdateUser(r.Context(), id, input, claims.BusinessID)
	if handleUsecaseError(w, err) {
		return
	}

	writeJSON(w, http.StatusOK, toUserDTO(*user))
}

type setActiveRequest struct {
	IsActive bool `json:"is_active"`
}

// SetActive handles PUT /api/v1/admin/users/{id}/active (protected).
// ResetPassword handles POST /api/v1/admin/users/{id}/reset-password
// (protected, users.resetPassword). Like CreateUser, the generated
// temporary password appears in this response exactly once and is never
// retrievable again. The route runs through the standard mutation audit
// middleware, so every reset is logged with the acting admin.
func (h *UserHandler) ResetPassword(w http.ResponseWriter, r *http.Request) {
	claims, ok := ClaimsFromContext(r.Context())
	if !ok {
		writeError(w, http.StatusUnauthorized, "missing or malformed authorization header")
		return
	}

	id, err := uuid.Parse(r.PathValue("id"))
	if err != nil {
		writeError(w, http.StatusBadRequest, "invalid user id")
		return
	}

	user, password, err := h.users.ResetPassword(r.Context(), claims.BusinessID, claims.UserID, id)
	if handleUsecaseError(w, err) {
		return
	}

	writeJSON(w, http.StatusOK, createUserResponse{
		User:              toUserDTO(*user),
		TemporaryPassword: password,
	})
}

func (h *UserHandler) SetActive(w http.ResponseWriter, r *http.Request) {
	claims, ok := ClaimsFromContext(r.Context())
	if !ok {
		writeError(w, http.StatusUnauthorized, "missing or malformed authorization header")
		return
	}

	id, err := uuid.Parse(r.PathValue("id"))
	if err != nil {
		writeError(w, http.StatusBadRequest, "invalid user id")
		return
	}

	var req setActiveRequest
	if err := json.NewDecoder(r.Body).Decode(&req); err != nil {
		writeError(w, http.StatusBadRequest, "invalid request body")
		return
	}

	user, err := h.users.SetActive(r.Context(), claims.BusinessID, claims.UserID, id, req.IsActive)
	if handleUsecaseError(w, err) {
		return
	}

	writeJSON(w, http.StatusOK, toUserDTO(*user))
}

// DeleteUser handles DELETE /api/v1/admin/users/{id} (protected).
func (h *UserHandler) DeleteUser(w http.ResponseWriter, r *http.Request) {
	claims, ok := ClaimsFromContext(r.Context())
	if !ok {
		writeError(w, http.StatusUnauthorized, "missing or malformed authorization header")
		return
	}

	id, err := uuid.Parse(r.PathValue("id"))
	if err != nil {
		writeError(w, http.StatusBadRequest, "invalid user id")
		return
	}

	if err := h.users.DeleteUser(r.Context(), claims.BusinessID, claims.UserID, id); handleUsecaseError(w, err) {
		return
	}

	w.WriteHeader(http.StatusNoContent)
}

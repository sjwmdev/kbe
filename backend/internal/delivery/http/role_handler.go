package httpdelivery

import (
	"encoding/json"
	"net/http"
	"time"

	"github.com/google/uuid"

	"backend/internal/domain"
	"backend/internal/usecase"
)

type RoleHandler struct {
	roles *usecase.RoleUsecase
}

func NewRoleHandler(roles *usecase.RoleUsecase) *RoleHandler {
	return &RoleHandler{roles: roles}
}

type roleDTO struct {
	ID          string    `json:"id"`
	Name        string    `json:"name"`
	Description string    `json:"description"`
	CreatedAt   time.Time `json:"created_at"`
	UpdatedAt   time.Time `json:"updated_at"`
}

func toRoleDTO(r domain.Role) roleDTO {
	return roleDTO{
		ID:          r.ID.String(),
		Name:        r.Name,
		Description: r.Description,
		CreatedAt:   r.CreatedAt,
		UpdatedAt:   r.UpdatedAt,
	}
}

// ListRoles handles GET /api/v1/admin/roles (protected).
func (h *RoleHandler) ListRoles(w http.ResponseWriter, r *http.Request) {
	claims, ok := ClaimsFromContext(r.Context())
	if !ok {
		writeError(w, http.StatusUnauthorized, "missing or malformed authorization header")
		return
	}

	roles, err := h.roles.ListRoles(r.Context(), claims.BusinessID)
	if err != nil {
		writeError(w, http.StatusInternalServerError, "failed to fetch roles")
		return
	}

	dtos := make([]roleDTO, 0, len(roles))
	for _, role := range roles {
		dtos = append(dtos, toRoleDTO(role))
	}

	writeJSON(w, http.StatusOK, dtos)
}

type roleRequest struct {
	Name        string `json:"name"`
	Description string `json:"description"`
}

func (req roleRequest) toInput() usecase.RoleInput {
	return usecase.RoleInput{Name: req.Name, Description: req.Description}
}

// CreateRole handles POST /api/v1/admin/roles (protected).
func (h *RoleHandler) CreateRole(w http.ResponseWriter, r *http.Request) {
	claims, ok := ClaimsFromContext(r.Context())
	if !ok {
		writeError(w, http.StatusUnauthorized, "missing or malformed authorization header")
		return
	}

	var req roleRequest
	if err := json.NewDecoder(r.Body).Decode(&req); err != nil {
		writeError(w, http.StatusBadRequest, "invalid request body")
		return
	}

	role, err := h.roles.CreateRole(r.Context(), req.toInput(), claims.BusinessID)
	if handleUsecaseError(w, err) {
		return
	}

	writeJSON(w, http.StatusCreated, toRoleDTO(*role))
}

// UpdateRole handles PUT /api/v1/admin/roles/{id} (protected).
func (h *RoleHandler) UpdateRole(w http.ResponseWriter, r *http.Request) {
	claims, ok := ClaimsFromContext(r.Context())
	if !ok {
		writeError(w, http.StatusUnauthorized, "missing or malformed authorization header")
		return
	}

	id, err := uuid.Parse(r.PathValue("id"))
	if err != nil {
		writeError(w, http.StatusBadRequest, "invalid role id")
		return
	}

	var req roleRequest
	if err := json.NewDecoder(r.Body).Decode(&req); err != nil {
		writeError(w, http.StatusBadRequest, "invalid request body")
		return
	}

	role, err := h.roles.UpdateRole(r.Context(), id, req.toInput(), claims.BusinessID)
	if handleUsecaseError(w, err) {
		return
	}

	writeJSON(w, http.StatusOK, toRoleDTO(*role))
}

// DeleteRole handles DELETE /api/v1/admin/roles/{id} (protected).
func (h *RoleHandler) DeleteRole(w http.ResponseWriter, r *http.Request) {
	claims, ok := ClaimsFromContext(r.Context())
	if !ok {
		writeError(w, http.StatusUnauthorized, "missing or malformed authorization header")
		return
	}

	id, err := uuid.Parse(r.PathValue("id"))
	if err != nil {
		writeError(w, http.StatusBadRequest, "invalid role id")
		return
	}

	if err := h.roles.DeleteRole(r.Context(), id, claims.BusinessID); handleUsecaseError(w, err) {
		return
	}

	w.WriteHeader(http.StatusNoContent)
}

type permissionDTO struct {
	ID     string `json:"id"`
	Module string `json:"module"`
	Action string `json:"action"`
	Key    string `json:"key"`
}

func toPermissionDTO(p domain.Permission) permissionDTO {
	return permissionDTO{ID: p.ID.String(), Module: p.Module, Action: p.Action, Key: p.Key}
}

// ListPermissions handles GET /api/v1/admin/permissions (protected).
func (h *RoleHandler) ListPermissions(w http.ResponseWriter, r *http.Request) {
	permissions, err := h.roles.ListPermissions(r.Context())
	if err != nil {
		writeError(w, http.StatusInternalServerError, "failed to fetch permissions")
		return
	}

	dtos := make([]permissionDTO, 0, len(permissions))
	for _, p := range permissions {
		dtos = append(dtos, toPermissionDTO(p))
	}

	writeJSON(w, http.StatusOK, dtos)
}

// GetRolePermissions handles GET /api/v1/admin/roles/{id}/permissions (protected).
func (h *RoleHandler) GetRolePermissions(w http.ResponseWriter, r *http.Request) {
	claims, ok := ClaimsFromContext(r.Context())
	if !ok {
		writeError(w, http.StatusUnauthorized, "missing or malformed authorization header")
		return
	}

	id, err := uuid.Parse(r.PathValue("id"))
	if err != nil {
		writeError(w, http.StatusBadRequest, "invalid role id")
		return
	}

	ids, err := h.roles.GetRolePermissionIDs(r.Context(), id, claims.BusinessID)
	if handleUsecaseError(w, err) {
		return
	}

	permissionIDs := make([]string, 0, len(ids))
	for _, permID := range ids {
		permissionIDs = append(permissionIDs, permID.String())
	}

	writeJSON(w, http.StatusOK, map[string][]string{"permission_ids": permissionIDs})
}

type setRolePermissionsRequest struct {
	PermissionIDs []string `json:"permission_ids"`
}

// SetRolePermissions handles PUT /api/v1/admin/roles/{id}/permissions (protected).
func (h *RoleHandler) SetRolePermissions(w http.ResponseWriter, r *http.Request) {
	claims, ok := ClaimsFromContext(r.Context())
	if !ok {
		writeError(w, http.StatusUnauthorized, "missing or malformed authorization header")
		return
	}

	id, err := uuid.Parse(r.PathValue("id"))
	if err != nil {
		writeError(w, http.StatusBadRequest, "invalid role id")
		return
	}

	var req setRolePermissionsRequest
	if err := json.NewDecoder(r.Body).Decode(&req); err != nil {
		writeError(w, http.StatusBadRequest, "invalid request body")
		return
	}

	permissionIDs := make([]uuid.UUID, 0, len(req.PermissionIDs))
	for _, raw := range req.PermissionIDs {
		permID, err := uuid.Parse(raw)
		if err != nil {
			writeError(w, http.StatusBadRequest, "invalid permission id: "+raw)
			return
		}
		permissionIDs = append(permissionIDs, permID)
	}

	if err := h.roles.SetRolePermissions(r.Context(), id, claims.BusinessID, permissionIDs); handleUsecaseError(w, err) {
		return
	}

	writeJSON(w, http.StatusOK, map[string][]string{"permission_ids": req.PermissionIDs})
}

package httpdelivery

import (
	"encoding/json"
	"net/http"
	"time"

	"github.com/google/uuid"

	"backend/internal/domain"
	"backend/internal/usecase"
)

type CategoryHandler struct {
	categories          *usecase.CategoryUsecase
	businesses          *usecase.BusinessUsecase
	defaultBusinessSlug string
}

func NewCategoryHandler(categories *usecase.CategoryUsecase, businesses *usecase.BusinessUsecase, defaultBusinessSlug string) *CategoryHandler {
	return &CategoryHandler{categories: categories, businesses: businesses, defaultBusinessSlug: defaultBusinessSlug}
}

type categoryDTO struct {
	ID           string    `json:"id"`
	Name         string    `json:"name"`
	Slug         string    `json:"slug"`
	DisplayOrder int       `json:"display_order"`
	CreatedAt    time.Time `json:"created_at"`
	UpdatedAt    time.Time `json:"updated_at"`
}

func toCategoryDTO(c domain.Category) categoryDTO {
	return categoryDTO{
		ID:           c.ID.String(),
		Name:         c.Name,
		Slug:         c.Slug,
		DisplayOrder: c.DisplayOrder,
		CreatedAt:    c.CreatedAt,
		UpdatedAt:    c.UpdatedAt,
	}
}

// List handles GET /api/v1/categories — public, so the storefront can build
// its category filter sidebar/nav without needing to be logged in.
func (h *CategoryHandler) List(w http.ResponseWriter, r *http.Request) {
	businessID, err := resolvePublicBusinessID(r, h.businesses, h.defaultBusinessSlug)
	if err != nil {
		writeError(w, http.StatusNotFound, "business not found")
		return
	}

	categories, err := h.categories.List(r.Context(), businessID)
	if err != nil {
		writeError(w, http.StatusInternalServerError, "failed to fetch categories")
		return
	}

	dtos := make([]categoryDTO, 0, len(categories))
	for _, c := range categories {
		dtos = append(dtos, toCategoryDTO(c))
	}

	writeJSON(w, http.StatusOK, dtos)
}

// ListAdmin handles GET /api/v1/admin/categories (protected) — same data as
// the public List, just behind auth for consistency with every other
// /admin/* resource; the admin Categories page uses this one.
func (h *CategoryHandler) ListAdmin(w http.ResponseWriter, r *http.Request) {
	claims, ok := ClaimsFromContext(r.Context())
	if !ok {
		writeError(w, http.StatusUnauthorized, "missing or malformed authorization header")
		return
	}

	categories, err := h.categories.List(r.Context(), claims.BusinessID)
	if err != nil {
		writeError(w, http.StatusInternalServerError, "failed to fetch categories")
		return
	}

	dtos := make([]categoryDTO, 0, len(categories))
	for _, c := range categories {
		dtos = append(dtos, toCategoryDTO(c))
	}

	writeJSON(w, http.StatusOK, dtos)
}

type categoryRequest struct {
	Name         string `json:"name"`
	Slug         string `json:"slug"`
	DisplayOrder int    `json:"display_order"`
}

func (req categoryRequest) toInput() usecase.CategoryInput {
	return usecase.CategoryInput{Name: req.Name, Slug: req.Slug, DisplayOrder: req.DisplayOrder}
}

// Create handles POST /api/v1/admin/categories (protected).
func (h *CategoryHandler) Create(w http.ResponseWriter, r *http.Request) {
	claims, ok := ClaimsFromContext(r.Context())
	if !ok {
		writeError(w, http.StatusUnauthorized, "missing or malformed authorization header")
		return
	}

	var req categoryRequest
	if err := json.NewDecoder(r.Body).Decode(&req); err != nil {
		writeError(w, http.StatusBadRequest, "invalid request body")
		return
	}

	category, err := h.categories.Create(r.Context(), req.toInput(), claims.BusinessID)
	if handleUsecaseError(w, err) {
		return
	}

	writeJSON(w, http.StatusCreated, toCategoryDTO(*category))
}

// Update handles PUT /api/v1/admin/categories/{id} (protected).
func (h *CategoryHandler) Update(w http.ResponseWriter, r *http.Request) {
	claims, ok := ClaimsFromContext(r.Context())
	if !ok {
		writeError(w, http.StatusUnauthorized, "missing or malformed authorization header")
		return
	}

	id, err := uuid.Parse(r.PathValue("id"))
	if err != nil {
		writeError(w, http.StatusBadRequest, "invalid category id")
		return
	}

	var req categoryRequest
	if err := json.NewDecoder(r.Body).Decode(&req); err != nil {
		writeError(w, http.StatusBadRequest, "invalid request body")
		return
	}

	category, err := h.categories.Update(r.Context(), id, req.toInput(), claims.BusinessID)
	if handleUsecaseError(w, err) {
		return
	}

	writeJSON(w, http.StatusOK, toCategoryDTO(*category))
}

// Delete handles DELETE /api/v1/admin/categories/{id} (protected). Fails
// with a validation error (400) if any product still references this
// category — see domain.ErrCategoryInUse.
func (h *CategoryHandler) Delete(w http.ResponseWriter, r *http.Request) {
	claims, ok := ClaimsFromContext(r.Context())
	if !ok {
		writeError(w, http.StatusUnauthorized, "missing or malformed authorization header")
		return
	}

	id, err := uuid.Parse(r.PathValue("id"))
	if err != nil {
		writeError(w, http.StatusBadRequest, "invalid category id")
		return
	}

	if err := h.categories.Delete(r.Context(), id, claims.BusinessID); handleUsecaseError(w, err) {
		return
	}

	w.WriteHeader(http.StatusNoContent)
}

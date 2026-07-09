package httpdelivery

import (
	"encoding/json"
	"errors"
	"net/http"
	"strconv"
	"time"

	"github.com/google/uuid"

	"backend/internal/domain"
	"backend/internal/usecase"
)

type ProductHandler struct {
	products            *usecase.ProductUsecase
	roles               *usecase.RoleUsecase
	businesses          *usecase.BusinessUsecase
	defaultBusinessSlug string
}

func NewProductHandler(products *usecase.ProductUsecase, roles *usecase.RoleUsecase, businesses *usecase.BusinessUsecase, defaultBusinessSlug string) *ProductHandler {
	return &ProductHandler{products: products, roles: roles, businesses: businesses, defaultBusinessSlug: defaultBusinessSlug}
}

// isSuperAdmin resolves the caller's role from their JWT's RoleID.
// SuperAdmin bypasses both the products.view listing filter and the
// Update/Delete ownership check — "SuperAdmin sees all" per the task.
// Never bypasses the business_id tenant boundary itself.
func (h *ProductHandler) isSuperAdmin(r *http.Request, claims *Claims) bool {
	return h.roles.IsSuperAdminRole(r.Context(), claims.RoleID, claims.BusinessID)
}

type productImageDTO struct {
	ID        string `json:"id"`
	ImageURL  string `json:"image_url"`
	IsPrimary bool   `json:"is_primary"`
}

type productDTO struct {
	ID                string            `json:"id"`
	Name              string            `json:"name"`
	Description       string            `json:"description"`
	Price             float64           `json:"price"`
	CategoryID        string            `json:"category_id"`
	Category          string            `json:"category"`
	IsActive          bool              `json:"is_active"`
	StockQuantity     int               `json:"stock_quantity"`
	LowStockThreshold int               `json:"low_stock_threshold"`
	StockStatus       string            `json:"stock_status"`
	LikeCount         int               `json:"like_count"`
	Images            []productImageDTO `json:"images"`
	CreatedAt         time.Time         `json:"created_at"`
	UpdatedAt         time.Time         `json:"updated_at"`
}

func toProductDTO(p domain.Product) productDTO {
	images := make([]productImageDTO, 0, len(p.Images))
	for _, img := range p.Images {
		images = append(images, productImageDTO{
			ID:        img.ID.String(),
			ImageURL:  img.ImageURL,
			IsPrimary: img.IsPrimary,
		})
	}

	return productDTO{
		ID:                p.ID.String(),
		Name:              p.Name,
		Description:       p.Description,
		Price:             p.Price,
		CategoryID:        p.CategoryID.String(),
		Category:          p.CategoryName,
		IsActive:          p.IsActive,
		StockQuantity:     p.StockQuantity,
		LowStockThreshold: p.LowStockThreshold,
		StockStatus:       p.StockStatus(),
		LikeCount:         p.LikeCount,
		Images:            images,
		CreatedAt:         p.CreatedAt,
		UpdatedAt:         p.UpdatedAt,
	}
}

// List handles GET /api/v1/products — the public, paginated catalog
// listing. An optional ?category_id= filters server-side to one of the
// business's own (dynamic, admin-managed) categories.
func (h *ProductHandler) List(w http.ResponseWriter, r *http.Request) {
	businessID, err := resolvePublicBusinessID(r, h.businesses, h.defaultBusinessSlug)
	if err != nil {
		writeError(w, http.StatusNotFound, "business not found")
		return
	}

	var categoryID *uuid.UUID
	if raw := r.URL.Query().Get("category_id"); raw != "" {
		id, err := uuid.Parse(raw)
		if err != nil {
			writeError(w, http.StatusBadRequest, "invalid category_id")
			return
		}
		categoryID = &id
	}

	page, pageSize := parsePagination(r)

	products, total, err := h.products.ListActive(r.Context(), businessID, categoryID, page, pageSize)
	if err != nil {
		writeError(w, http.StatusInternalServerError, "failed to fetch products")
		return
	}

	dtos := make([]productDTO, 0, len(products))
	for _, p := range products {
		dtos = append(dtos, toProductDTO(p))
	}

	writeJSON(w, http.StatusOK, paginatedProductsResponse{
		Products: dtos,
		Total:    total,
		Page:     page,
		PageSize: pageSize,
	})
}

const (
	defaultPageSize = 20
	maxPageSize     = 100
)

func parsePagination(r *http.Request) (page, pageSize int) {
	page = 1
	if v, err := strconv.Atoi(r.URL.Query().Get("page")); err == nil && v > 0 {
		page = v
	}
	pageSize = defaultPageSize
	if v, err := strconv.Atoi(r.URL.Query().Get("page_size")); err == nil && v > 0 {
		pageSize = v
	}
	if pageSize > maxPageSize {
		pageSize = maxPageSize
	}
	return page, pageSize
}

type paginatedProductsResponse struct {
	Products []productDTO `json:"products"`
	Total    int          `json:"total"`
	Page     int          `json:"page"`
	PageSize int          `json:"page_size"`
}

// ListAll handles GET /api/v1/admin/products (protected). Unlike the public
// listing, this includes inactive (soft-deleted) products, is paginated, and
// is scoped to the caller's own products unless they're SuperAdmin.
func (h *ProductHandler) ListAll(w http.ResponseWriter, r *http.Request) {
	claims, ok := ClaimsFromContext(r.Context())
	if !ok {
		writeError(w, http.StatusUnauthorized, "missing or malformed authorization header")
		return
	}

	var createdBy *uuid.UUID
	if !h.isSuperAdmin(r, claims) {
		id := claims.UserID
		createdBy = &id
	}

	page, pageSize := parsePagination(r)
	products, total, err := h.products.ListAll(r.Context(), claims.BusinessID, createdBy, page, pageSize)
	if err != nil {
		writeError(w, http.StatusInternalServerError, "failed to fetch products")
		return
	}

	dtos := make([]productDTO, 0, len(products))
	for _, p := range products {
		dtos = append(dtos, toProductDTO(p))
	}

	writeJSON(w, http.StatusOK, paginatedProductsResponse{
		Products: dtos,
		Total:    total,
		Page:     page,
		PageSize: pageSize,
	})
}

// Get handles GET /api/v1/products/{id}.
func (h *ProductHandler) Get(w http.ResponseWriter, r *http.Request) {
	id, err := uuid.Parse(r.PathValue("id"))
	if err != nil {
		writeError(w, http.StatusBadRequest, "invalid product id")
		return
	}

	product, err := h.products.GetByID(r.Context(), id)
	if handleUsecaseError(w, err) {
		return
	}

	writeJSON(w, http.StatusOK, toProductDTO(*product))
}

// Like handles POST /api/v1/products/{id}/like.
func (h *ProductHandler) Like(w http.ResponseWriter, r *http.Request) {
	id, err := uuid.Parse(r.PathValue("id"))
	if err != nil {
		writeError(w, http.StatusBadRequest, "invalid product id")
		return
	}

	count, err := h.products.Like(r.Context(), id)
	if handleUsecaseError(w, err) {
		return
	}

	writeJSON(w, http.StatusOK, map[string]int{"like_count": count})
}

type productRequest struct {
	Name              string  `json:"name"`
	Description       string  `json:"description"`
	Price             float64 `json:"price"`
	CategoryID        string  `json:"category_id"`
	IsActive          *bool   `json:"is_active"`
	StockQuantity     int     `json:"stock_quantity"`
	LowStockThreshold int     `json:"low_stock_threshold"`
}

func (req productRequest) toInput() usecase.ProductInput {
	isActive := true
	if req.IsActive != nil {
		isActive = *req.IsActive
	}

	// An unparseable/empty category_id becomes the zero UUID, which
	// ProductInput.Validate() rejects with a clear "category is required"
	// error rather than a raw parse error.
	categoryID, _ := uuid.Parse(req.CategoryID)

	return usecase.ProductInput{
		Name:              req.Name,
		Description:       req.Description,
		Price:             req.Price,
		CategoryID:        categoryID,
		IsActive:          isActive,
		StockQuantity:     req.StockQuantity,
		LowStockThreshold: req.LowStockThreshold,
	}
}

// Create handles POST /api/v1/admin/products (protected).
func (h *ProductHandler) Create(w http.ResponseWriter, r *http.Request) {
	claims, ok := ClaimsFromContext(r.Context())
	if !ok {
		writeError(w, http.StatusUnauthorized, "missing or malformed authorization header")
		return
	}

	var req productRequest
	if err := json.NewDecoder(r.Body).Decode(&req); err != nil {
		writeError(w, http.StatusBadRequest, "invalid request body")
		return
	}

	product, err := h.products.Create(r.Context(), req.toInput(), claims.BusinessID, claims.UserID)
	if handleUsecaseError(w, err) {
		return
	}

	writeJSON(w, http.StatusCreated, toProductDTO(*product))
}

// Update handles PUT /api/v1/admin/products/{id} (protected).
func (h *ProductHandler) Update(w http.ResponseWriter, r *http.Request) {
	claims, ok := ClaimsFromContext(r.Context())
	if !ok {
		writeError(w, http.StatusUnauthorized, "missing or malformed authorization header")
		return
	}

	id, err := uuid.Parse(r.PathValue("id"))
	if err != nil {
		writeError(w, http.StatusBadRequest, "invalid product id")
		return
	}

	var req productRequest
	if err := json.NewDecoder(r.Body).Decode(&req); err != nil {
		writeError(w, http.StatusBadRequest, "invalid request body")
		return
	}

	product, err := h.products.Update(r.Context(), id, req.toInput(), claims.BusinessID, claims.UserID, h.isSuperAdmin(r, claims))
	if handleUsecaseError(w, err) {
		return
	}

	writeJSON(w, http.StatusOK, toProductDTO(*product))
}

// Delete handles DELETE /api/v1/admin/products/{id} (protected). This is a
// soft delete; the row is kept with is_active = false.
func (h *ProductHandler) Delete(w http.ResponseWriter, r *http.Request) {
	claims, ok := ClaimsFromContext(r.Context())
	if !ok {
		writeError(w, http.StatusUnauthorized, "missing or malformed authorization header")
		return
	}

	id, err := uuid.Parse(r.PathValue("id"))
	if err != nil {
		writeError(w, http.StatusBadRequest, "invalid product id")
		return
	}

	if err := h.products.Delete(r.Context(), id, claims.BusinessID, claims.UserID, h.isSuperAdmin(r, claims)); handleUsecaseError(w, err) {
		return
	}

	w.WriteHeader(http.StatusNoContent)
}

// handleUsecaseError writes an appropriate HTTP error response for a usecase
// error and reports whether the caller should stop handling the request.
func handleUsecaseError(w http.ResponseWriter, err error) bool {
	switch {
	case err == nil:
		return false
	case errors.Is(err, domain.ErrNotFound):
		writeError(w, http.StatusNotFound, "resource not found")
	case errors.Is(err, domain.ErrForbidden):
		writeError(w, http.StatusForbidden, "you do not have permission to modify this resource")
	case errors.Is(err, usecase.ErrValidation):
		writeError(w, http.StatusBadRequest, err.Error())
	case errors.Is(err, domain.ErrCategoryInUse):
		writeError(w, http.StatusBadRequest, err.Error())
	default:
		writeError(w, http.StatusInternalServerError, "internal server error")
	}
	return true
}

package httpdelivery

import (
	"encoding/json"
	"fmt"
	"net/http"
	"time"

	"github.com/google/uuid"

	"backend/internal/domain"
	"backend/internal/usecase"
)

type OrderHandler struct {
	orders *usecase.OrderUsecase
	roles  *usecase.RoleUsecase
}

func NewOrderHandler(orders *usecase.OrderUsecase, roles *usecase.RoleUsecase) *OrderHandler {
	return &OrderHandler{orders: orders, roles: roles}
}

func (h *OrderHandler) isSuperAdmin(r *http.Request, claims *Claims) bool {
	return h.roles.IsSuperAdminRole(r.Context(), claims.RoleID, claims.BusinessID)
}

type orderItemDTO struct {
	ID          string  `json:"id"`
	ProductID   string  `json:"product_id"`
	ProductName string  `json:"product_name"`
	Category    string  `json:"category"`
	Quantity    int     `json:"quantity"`
	UnitPrice   float64 `json:"unit_price"`
}

type customerDTO struct {
	ID    string `json:"id"`
	Name  string `json:"name"`
	Phone string `json:"phone"`
}

type orderDTO struct {
	ID          string         `json:"id"`
	Customer    customerDTO    `json:"customer"`
	Status      string         `json:"status"`
	TotalAmount float64        `json:"total_amount"`
	Items       []orderItemDTO `json:"items"`
	CreatedAt   time.Time      `json:"created_at"`
	UpdatedAt   time.Time      `json:"updated_at"`
}

func toOrderDTO(o domain.Order) orderDTO {
	items := make([]orderItemDTO, 0, len(o.Items))
	for _, item := range o.Items {
		items = append(items, orderItemDTO{
			ID:          item.ID.String(),
			ProductID:   item.ProductID.String(),
			ProductName: item.ProductName,
			Category:    item.CategoryName,
			Quantity:    item.Quantity,
			UnitPrice:   item.UnitPrice,
		})
	}

	return orderDTO{
		ID: o.ID.String(),
		Customer: customerDTO{
			ID:    o.Customer.ID.String(),
			Name:  o.Customer.Name,
			Phone: o.Customer.Phone,
		},
		Status:      string(o.Status),
		TotalAmount: o.TotalAmount,
		Items:       items,
		CreatedAt:   o.CreatedAt,
		UpdatedAt:   o.UpdatedAt,
	}
}

type paginatedOrdersResponse struct {
	Orders   []orderDTO `json:"orders"`
	Total    int        `json:"total"`
	Page     int        `json:"page"`
	PageSize int        `json:"page_size"`
}

// List handles GET /api/v1/admin/orders (protected). Scoped to the caller's
// own orders unless they're SuperAdmin.
func (h *OrderHandler) List(w http.ResponseWriter, r *http.Request) {
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
	orders, total, err := h.orders.List(r.Context(), claims.BusinessID, createdBy, page, pageSize)
	if err != nil {
		writeError(w, http.StatusInternalServerError, "failed to fetch orders")
		return
	}

	dtos := make([]orderDTO, 0, len(orders))
	for _, o := range orders {
		dtos = append(dtos, toOrderDTO(o))
	}

	writeJSON(w, http.StatusOK, paginatedOrdersResponse{
		Orders:   dtos,
		Total:    total,
		Page:     page,
		PageSize: pageSize,
	})
}

type orderItemRequest struct {
	ProductID string `json:"product_id"`
	Quantity  int    `json:"quantity"`
}

type orderRequest struct {
	CustomerName  string             `json:"customer_name"`
	CustomerPhone string             `json:"customer_phone"`
	Items         []orderItemRequest `json:"items"`
}

func (req orderRequest) toInput() (usecase.OrderInput, error) {
	items := make([]usecase.OrderItemInput, 0, len(req.Items))
	for _, item := range req.Items {
		productID, err := uuid.Parse(item.ProductID)
		if err != nil {
			return usecase.OrderInput{}, fmt.Errorf("%w: invalid product id", usecase.ErrValidation)
		}
		items = append(items, usecase.OrderItemInput{ProductID: productID, Quantity: item.Quantity})
	}

	return usecase.OrderInput{
		CustomerName:  req.CustomerName,
		CustomerPhone: req.CustomerPhone,
		Items:         items,
	}, nil
}

// Create handles POST /api/v1/admin/orders (protected) — records a
// WhatsApp-negotiated sale staff enter after the deal closes.
func (h *OrderHandler) Create(w http.ResponseWriter, r *http.Request) {
	claims, ok := ClaimsFromContext(r.Context())
	if !ok {
		writeError(w, http.StatusUnauthorized, "missing or malformed authorization header")
		return
	}

	var req orderRequest
	if err := json.NewDecoder(r.Body).Decode(&req); err != nil {
		writeError(w, http.StatusBadRequest, "invalid request body")
		return
	}

	input, err := req.toInput()
	if err != nil {
		writeError(w, http.StatusBadRequest, err.Error())
		return
	}

	order, err := h.orders.Create(r.Context(), input, claims.BusinessID, claims.UserID, h.isSuperAdmin(r, claims))
	if handleUsecaseError(w, err) {
		return
	}

	writeJSON(w, http.StatusCreated, toOrderDTO(*order))
}

type orderStatusRequest struct {
	Status string `json:"status"`
}

// UpdateStatus handles PUT /api/v1/admin/orders/{id}/status (protected).
// Transitioning to "cancelled" restocks the order's line items.
func (h *OrderHandler) UpdateStatus(w http.ResponseWriter, r *http.Request) {
	claims, ok := ClaimsFromContext(r.Context())
	if !ok {
		writeError(w, http.StatusUnauthorized, "missing or malformed authorization header")
		return
	}

	id, err := uuid.Parse(r.PathValue("id"))
	if err != nil {
		writeError(w, http.StatusBadRequest, "invalid order id")
		return
	}

	var req orderStatusRequest
	if err := json.NewDecoder(r.Body).Decode(&req); err != nil {
		writeError(w, http.StatusBadRequest, "invalid request body")
		return
	}

	order, err := h.orders.UpdateStatus(r.Context(), id, domain.OrderStatus(req.Status), claims.BusinessID, claims.UserID, h.isSuperAdmin(r, claims))
	if handleUsecaseError(w, err) {
		return
	}

	writeJSON(w, http.StatusOK, toOrderDTO(*order))
}

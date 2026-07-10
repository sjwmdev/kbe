package httpdelivery

import (
	"net/http"

	"github.com/google/uuid"

	"backend/internal/usecase"
)

type DashboardHandler struct {
	orders *usecase.OrderUsecase
	roles  *usecase.RoleUsecase
}

func NewDashboardHandler(orders *usecase.OrderUsecase, roles *usecase.RoleUsecase) *DashboardHandler {
	return &DashboardHandler{orders: orders, roles: roles}
}

type productPerformanceDTO struct {
	ProductID     string `json:"product_id"`
	ProductName   string `json:"product_name"`
	Category      string `json:"category"`
	UnitsSold     int    `json:"units_sold"`
	StockQuantity int    `json:"stock_quantity"`
}

type dashboardSummaryDTO struct {
	CanViewOrders           bool                    `json:"can_view_orders"`
	TotalSales              float64                 `json:"total_sales"`
	TotalSalesTrendPct      *float64                `json:"total_sales_trend_pct"`
	TotalOrders             int                     `json:"total_orders"`
	TotalOrdersTrendPct     *float64                `json:"total_orders_trend_pct"`
	ActiveCustomers         int                     `json:"active_customers"`
	ActiveCustomersTrendPct *float64                `json:"active_customers_trend_pct"`
	CanViewProducts         bool                    `json:"can_view_products"`
	ProductPerformance      []productPerformanceDTO `json:"product_performance"`
}

// GetSummary handles GET /api/v1/admin/dashboard/summary. No permission key
// gates the route itself — the "Muhtasari" dashboard nav item is visible to
// every authenticated role (see router.go's selfServiceGated) — but each
// section within it is gated on the caller's actual orders.view/
// products.view grants, both in what's computed (see
// OrderUsecase.DashboardSummary) and what's returned. Scoped to the
// caller's own orders/products unless they're SuperAdmin, same as every
// other admin listing.
func (h *DashboardHandler) GetSummary(w http.ResponseWriter, r *http.Request) {
	claims, ok := ClaimsFromContext(r.Context())
	if !ok {
		writeError(w, http.StatusUnauthorized, "missing or malformed authorization header")
		return
	}

	isSuperAdmin := h.roles.IsSuperAdminRole(r.Context(), claims.RoleID, claims.BusinessID)
	var createdBy *uuid.UUID
	if !isSuperAdmin {
		id := claims.UserID
		createdBy = &id
	}

	canViewOrders := isSuperAdmin
	canViewProducts := isSuperAdmin
	if !isSuperAdmin && claims.RoleID != nil {
		keys, err := h.roles.GetRolePermissionKeys(r.Context(), *claims.RoleID, claims.BusinessID)
		if err != nil {
			writeError(w, http.StatusInternalServerError, "failed to check permissions")
			return
		}
		for _, k := range keys {
			switch k {
			case "orders.view":
				canViewOrders = true
			case "products.view":
				canViewProducts = true
			}
		}
	}

	summary, err := h.orders.DashboardSummary(r.Context(), claims.BusinessID, createdBy, canViewOrders, canViewProducts)
	if err != nil {
		writeError(w, http.StatusInternalServerError, "failed to fetch dashboard summary")
		return
	}

	perf := make([]productPerformanceDTO, 0, len(summary.ProductPerformance))
	for _, p := range summary.ProductPerformance {
		perf = append(perf, productPerformanceDTO{
			ProductID:     p.ProductID.String(),
			ProductName:   p.ProductName,
			Category:      p.CategoryName,
			UnitsSold:     p.UnitsSold,
			StockQuantity: p.StockQuantity,
		})
	}

	writeJSON(w, http.StatusOK, dashboardSummaryDTO{
		CanViewOrders:           summary.CanViewOrders,
		TotalSales:              summary.TotalSales,
		TotalSalesTrendPct:      summary.TotalSalesTrendPct,
		TotalOrders:             summary.TotalOrders,
		TotalOrdersTrendPct:     summary.TotalOrdersTrendPct,
		ActiveCustomers:         summary.ActiveCustomers,
		ActiveCustomersTrendPct: summary.ActiveCustomersTrendPct,
		CanViewProducts:         summary.CanViewProducts,
		ProductPerformance:      perf,
	})
}

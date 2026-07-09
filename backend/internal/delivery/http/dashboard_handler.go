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
	ProductID   string `json:"product_id"`
	ProductName string `json:"product_name"`
	Category    string `json:"category"`
	UnitsSold   int    `json:"units_sold"`
	StockStatus string `json:"stock_status"`
}

type dashboardSummaryDTO struct {
	TotalSales              float64                 `json:"total_sales"`
	TotalSalesTrendPct      *float64                `json:"total_sales_trend_pct"`
	TotalOrders             int                     `json:"total_orders"`
	TotalOrdersTrendPct     *float64                `json:"total_orders_trend_pct"`
	ActiveCustomers         int                     `json:"active_customers"`
	ActiveCustomersTrendPct *float64                `json:"active_customers_trend_pct"`
	ProductPerformance      []productPerformanceDTO `json:"product_performance"`
}

// GetSummary handles GET /api/v1/admin/dashboard/summary. No permission key
// gates this — the "Muhtasari" dashboard itself is visible to every
// authenticated role, so its data follows the same rule (see router.go's
// selfServiceGated). Scoped to the caller's own orders/products unless
// they're SuperAdmin, same as every other admin listing.
func (h *DashboardHandler) GetSummary(w http.ResponseWriter, r *http.Request) {
	claims, ok := ClaimsFromContext(r.Context())
	if !ok {
		writeError(w, http.StatusUnauthorized, "missing or malformed authorization header")
		return
	}

	var createdBy *uuid.UUID
	if !h.roles.IsSuperAdminRole(r.Context(), claims.RoleID, claims.BusinessID) {
		id := claims.UserID
		createdBy = &id
	}

	summary, err := h.orders.DashboardSummary(r.Context(), claims.BusinessID, createdBy)
	if err != nil {
		writeError(w, http.StatusInternalServerError, "failed to fetch dashboard summary")
		return
	}

	perf := make([]productPerformanceDTO, 0, len(summary.ProductPerformance))
	for _, p := range summary.ProductPerformance {
		perf = append(perf, productPerformanceDTO{
			ProductID:   p.ProductID.String(),
			ProductName: p.ProductName,
			Category:    p.CategoryName,
			UnitsSold:   p.UnitsSold,
			StockStatus: p.StockStatus,
		})
	}

	writeJSON(w, http.StatusOK, dashboardSummaryDTO{
		TotalSales:              summary.TotalSales,
		TotalSalesTrendPct:      summary.TotalSalesTrendPct,
		TotalOrders:             summary.TotalOrders,
		TotalOrdersTrendPct:     summary.TotalOrdersTrendPct,
		ActiveCustomers:         summary.ActiveCustomers,
		ActiveCustomersTrendPct: summary.ActiveCustomersTrendPct,
		ProductPerformance:      perf,
	})
}

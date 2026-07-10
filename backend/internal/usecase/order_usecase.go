package usecase

import (
	"context"
	"fmt"
	"time"

	"github.com/google/uuid"

	"backend/internal/domain"
)

// dashboardWindow is the lookback used for every dashboard figure ("recent"
// business health, not lifetime totals) and its trend comparison is against
// the equally-sized preceding window.
const dashboardWindow = 30 * 24 * time.Hour

// OrderItemInput is one requested line item — a product plus how many units
// of it the customer is buying.
type OrderItemInput struct {
	ProductID uuid.UUID
	Quantity  int
}

// OrderInput carries the fields staff enter when recording a WhatsApp-
// negotiated sale.
type OrderInput struct {
	CustomerName  string
	CustomerPhone string
	Items         []OrderItemInput
}

func (in OrderInput) Validate() error {
	if in.CustomerName == "" {
		return fmt.Errorf("%w: customer name is required", ErrValidation)
	}
	if in.CustomerPhone == "" {
		return fmt.Errorf("%w: customer phone is required", ErrValidation)
	}
	if len(in.Items) == 0 {
		return fmt.Errorf("%w: at least one item is required", ErrValidation)
	}
	for _, item := range in.Items {
		if item.Quantity <= 0 {
			return fmt.Errorf("%w: item quantity must be positive", ErrValidation)
		}
	}

	return nil
}

// DashboardSummary is the single aggregate the "Muhtasari" page renders —
// one usecase call assembling everything, matching the page's original
// one-fetch simplicity. Trend fields are nil when the prior window had no
// baseline to compare against (avoids a divide-by-zero "infinite%" figure).
type DashboardSummary struct {
	CanViewOrders           bool
	TotalSales              float64
	TotalSalesTrendPct      *float64
	TotalOrders             int
	TotalOrdersTrendPct     *float64
	ActiveCustomers         int
	ActiveCustomersTrendPct *float64
	CanViewProducts         bool
	ProductPerformance      []domain.ProductPerformance
}

type OrderUsecase struct {
	orders        domain.OrderRepository
	customers     domain.CustomerRepository
	products      domain.ProductRepository
	notifications *NotificationUsecase
}

func NewOrderUsecase(orders domain.OrderRepository, customers domain.CustomerRepository, products domain.ProductRepository, notifications *NotificationUsecase) *OrderUsecase {
	return &OrderUsecase{orders: orders, customers: customers, products: products, notifications: notifications}
}

// Create finds-or-creates the customer by phone, validates each line item's
// product (exists, belongs to businessID, owned by the caller unless
// SuperAdmin, has enough stock), snapshots prices, and records the order.
// Stock is decremented by the repository within its own transaction. Once
// the order is recorded, any item whose stock is now at or below its
// low-stock threshold raises an admin notification.
//
// businessID is checked unconditionally, even for SuperAdmin — SuperAdmin
// only ever bypasses the created_by ownership check within their own
// business, never the tenant boundary itself.
func (u *OrderUsecase) Create(ctx context.Context, in OrderInput, businessID, createdBy uuid.UUID, isSuperAdmin bool) (*domain.Order, error) {
	if err := in.Validate(); err != nil {
		return nil, err
	}

	customer, err := u.customers.FindOrCreateByPhone(ctx, businessID, in.CustomerName, in.CustomerPhone)
	if err != nil {
		return nil, err
	}

	items := make([]domain.OrderItem, 0, len(in.Items))
	type stockCheck struct {
		productID         uuid.UUID
		productName       string
		newStock          int
		lowStockThreshold int
	}
	stockChecks := make([]stockCheck, 0, len(in.Items))
	var total float64
	for _, line := range in.Items {
		product, err := u.products.FindByID(ctx, line.ProductID)
		if err != nil {
			return nil, err
		}
		if product == nil || product.BusinessID != businessID {
			return nil, fmt.Errorf("%w: product not found", domain.ErrNotFound)
		}
		if !isSuperAdmin && (product.CreatedBy == nil || *product.CreatedBy != createdBy) {
			return nil, domain.ErrForbidden
		}
		if product.StockQuantity < line.Quantity {
			return nil, fmt.Errorf("%w: insufficient stock for %s", ErrValidation, product.Name)
		}

		items = append(items, domain.OrderItem{
			ProductID:    product.ID,
			ProductName:  product.Name,
			CategoryName: product.CategoryName,
			Quantity:     line.Quantity,
			UnitPrice:    product.Price,
		})
		stockChecks = append(stockChecks, stockCheck{
			productID:         product.ID,
			productName:       product.Name,
			newStock:          product.StockQuantity - line.Quantity,
			lowStockThreshold: product.LowStockThreshold,
		})
		total += product.Price * float64(line.Quantity)
	}

	order := &domain.Order{
		BusinessID:  businessID,
		Customer:    *customer,
		Status:      domain.OrderPending,
		TotalAmount: total,
		Items:       items,
		CreatedBy:   &createdBy,
	}

	created, err := u.orders.Create(ctx, order)
	if err != nil {
		return nil, err
	}

	// Best-effort: a notification failure must never fail an already-recorded
	// order.
	for _, check := range stockChecks {
		if check.newStock <= check.lowStockThreshold {
			_ = u.notifications.NotifyLowStock(ctx, businessID, check.productID, check.productName, check.newStock)
		}
	}

	return created, nil
}

// List returns a page of orders scoped to businessID. createdBy nil means no
// additional ownership filter within that business (SuperAdmin); non-nil
// scopes further to that user's own orders.
func (u *OrderUsecase) List(ctx context.Context, businessID uuid.UUID, createdBy *uuid.UUID, page, pageSize int) ([]domain.Order, int, error) {
	return u.orders.List(ctx, businessID, createdBy, page, pageSize)
}

// UpdateStatus enforces the same data-isolation rule as ProductUsecase: the
// order must belong to businessID (checked unconditionally, even for
// SuperAdmin — the tenant boundary is never bypassed), and a non-SuperAdmin
// caller may only change the status of an order they created.
func (u *OrderUsecase) UpdateStatus(ctx context.Context, id uuid.UUID, status domain.OrderStatus, businessID, callerID uuid.UUID, isSuperAdmin bool) (*domain.Order, error) {
	switch status {
	case domain.OrderPending, domain.OrderConfirmed, domain.OrderDelivered, domain.OrderCancelled:
	default:
		return nil, fmt.Errorf("%w: invalid order status", ErrValidation)
	}

	existing, err := u.orders.FindByID(ctx, id)
	if err != nil {
		return nil, err
	}
	if existing == nil || existing.BusinessID != businessID {
		return nil, domain.ErrNotFound
	}
	if !isSuperAdmin && (existing.CreatedBy == nil || *existing.CreatedBy != callerID) {
		return nil, domain.ErrForbidden
	}

	return u.orders.UpdateStatus(ctx, id, status)
}

// DashboardSummary computes the current 30-day window and its trend versus
// the preceding 30-day window, plus the top 5 products by units sold in the
// current window, all scoped to businessID. createdBy nil means no
// additional ownership filter (SuperAdmin sees the whole business).
//
// canViewOrders/canViewProducts gate not just what the response shows but
// which queries even run — a role without orders.view never causes sales/
// order/customer figures to be computed at all, and one without
// products.view never causes the product performance query to run. This is
// the enforcement point, not just a UI hint: the frontend hides sections
// based on the same permissions, but that's cosmetic without this backend
// gate.
func (u *OrderUsecase) DashboardSummary(ctx context.Context, businessID uuid.UUID, createdBy *uuid.UUID, canViewOrders, canViewProducts bool) (DashboardSummary, error) {
	summary := DashboardSummary{CanViewOrders: canViewOrders, CanViewProducts: canViewProducts}
	now := time.Now()
	currentStart := now.Add(-dashboardWindow)
	previousStart := currentStart.Add(-dashboardWindow)

	if canViewOrders {
		currentSales, currentOrders, err := u.orders.SummaryStats(ctx, businessID, createdBy, currentStart, now)
		if err != nil {
			return DashboardSummary{}, err
		}
		previousSales, previousOrders, err := u.orders.SummaryStats(ctx, businessID, createdBy, previousStart, currentStart)
		if err != nil {
			return DashboardSummary{}, err
		}

		currentCustomers, err := u.customers.CountActiveSince(ctx, businessID, createdBy, currentStart, now)
		if err != nil {
			return DashboardSummary{}, err
		}
		previousCustomers, err := u.customers.CountActiveSince(ctx, businessID, createdBy, previousStart, currentStart)
		if err != nil {
			return DashboardSummary{}, err
		}

		summary.TotalSales = currentSales
		summary.TotalSalesTrendPct = trendPct(currentSales, previousSales)
		summary.TotalOrders = currentOrders
		summary.TotalOrdersTrendPct = trendPct(float64(currentOrders), float64(previousOrders))
		summary.ActiveCustomers = currentCustomers
		summary.ActiveCustomersTrendPct = trendPct(float64(currentCustomers), float64(previousCustomers))
	}

	if canViewProducts {
		topProducts, err := u.orders.TopProductPerformance(ctx, businessID, createdBy, currentStart, 5)
		if err != nil {
			return DashboardSummary{}, err
		}
		summary.ProductPerformance = topProducts
	}

	return summary, nil
}

// ProductSummary returns one product's all-time, non-cancelled order
// history — backs the admin product details page's "orders summary"
// section. Always scoped to businessID.
func (u *OrderUsecase) ProductSummary(ctx context.Context, businessID, productID uuid.UUID) (domain.ProductOrderSummary, error) {
	return u.orders.ProductOrderSummary(ctx, businessID, productID)
}

// trendPct returns the percentage change from previous to current, or nil
// when previous is zero (no baseline to compare against).
func trendPct(current, previous float64) *float64 {
	if previous == 0 {
		return nil
	}
	pct := ((current - previous) / previous) * 100
	return &pct
}

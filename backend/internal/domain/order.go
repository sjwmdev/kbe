package domain

import (
	"time"

	"github.com/google/uuid"
)

type OrderStatus string

const (
	OrderPending   OrderStatus = "pending"
	OrderConfirmed OrderStatus = "confirmed"
	OrderDelivered OrderStatus = "delivered"
	OrderCancelled OrderStatus = "cancelled"
)

// OrderItem is a line item within an Order. UnitPrice is snapshotted at
// order-creation time (not joined live from products) so a later price
// change on the product never rewrites a historical order's total — the
// same reasoning as AuditLog.Username being a denormalized snapshot.
type OrderItem struct {
	ID           uuid.UUID
	ProductID    uuid.UUID
	ProductName  string
	CategoryName string
	Quantity     int
	UnitPrice    float64
}

// Order is a manually-recorded sale: staff enter it after a WhatsApp
// negotiation closes. CreatedBy scopes visibility the same way
// Product.CreatedBy does — non-SuperAdmin staff see only their own orders.
type Order struct {
	ID          uuid.UUID
	BusinessID  uuid.UUID
	Customer    Customer
	Status      OrderStatus
	TotalAmount float64
	Items       []OrderItem
	CreatedBy   *uuid.UUID
	CreatedAt   time.Time
	UpdatedAt   time.Time
}

// ProductPerformance is one row of the dashboard's "recent product
// performance" table — a product plus how many units of it sold within the
// usecase-supplied lookback window.
type ProductPerformance struct {
	ProductID    uuid.UUID
	ProductName  string
	CategoryName string
	UnitsSold    int
	StockStatus  string
}

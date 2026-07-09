package domain

import (
	"time"

	"github.com/google/uuid"
)

const (
	StockStatusOutOfStock = "out_of_stock"
	StockStatusLowStock   = "low_stock"
	StockStatusInStock    = "in_stock"
)

type Product struct {
	ID                uuid.UUID
	BusinessID        uuid.UUID
	Name              string
	Description       string
	Price             float64
	CategoryID        uuid.UUID
	IsActive          bool
	StockQuantity     int
	LowStockThreshold int
	CreatedBy         *uuid.UUID
	CreatedAt         time.Time
	UpdatedAt         time.Time

	// Populated by joins, not persisted directly on the products table.
	Images       []ProductImage
	LikeCount    int
	CategoryName string
	CategorySlug string
}

// StockStatus classifies the product's current stock level. Single source of
// truth reused by both the admin product table and the dashboard's product
// performance table, mirroring Role.IsSuperAdmin()'s pattern.
func (p Product) StockStatus() string {
	switch {
	case p.StockQuantity <= 0:
		return StockStatusOutOfStock
	case p.StockQuantity <= p.LowStockThreshold:
		return StockStatusLowStock
	default:
		return StockStatusInStock
	}
}

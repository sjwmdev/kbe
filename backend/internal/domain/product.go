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

// ValidProductColors is the fixed catalog of selectable product colors —
// deliberately a closed list (not free text) so the public color filter
// always matches real, consistent values.
var ValidProductColors = []string{
	"Black", "White", "Blue", "Green", "Brown", "Yellow", "Red", "Pink",
	"Gold", "Rose Gold", "Beige", "Nude", "Cream", "Silver",
}

// IsValidProductColor reports whether color is one of ValidProductColors.
func IsValidProductColor(color string) bool {
	for _, c := range ValidProductColors {
		if c == color {
			return true
		}
	}
	return false
}

// ProductFilter carries the public catalog's optional filter dimensions —
// each nil field means "no filter" on that dimension.
type ProductFilter struct {
	CategoryID *uuid.UUID
	Color      *string
	MinPrice   *float64
	MaxPrice   *float64
}

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
	Colors            []string
	CreatedBy         *uuid.UUID
	CreatedAt         time.Time
	UpdatedAt         time.Time

	// Populated by joins, not persisted directly on the products table.
	Images        []ProductImage
	LikeCount     int
	CategoryName  string
	CategorySlug  string
	CreatedByName string
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

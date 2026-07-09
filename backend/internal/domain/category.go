package domain

import (
	"time"

	"github.com/google/uuid"
)

// Category is a business-defined product grouping (replacing the old fixed
// perfume/cosmetics/shoes enum) — every business manages its own set.
type Category struct {
	ID           uuid.UUID
	BusinessID   uuid.UUID
	Name         string
	Slug         string
	DisplayOrder int
	CreatedAt    time.Time
	UpdatedAt    time.Time
}

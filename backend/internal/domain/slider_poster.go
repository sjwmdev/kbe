package domain

import (
	"time"

	"github.com/google/uuid"
)

// SliderPoster is a promotional banner shown in the homepage hero slider.
// LinkCategory is either empty (no link) or a valid ProductCategory.
type SliderPoster struct {
	ID           uuid.UUID
	BusinessID   uuid.UUID
	ImageURL     string
	LinkCategory string
	DisplayOrder int
	IsActive     bool
	CreatedAt    time.Time
}

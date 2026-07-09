package domain

import (
	"time"

	"github.com/google/uuid"
)

// Business is a tenant — one subscriber on the platform. Every business-owned
// row in the system (products, orders, roles, media, etc.) is scoped to
// exactly one Business via a business_id column.
type Business struct {
	ID        uuid.UUID
	Name      string
	Slug      string
	IsActive  bool
	CreatedAt time.Time
	UpdatedAt time.Time
}

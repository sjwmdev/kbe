package domain

import (
	"time"

	"github.com/google/uuid"
)

// Customer is a lightweight record captured at order-entry time (there is no
// customer login/account system — sales are negotiated over WhatsApp), keyed
// by phone number so repeat customers are recognized across orders.
type Customer struct {
	ID         uuid.UUID
	BusinessID uuid.UUID
	Name       string
	Phone      string
	CreatedAt  time.Time
}

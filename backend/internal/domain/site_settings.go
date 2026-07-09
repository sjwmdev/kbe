package domain

import (
	"time"

	"github.com/google/uuid"
)

// SiteSettings holds one business's row of admin-editable contact details and
// branding, consumed by that business's public site (WhatsApp number,
// contact info, social links, company name, logo, brand colors).
type SiteSettings struct {
	BusinessID           uuid.UUID
	WhatsAppNumber       string
	ContactEmail         string
	ContactAddress       string
	InstagramURL         string
	FacebookURL          string
	CompanyName          string
	LogoLightURL         string
	LogoDarkURL          string
	BrandAccentColor     string
	BrandAccentColorDark string
	UpdatedAt            time.Time
}

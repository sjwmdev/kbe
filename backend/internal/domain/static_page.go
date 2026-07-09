package domain

import (
	"time"

	"github.com/google/uuid"
)

// StaticPageSlug identifies one of the site's admin-editable static pages.
type StaticPageSlug string

const (
	PageAbout   StaticPageSlug = "about"
	PageContact StaticPageSlug = "contact"
	PagePrivacy StaticPageSlug = "privacy"
	PageTerms   StaticPageSlug = "terms"
)

// StaticPage is admin-editable copy for one of the site's static pages.
type StaticPage struct {
	BusinessID uuid.UUID
	Slug       StaticPageSlug
	Title      string
	Body       string
	UpdatedAt  time.Time
}

package httpdelivery

import (
	"net/http"

	"github.com/google/uuid"

	"backend/internal/usecase"
)

// resolvePublicBusinessID determines which business's data an unauthenticated
// public request (product catalog, sliders, settings, static pages) should
// see. There is no JWT here to carry a BusinessID claim, so the caller may
// pass ?business=<slug>; omitting it (the case for every request the
// existing single-tenant frontend sends) falls back to defaultSlug. This
// keeps today's Kalour-only frontend working unmodified while still letting
// a second tenant's storefront be reached (e.g. for testing) via the query
// param, without needing subdomain routing built out yet.
func resolvePublicBusinessID(r *http.Request, businesses *usecase.BusinessUsecase, defaultSlug string) (uuid.UUID, error) {
	slug := r.URL.Query().Get("business")
	if slug == "" {
		slug = defaultSlug
	}

	business, err := businesses.GetBySlug(r.Context(), slug)
	if err != nil {
		return uuid.UUID{}, err
	}

	return business.ID, nil
}

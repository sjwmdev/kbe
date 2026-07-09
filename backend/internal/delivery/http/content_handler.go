package httpdelivery

import (
	"encoding/json"
	"net/http"
	"time"

	"github.com/google/uuid"

	"backend/internal/domain"
	"backend/internal/usecase"
)

type ContentHandler struct {
	content             *usecase.ContentUsecase
	media               *usecase.MediaUsecase
	businesses          *usecase.BusinessUsecase
	defaultBusinessSlug string
	uploadsDir          string
	publicBase          string
}

func NewContentHandler(content *usecase.ContentUsecase, media *usecase.MediaUsecase, businesses *usecase.BusinessUsecase, defaultBusinessSlug, uploadsDir, publicBase string) *ContentHandler {
	return &ContentHandler{
		content:             content,
		media:               media,
		businesses:          businesses,
		defaultBusinessSlug: defaultBusinessSlug,
		uploadsDir:          uploadsDir,
		publicBase:          publicBase,
	}
}

// --- Settings ---

type settingsDTO struct {
	WhatsAppNumber       string    `json:"whatsapp_number"`
	ContactEmail         string    `json:"contact_email"`
	ContactAddress       string    `json:"contact_address"`
	InstagramURL         string    `json:"instagram_url"`
	FacebookURL          string    `json:"facebook_url"`
	CompanyName          string    `json:"company_name"`
	LogoLightURL         string    `json:"logo_light_url"`
	LogoDarkURL          string    `json:"logo_dark_url"`
	BrandAccentColor     string    `json:"brand_accent_color"`
	BrandAccentColorDark string    `json:"brand_accent_color_dark"`
	UpdatedAt            time.Time `json:"updated_at"`
}

func toSettingsDTO(s domain.SiteSettings) settingsDTO {
	return settingsDTO{
		WhatsAppNumber:       s.WhatsAppNumber,
		ContactEmail:         s.ContactEmail,
		ContactAddress:       s.ContactAddress,
		InstagramURL:         s.InstagramURL,
		FacebookURL:          s.FacebookURL,
		CompanyName:          s.CompanyName,
		LogoLightURL:         s.LogoLightURL,
		LogoDarkURL:          s.LogoDarkURL,
		BrandAccentColor:     s.BrandAccentColor,
		BrandAccentColorDark: s.BrandAccentColorDark,
		UpdatedAt:            s.UpdatedAt,
	}
}

// GetSettings handles GET /api/v1/settings.
func (h *ContentHandler) GetSettings(w http.ResponseWriter, r *http.Request) {
	businessID, err := resolvePublicBusinessID(r, h.businesses, h.defaultBusinessSlug)
	if err != nil {
		writeError(w, http.StatusNotFound, "business not found")
		return
	}

	settings, err := h.content.GetSettings(r.Context(), businessID)
	if err != nil {
		writeError(w, http.StatusInternalServerError, "failed to fetch settings")
		return
	}

	writeJSON(w, http.StatusOK, toSettingsDTO(*settings))
}

type settingsRequest struct {
	WhatsAppNumber       string `json:"whatsapp_number"`
	ContactEmail         string `json:"contact_email"`
	ContactAddress       string `json:"contact_address"`
	InstagramURL         string `json:"instagram_url"`
	FacebookURL          string `json:"facebook_url"`
	CompanyName          string `json:"company_name"`
	LogoLightURL         string `json:"logo_light_url"`
	LogoDarkURL          string `json:"logo_dark_url"`
	BrandAccentColor     string `json:"brand_accent_color"`
	BrandAccentColorDark string `json:"brand_accent_color_dark"`
}

func (req settingsRequest) toInput() usecase.SettingsInput {
	return usecase.SettingsInput{
		WhatsAppNumber:       req.WhatsAppNumber,
		ContactEmail:         req.ContactEmail,
		ContactAddress:       req.ContactAddress,
		InstagramURL:         req.InstagramURL,
		FacebookURL:          req.FacebookURL,
		CompanyName:          req.CompanyName,
		LogoLightURL:         req.LogoLightURL,
		LogoDarkURL:          req.LogoDarkURL,
		BrandAccentColor:     req.BrandAccentColor,
		BrandAccentColorDark: req.BrandAccentColorDark,
	}
}

// UpdateSettings handles PUT /api/v1/admin/settings (protected).
func (h *ContentHandler) UpdateSettings(w http.ResponseWriter, r *http.Request) {
	claims, ok := ClaimsFromContext(r.Context())
	if !ok {
		writeError(w, http.StatusUnauthorized, "missing or malformed authorization header")
		return
	}

	var req settingsRequest
	if err := json.NewDecoder(r.Body).Decode(&req); err != nil {
		writeError(w, http.StatusBadRequest, "invalid request body")
		return
	}

	settings, err := h.content.UpdateSettings(r.Context(), req.toInput(), claims.BusinessID)
	if handleUsecaseError(w, err) {
		return
	}

	writeJSON(w, http.StatusOK, toSettingsDTO(*settings))
}

// --- Static pages ---

type staticPageDTO struct {
	Slug      string    `json:"slug"`
	Title     string    `json:"title"`
	Body      string    `json:"body"`
	UpdatedAt time.Time `json:"updated_at"`
}

func toStaticPageDTO(p domain.StaticPage) staticPageDTO {
	return staticPageDTO{
		Slug:      string(p.Slug),
		Title:     p.Title,
		Body:      p.Body,
		UpdatedAt: p.UpdatedAt,
	}
}

// GetPage handles GET /api/v1/pages/{slug}.
func (h *ContentHandler) GetPage(w http.ResponseWriter, r *http.Request) {
	businessID, err := resolvePublicBusinessID(r, h.businesses, h.defaultBusinessSlug)
	if err != nil {
		writeError(w, http.StatusNotFound, "business not found")
		return
	}

	slug := domain.StaticPageSlug(r.PathValue("slug"))

	page, err := h.content.GetPage(r.Context(), slug, businessID)
	if handleUsecaseError(w, err) {
		return
	}

	writeJSON(w, http.StatusOK, toStaticPageDTO(*page))
}

// ListPages handles GET /api/v1/admin/pages (protected), returning all 4
// static pages at once for the admin content-management list.
func (h *ContentHandler) ListPages(w http.ResponseWriter, r *http.Request) {
	claims, ok := ClaimsFromContext(r.Context())
	if !ok {
		writeError(w, http.StatusUnauthorized, "missing or malformed authorization header")
		return
	}

	pages, err := h.content.ListPages(r.Context(), claims.BusinessID)
	if err != nil {
		writeError(w, http.StatusInternalServerError, "failed to fetch pages")
		return
	}

	dtos := make([]staticPageDTO, 0, len(pages))
	for _, p := range pages {
		dtos = append(dtos, toStaticPageDTO(p))
	}

	writeJSON(w, http.StatusOK, dtos)
}

type staticPageRequest struct {
	Title string `json:"title"`
	Body  string `json:"body"`
}

// UpdatePage handles PUT /api/v1/admin/pages/{slug} (protected).
func (h *ContentHandler) UpdatePage(w http.ResponseWriter, r *http.Request) {
	claims, ok := ClaimsFromContext(r.Context())
	if !ok {
		writeError(w, http.StatusUnauthorized, "missing or malformed authorization header")
		return
	}

	slug := domain.StaticPageSlug(r.PathValue("slug"))

	var req staticPageRequest
	if err := json.NewDecoder(r.Body).Decode(&req); err != nil {
		writeError(w, http.StatusBadRequest, "invalid request body")
		return
	}

	page, err := h.content.UpdatePage(r.Context(), slug, usecase.StaticPageInput{
		Title: req.Title,
		Body:  req.Body,
	}, claims.BusinessID)
	if handleUsecaseError(w, err) {
		return
	}

	writeJSON(w, http.StatusOK, toStaticPageDTO(*page))
}

// --- Slider posters ---

type sliderPosterDTO struct {
	ID           string    `json:"id"`
	ImageURL     string    `json:"image_url"`
	LinkCategory string    `json:"link_category"`
	DisplayOrder int       `json:"display_order"`
	IsActive     bool      `json:"is_active"`
	CreatedAt    time.Time `json:"created_at"`
}

func toSliderPosterDTO(p domain.SliderPoster) sliderPosterDTO {
	return sliderPosterDTO{
		ID:           p.ID.String(),
		ImageURL:     p.ImageURL,
		LinkCategory: p.LinkCategory,
		DisplayOrder: p.DisplayOrder,
		IsActive:     p.IsActive,
		CreatedAt:    p.CreatedAt,
	}
}

// ListActiveSliders handles GET /api/v1/sliders.
func (h *ContentHandler) ListActiveSliders(w http.ResponseWriter, r *http.Request) {
	businessID, err := resolvePublicBusinessID(r, h.businesses, h.defaultBusinessSlug)
	if err != nil {
		writeError(w, http.StatusNotFound, "business not found")
		return
	}

	posters, err := h.content.ListActiveSliders(r.Context(), businessID)
	if err != nil {
		writeError(w, http.StatusInternalServerError, "failed to fetch sliders")
		return
	}

	dtos := make([]sliderPosterDTO, 0, len(posters))
	for _, p := range posters {
		dtos = append(dtos, toSliderPosterDTO(p))
	}

	writeJSON(w, http.StatusOK, dtos)
}

// ListAllSliders handles GET /api/v1/admin/sliders (protected), including
// inactive posters for the admin management list.
func (h *ContentHandler) ListAllSliders(w http.ResponseWriter, r *http.Request) {
	claims, ok := ClaimsFromContext(r.Context())
	if !ok {
		writeError(w, http.StatusUnauthorized, "missing or malformed authorization header")
		return
	}

	posters, err := h.content.ListAllSliders(r.Context(), claims.BusinessID)
	if err != nil {
		writeError(w, http.StatusInternalServerError, "failed to fetch sliders")
		return
	}

	dtos := make([]sliderPosterDTO, 0, len(posters))
	for _, p := range posters {
		dtos = append(dtos, toSliderPosterDTO(p))
	}

	writeJSON(w, http.StatusOK, dtos)
}

type sliderPosterRequest struct {
	ImageURL     string `json:"image_url"`
	LinkCategory string `json:"link_category"`
	DisplayOrder int    `json:"display_order"`
	IsActive     *bool  `json:"is_active"`
}

func (req sliderPosterRequest) toInput() usecase.SliderPosterInput {
	isActive := true
	if req.IsActive != nil {
		isActive = *req.IsActive
	}

	return usecase.SliderPosterInput{
		ImageURL:     req.ImageURL,
		LinkCategory: req.LinkCategory,
		DisplayOrder: req.DisplayOrder,
		IsActive:     isActive,
	}
}

// CreateSlider handles POST /api/v1/admin/sliders (protected).
func (h *ContentHandler) CreateSlider(w http.ResponseWriter, r *http.Request) {
	claims, ok := ClaimsFromContext(r.Context())
	if !ok {
		writeError(w, http.StatusUnauthorized, "missing or malformed authorization header")
		return
	}

	var req sliderPosterRequest
	if err := json.NewDecoder(r.Body).Decode(&req); err != nil {
		writeError(w, http.StatusBadRequest, "invalid request body")
		return
	}

	poster, err := h.content.CreateSlider(r.Context(), req.toInput(), claims.BusinessID)
	if handleUsecaseError(w, err) {
		return
	}

	writeJSON(w, http.StatusCreated, toSliderPosterDTO(*poster))
}

// UpdateSlider handles PUT /api/v1/admin/sliders/{id} (protected).
func (h *ContentHandler) UpdateSlider(w http.ResponseWriter, r *http.Request) {
	claims, ok := ClaimsFromContext(r.Context())
	if !ok {
		writeError(w, http.StatusUnauthorized, "missing or malformed authorization header")
		return
	}

	id, err := uuid.Parse(r.PathValue("id"))
	if err != nil {
		writeError(w, http.StatusBadRequest, "invalid slider id")
		return
	}

	var req sliderPosterRequest
	if err := json.NewDecoder(r.Body).Decode(&req); err != nil {
		writeError(w, http.StatusBadRequest, "invalid request body")
		return
	}

	poster, err := h.content.UpdateSlider(r.Context(), id, req.toInput(), claims.BusinessID)
	if handleUsecaseError(w, err) {
		return
	}

	writeJSON(w, http.StatusOK, toSliderPosterDTO(*poster))
}

// DeleteSlider handles DELETE /api/v1/admin/sliders/{id} (protected).
func (h *ContentHandler) DeleteSlider(w http.ResponseWriter, r *http.Request) {
	claims, ok := ClaimsFromContext(r.Context())
	if !ok {
		writeError(w, http.StatusUnauthorized, "missing or malformed authorization header")
		return
	}

	id, err := uuid.Parse(r.PathValue("id"))
	if err != nil {
		writeError(w, http.StatusBadRequest, "invalid slider id")
		return
	}

	poster, err := h.content.DeleteSlider(r.Context(), id, claims.BusinessID)
	if handleUsecaseError(w, err) {
		return
	}

	deleteFileIfUnused(r.Context(), h.media, claims.BusinessID, h.uploadsDir, poster.ImageURL)

	w.WriteHeader(http.StatusNoContent)
}

// UploadSliderImage handles POST /api/v1/admin/sliders/upload (protected). It
// accepts multipart/form-data with an "image" field and returns the saved
// image's public URL, unassociated with any slider row — the client then
// calls CreateSlider/UpdateSlider with that URL to persist it.
func (h *ContentHandler) UploadSliderImage(w http.ResponseWriter, r *http.Request) {
	if !parseUploadForm(w, r) {
		return
	}

	saved, err := saveUploadedImage(r, h.uploadsDir, h.publicBase, maxImageWidth)
	if err != nil {
		writeUploadError(w, err)
		return
	}

	writeJSON(w, http.StatusCreated, uploadResponse{ImageURL: saved.ImageURL})
}

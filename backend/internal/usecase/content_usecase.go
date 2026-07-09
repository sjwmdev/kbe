package usecase

import (
	"context"
	"fmt"

	"github.com/google/uuid"

	"backend/internal/domain"
)

// ContentUsecase composes the site settings, static pages, and slider poster
// repositories. These are simple CRUD resources with no cross-cutting logic
// between them, so they're grouped in one usecase rather than three.
type ContentUsecase struct {
	settings domain.SettingsRepository
	pages    domain.StaticPageRepository
	sliders  domain.SliderPosterRepository
}

func NewContentUsecase(settings domain.SettingsRepository, pages domain.StaticPageRepository, sliders domain.SliderPosterRepository) *ContentUsecase {
	return &ContentUsecase{settings: settings, pages: pages, sliders: sliders}
}

// --- Settings ---

type SettingsInput struct {
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
}

func (in SettingsInput) Validate() error {
	if in.WhatsAppNumber == "" {
		return fmt.Errorf("%w: whatsapp number is required", ErrValidation)
	}
	if in.ContactEmail == "" {
		return fmt.Errorf("%w: contact email is required", ErrValidation)
	}
	if in.CompanyName == "" {
		return fmt.Errorf("%w: company name is required", ErrValidation)
	}
	return nil
}

func (u *ContentUsecase) GetSettings(ctx context.Context, businessID uuid.UUID) (*domain.SiteSettings, error) {
	return u.settings.Get(ctx, businessID)
}

func (u *ContentUsecase) UpdateSettings(ctx context.Context, in SettingsInput, businessID uuid.UUID) (*domain.SiteSettings, error) {
	if err := in.Validate(); err != nil {
		return nil, err
	}

	settings := &domain.SiteSettings{
		BusinessID:           businessID,
		WhatsAppNumber:       in.WhatsAppNumber,
		ContactEmail:         in.ContactEmail,
		ContactAddress:       in.ContactAddress,
		InstagramURL:         in.InstagramURL,
		FacebookURL:          in.FacebookURL,
		CompanyName:          in.CompanyName,
		LogoLightURL:         in.LogoLightURL,
		LogoDarkURL:          in.LogoDarkURL,
		BrandAccentColor:     in.BrandAccentColor,
		BrandAccentColorDark: in.BrandAccentColorDark,
	}
	if err := u.settings.Update(ctx, settings); err != nil {
		return nil, err
	}

	return settings, nil
}

// --- Static pages ---

var validPageSlugs = map[domain.StaticPageSlug]bool{
	domain.PageAbout:   true,
	domain.PageContact: true,
	domain.PagePrivacy: true,
	domain.PageTerms:   true,
}

func (u *ContentUsecase) GetPage(ctx context.Context, slug domain.StaticPageSlug, businessID uuid.UUID) (*domain.StaticPage, error) {
	if !validPageSlugs[slug] {
		return nil, domain.ErrNotFound
	}

	page, err := u.pages.FindBySlug(ctx, slug, businessID)
	if err != nil {
		return nil, err
	}
	if page == nil {
		return nil, domain.ErrNotFound
	}

	return page, nil
}

func (u *ContentUsecase) ListPages(ctx context.Context, businessID uuid.UUID) ([]domain.StaticPage, error) {
	return u.pages.FindAll(ctx, businessID)
}

type StaticPageInput struct {
	Title string
	Body  string
}

func (in StaticPageInput) Validate() error {
	if in.Title == "" {
		return fmt.Errorf("%w: title is required", ErrValidation)
	}
	return nil
}

func (u *ContentUsecase) UpdatePage(ctx context.Context, slug domain.StaticPageSlug, in StaticPageInput, businessID uuid.UUID) (*domain.StaticPage, error) {
	if !validPageSlugs[slug] {
		return nil, domain.ErrNotFound
	}
	if err := in.Validate(); err != nil {
		return nil, err
	}

	page := &domain.StaticPage{
		BusinessID: businessID,
		Slug:       slug,
		Title:      in.Title,
		Body:       in.Body,
	}
	if err := u.pages.Update(ctx, page); err != nil {
		return nil, err
	}

	return page, nil
}

// --- Slider posters ---

type SliderPosterInput struct {
	ImageURL     string
	LinkCategory string
	DisplayOrder int
	IsActive     bool
}

func (in SliderPosterInput) Validate() error {
	if in.ImageURL == "" {
		return fmt.Errorf("%w: image_url is required", ErrValidation)
	}
	// LinkCategory is a free-form category slug (or empty, meaning "no
	// link") now that categories are dynamic per-business rather than a
	// fixed 3-value set — the admin UI only ever offers real category slugs
	// via its dropdown, so no further server-side check is needed here.
	return nil
}

func (u *ContentUsecase) ListActiveSliders(ctx context.Context, businessID uuid.UUID) ([]domain.SliderPoster, error) {
	return u.sliders.FindAllActive(ctx, businessID)
}

func (u *ContentUsecase) ListAllSliders(ctx context.Context, businessID uuid.UUID) ([]domain.SliderPoster, error) {
	return u.sliders.FindAll(ctx, businessID)
}

func (u *ContentUsecase) CreateSlider(ctx context.Context, in SliderPosterInput, businessID uuid.UUID) (*domain.SliderPoster, error) {
	if err := in.Validate(); err != nil {
		return nil, err
	}

	poster := &domain.SliderPoster{
		BusinessID:   businessID,
		ImageURL:     in.ImageURL,
		LinkCategory: in.LinkCategory,
		DisplayOrder: in.DisplayOrder,
		IsActive:     in.IsActive,
	}
	if err := u.sliders.Create(ctx, poster); err != nil {
		return nil, err
	}

	return poster, nil
}

func (u *ContentUsecase) UpdateSlider(ctx context.Context, id uuid.UUID, in SliderPosterInput, businessID uuid.UUID) (*domain.SliderPoster, error) {
	if err := in.Validate(); err != nil {
		return nil, err
	}

	existing, err := u.sliders.FindByID(ctx, id, businessID)
	if err != nil {
		return nil, err
	}
	if existing == nil {
		return nil, domain.ErrNotFound
	}

	existing.ImageURL = in.ImageURL
	existing.LinkCategory = in.LinkCategory
	existing.DisplayOrder = in.DisplayOrder
	existing.IsActive = in.IsActive

	if err := u.sliders.Update(ctx, existing); err != nil {
		return nil, err
	}

	return existing, nil
}

// DeleteSlider removes a slider poster and returns the deleted record so the
// caller can best-effort clean up the underlying uploaded file.
func (u *ContentUsecase) DeleteSlider(ctx context.Context, id uuid.UUID, businessID uuid.UUID) (*domain.SliderPoster, error) {
	existing, err := u.sliders.FindByID(ctx, id, businessID)
	if err != nil {
		return nil, err
	}
	if existing == nil {
		return nil, domain.ErrNotFound
	}

	if err := u.sliders.Delete(ctx, id, businessID); err != nil {
		return nil, err
	}

	return existing, nil
}

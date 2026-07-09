package repository

import (
	"context"
	"fmt"

	"github.com/google/uuid"
	"github.com/jackc/pgx/v5/pgxpool"

	"backend/internal/domain"
)

type settingsRepository struct {
	pool *pgxpool.Pool
}

func NewSettingsRepository(pool *pgxpool.Pool) domain.SettingsRepository {
	return &settingsRepository{pool: pool}
}

func (r *settingsRepository) Get(ctx context.Context, businessID uuid.UUID) (*domain.SiteSettings, error) {
	const query = `
		SELECT business_id, whatsapp_number, contact_email, contact_address, instagram_url, facebook_url,
			company_name, logo_light_url, logo_dark_url, brand_accent_color, brand_accent_color_dark, updated_at
		FROM site_settings
		WHERE business_id = $1`

	var s domain.SiteSettings
	err := r.pool.QueryRow(ctx, query, businessID).Scan(
		&s.BusinessID, &s.WhatsAppNumber, &s.ContactEmail, &s.ContactAddress, &s.InstagramURL, &s.FacebookURL,
		&s.CompanyName, &s.LogoLightURL, &s.LogoDarkURL, &s.BrandAccentColor, &s.BrandAccentColorDark, &s.UpdatedAt,
	)
	if err != nil {
		return nil, fmt.Errorf("repository: get site settings: %w", err)
	}

	return &s, nil
}

// Create inserts the initial settings row for a newly-provisioned business.
func (r *settingsRepository) Create(ctx context.Context, settings *domain.SiteSettings) error {
	const query = `
		INSERT INTO site_settings (
			business_id, whatsapp_number, contact_email, contact_address, instagram_url, facebook_url,
			company_name, logo_light_url, logo_dark_url, brand_accent_color, brand_accent_color_dark
		)
		VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11)
		RETURNING updated_at`

	err := r.pool.QueryRow(ctx, query,
		settings.BusinessID, settings.WhatsAppNumber, settings.ContactEmail, settings.ContactAddress,
		settings.InstagramURL, settings.FacebookURL, settings.CompanyName,
		settings.LogoLightURL, settings.LogoDarkURL, settings.BrandAccentColor, settings.BrandAccentColorDark,
	).Scan(&settings.UpdatedAt)
	if err != nil {
		return fmt.Errorf("repository: create site settings: %w", err)
	}

	return nil
}

func (r *settingsRepository) Update(ctx context.Context, settings *domain.SiteSettings) error {
	const query = `
		UPDATE site_settings
		SET whatsapp_number = $1, contact_email = $2, contact_address = $3,
		    instagram_url = $4, facebook_url = $5, company_name = $6,
		    logo_light_url = $7, logo_dark_url = $8, brand_accent_color = $9, brand_accent_color_dark = $10,
		    updated_at = now()
		WHERE business_id = $11
		RETURNING updated_at`

	err := r.pool.QueryRow(ctx, query,
		settings.WhatsAppNumber, settings.ContactEmail, settings.ContactAddress,
		settings.InstagramURL, settings.FacebookURL, settings.CompanyName,
		settings.LogoLightURL, settings.LogoDarkURL, settings.BrandAccentColor, settings.BrandAccentColorDark,
		settings.BusinessID,
	).Scan(&settings.UpdatedAt)
	if err != nil {
		return fmt.Errorf("repository: update site settings: %w", err)
	}

	return nil
}

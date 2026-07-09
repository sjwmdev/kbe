package domain

import (
	"time"

	"github.com/google/uuid"
)

// MediaFolder is a flat, admin-created grouping for media assets. Folders do
// not nest — an asset belongs to at most one folder, or none (root).
type MediaFolder struct {
	ID         uuid.UUID
	BusinessID uuid.UUID
	Name       string
	CreatedBy  *uuid.UUID
	CreatedAt  time.Time
}

// MediaAsset is an uploaded image that exists independently of any specific
// product or slider, so it can be reused across either. product_images and
// slider_posters rows may reference one via media_asset_id.
type MediaAsset struct {
	ID               uuid.UUID
	BusinessID       uuid.UUID
	FolderID         *uuid.UUID
	ImageURL         string
	OriginalFilename string
	SizeBytes        int64
	Width            int
	Height           int
	CreatedBy        *uuid.UUID
	CreatedAt        time.Time

	// Populated by joins, not persisted directly on the media_assets table.
	FolderName string
	InUseCount int
}

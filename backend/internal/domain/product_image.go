package domain

import "github.com/google/uuid"

type ProductImage struct {
	ID           uuid.UUID
	ProductID    uuid.UUID
	ImageURL     string
	IsPrimary    bool
	MediaAssetID *uuid.UUID
}

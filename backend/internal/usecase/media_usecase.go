package usecase

import (
	"context"
	"fmt"

	"github.com/google/uuid"

	"backend/internal/domain"
)

// MediaUsecase composes the standalone Media Library — folders and the assets
// within them. Like RoleUsecase, this is a thin wrapper: the meaningful
// business rule (never deleting an in-use asset) is already enforced at the
// repository level, since it requires a query against other tables anyway.
type MediaUsecase struct {
	media domain.MediaRepository
}

func NewMediaUsecase(media domain.MediaRepository) *MediaUsecase {
	return &MediaUsecase{media: media}
}

func (u *MediaUsecase) ListFolders(ctx context.Context, businessID uuid.UUID) ([]domain.MediaFolder, error) {
	return u.media.ListFolders(ctx, businessID)
}

func (u *MediaUsecase) CreateFolder(ctx context.Context, name string, createdBy, businessID uuid.UUID) (*domain.MediaFolder, error) {
	if name == "" {
		return nil, fmt.Errorf("%w: name is required", ErrValidation)
	}

	folder := &domain.MediaFolder{BusinessID: businessID, Name: name, CreatedBy: &createdBy}
	if err := u.media.CreateFolder(ctx, folder); err != nil {
		return nil, err
	}

	return folder, nil
}

func (u *MediaUsecase) DeleteFolder(ctx context.Context, id, businessID uuid.UUID) error {
	return u.media.DeleteFolder(ctx, id, businessID)
}

func (u *MediaUsecase) ListAssets(ctx context.Context, businessID uuid.UUID, folderID *uuid.UUID, page, pageSize int) ([]domain.MediaAsset, int, error) {
	return u.media.ListAssets(ctx, businessID, folderID, page, pageSize)
}

func (u *MediaUsecase) CreateAsset(ctx context.Context, asset *domain.MediaAsset) error {
	return u.media.CreateAsset(ctx, asset)
}

// DeleteAssets returns how many were actually deleted vs skipped because
// they're still attached to a product or slider.
func (u *MediaUsecase) DeleteAssets(ctx context.Context, businessID uuid.UUID, ids []uuid.UUID) (deletedURLs []string, skippedIDs []uuid.UUID, err error) {
	return u.media.DeleteAssets(ctx, businessID, ids)
}

func (u *MediaUsecase) MoveAssets(ctx context.Context, businessID uuid.UUID, ids []uuid.UUID, folderID *uuid.UUID) error {
	return u.media.MoveAssets(ctx, businessID, ids, folderID)
}

// IsImageURLInUse reports whether imageURL is still referenced by any
// product image, slider poster, or media asset within businessID — callers
// use this as a guard before deleting a file from disk, since a single
// physical file can be shared across those tables (e.g. a Media Library
// asset backfilled from a pre-existing product image).
func (u *MediaUsecase) IsImageURLInUse(ctx context.Context, businessID uuid.UUID, imageURL string) (bool, error) {
	return u.media.IsImageURLInUse(ctx, businessID, imageURL)
}

package repository

import (
	"context"
	"fmt"

	"github.com/google/uuid"
	"github.com/jackc/pgx/v5/pgxpool"

	"backend/internal/domain"
)

type mediaRepository struct {
	pool *pgxpool.Pool
}

func NewMediaRepository(pool *pgxpool.Pool) domain.MediaRepository {
	return &mediaRepository{pool: pool}
}

func (r *mediaRepository) ListFolders(ctx context.Context, businessID uuid.UUID) ([]domain.MediaFolder, error) {
	const query = `SELECT id, business_id, name, created_by, created_at FROM media_folders WHERE business_id = $1 ORDER BY name`

	rows, err := r.pool.Query(ctx, query, businessID)
	if err != nil {
		return nil, fmt.Errorf("repository: list media folders: %w", err)
	}
	defer rows.Close()

	var folders []domain.MediaFolder
	for rows.Next() {
		var f domain.MediaFolder
		if err := rows.Scan(&f.ID, &f.BusinessID, &f.Name, &f.CreatedBy, &f.CreatedAt); err != nil {
			return nil, fmt.Errorf("repository: scan media folder row: %w", err)
		}
		folders = append(folders, f)
	}
	if err := rows.Err(); err != nil {
		return nil, fmt.Errorf("repository: iterate media folder rows: %w", err)
	}

	return folders, nil
}

func (r *mediaRepository) CreateFolder(ctx context.Context, folder *domain.MediaFolder) error {
	const query = `
		INSERT INTO media_folders (business_id, name, created_by)
		VALUES ($1, $2, $3)
		RETURNING id, created_at`

	err := r.pool.QueryRow(ctx, query, folder.BusinessID, folder.Name, folder.CreatedBy).
		Scan(&folder.ID, &folder.CreatedAt)
	if err != nil {
		return fmt.Errorf("repository: create media folder: %w", err)
	}

	return nil
}

// DeleteFolder removes the folder row. Its assets are reassigned to root by
// the media_assets.folder_id ON DELETE SET NULL constraint, never deleted.
func (r *mediaRepository) DeleteFolder(ctx context.Context, id, businessID uuid.UUID) error {
	const query = `DELETE FROM media_folders WHERE id = $1 AND business_id = $2`

	tag, err := r.pool.Exec(ctx, query, id, businessID)
	if err != nil {
		return fmt.Errorf("repository: delete media folder: %w", err)
	}
	if tag.RowsAffected() == 0 {
		return fmt.Errorf("repository: delete media folder: %w", domain.ErrNotFound)
	}

	return nil
}

// ListAssets returns one page of assets in folderID (nil = root only), plus
// the total matching count via a COUNT(*) OVER() window column. `IS NOT
// DISTINCT FROM` is used instead of `=` so a nil folderID correctly matches
// NULL folder_id rows (a plain `=` never matches NULL).
func (r *mediaRepository) ListAssets(ctx context.Context, businessID uuid.UUID, folderID *uuid.UUID, page, pageSize int) ([]domain.MediaAsset, int, error) {
	if page < 1 {
		page = 1
	}
	if pageSize < 1 {
		pageSize = 20
	}
	offset := (page - 1) * pageSize

	const query = `
		SELECT
			ma.id, ma.folder_id, ma.image_url, ma.original_filename, ma.size_bytes,
			ma.width, ma.height, ma.created_by, ma.created_at,
			COALESCE(mf.name, ''),
			(SELECT COUNT(*) FROM product_images pi WHERE pi.media_asset_id = ma.id) +
			(SELECT COUNT(*) FROM slider_posters sp WHERE sp.media_asset_id = ma.id),
			COUNT(*) OVER()
		FROM media_assets ma
		LEFT JOIN media_folders mf ON mf.id = ma.folder_id
		WHERE ma.business_id = $1 AND ma.folder_id IS NOT DISTINCT FROM $2
		ORDER BY ma.created_at DESC
		LIMIT $3 OFFSET $4`

	rows, err := r.pool.Query(ctx, query, businessID, folderID, pageSize, offset)
	if err != nil {
		return nil, 0, fmt.Errorf("repository: list media assets: %w", err)
	}
	defer rows.Close()

	var assets []domain.MediaAsset
	total := 0
	for rows.Next() {
		var a domain.MediaAsset
		if err := rows.Scan(
			&a.ID, &a.FolderID, &a.ImageURL, &a.OriginalFilename, &a.SizeBytes,
			&a.Width, &a.Height, &a.CreatedBy, &a.CreatedAt,
			&a.FolderName, &a.InUseCount,
			&total,
		); err != nil {
			return nil, 0, fmt.Errorf("repository: scan media asset row: %w", err)
		}
		a.BusinessID = businessID
		assets = append(assets, a)
	}
	if err := rows.Err(); err != nil {
		return nil, 0, fmt.Errorf("repository: iterate media asset rows: %w", err)
	}

	return assets, total, nil
}

func (r *mediaRepository) CreateAsset(ctx context.Context, asset *domain.MediaAsset) error {
	const query = `
		INSERT INTO media_assets (business_id, folder_id, image_url, original_filename, size_bytes, width, height, created_by)
		VALUES ($1, $2, $3, $4, $5, $6, $7, $8)
		RETURNING id, created_at`

	err := r.pool.QueryRow(ctx, query,
		asset.BusinessID, asset.FolderID, asset.ImageURL, asset.OriginalFilename, asset.SizeBytes,
		asset.Width, asset.Height, asset.CreatedBy,
	).Scan(&asset.ID, &asset.CreatedAt)
	if err != nil {
		return fmt.Errorf("repository: create media asset: %w", err)
	}

	return nil
}

// DeleteAssets deletes every id (scoped to businessID) not currently
// referenced by a product or slider. Assets still in use are reported back
// as skipped instead of being force-deleted, so a library cleanup can never
// break a live product/slider.
func (r *mediaRepository) DeleteAssets(ctx context.Context, businessID uuid.UUID, ids []uuid.UUID) ([]string, []uuid.UUID, error) {
	if len(ids) == 0 {
		return nil, nil, nil
	}

	const inUseQuery = `
		SELECT DISTINCT media_asset_id FROM product_images
		WHERE media_asset_id = ANY($1) AND media_asset_id IS NOT NULL
		UNION
		SELECT DISTINCT media_asset_id FROM slider_posters
		WHERE media_asset_id = ANY($1) AND media_asset_id IS NOT NULL`

	rows, err := r.pool.Query(ctx, inUseQuery, ids)
	if err != nil {
		return nil, nil, fmt.Errorf("repository: find in-use media assets: %w", err)
	}

	inUse := make(map[uuid.UUID]bool)
	for rows.Next() {
		var id uuid.UUID
		if err := rows.Scan(&id); err != nil {
			rows.Close()
			return nil, nil, fmt.Errorf("repository: scan in-use media asset id: %w", err)
		}
		inUse[id] = true
	}
	if err := rows.Err(); err != nil {
		rows.Close()
		return nil, nil, fmt.Errorf("repository: iterate in-use media asset ids: %w", err)
	}
	rows.Close()

	var deletable, skipped []uuid.UUID
	for _, id := range ids {
		if inUse[id] {
			skipped = append(skipped, id)
		} else {
			deletable = append(deletable, id)
		}
	}

	if len(deletable) == 0 {
		return nil, skipped, nil
	}

	const selectURLsQuery = `SELECT image_url FROM media_assets WHERE id = ANY($1) AND business_id = $2`
	urlRows, err := r.pool.Query(ctx, selectURLsQuery, deletable, businessID)
	if err != nil {
		return nil, nil, fmt.Errorf("repository: find deletable media asset urls: %w", err)
	}

	var urls []string
	for urlRows.Next() {
		var url string
		if err := urlRows.Scan(&url); err != nil {
			urlRows.Close()
			return nil, nil, fmt.Errorf("repository: scan media asset url: %w", err)
		}
		urls = append(urls, url)
	}
	if err := urlRows.Err(); err != nil {
		urlRows.Close()
		return nil, nil, fmt.Errorf("repository: iterate media asset urls: %w", err)
	}
	urlRows.Close()

	const deleteQuery = `DELETE FROM media_assets WHERE id = ANY($1) AND business_id = $2`
	if _, err := r.pool.Exec(ctx, deleteQuery, deletable, businessID); err != nil {
		return nil, nil, fmt.Errorf("repository: delete media assets: %w", err)
	}

	return urls, skipped, nil
}

func (r *mediaRepository) MoveAssets(ctx context.Context, businessID uuid.UUID, ids []uuid.UUID, folderID *uuid.UUID) error {
	if len(ids) == 0 {
		return nil
	}

	const query = `UPDATE media_assets SET folder_id = $1 WHERE id = ANY($2) AND business_id = $3`

	if _, err := r.pool.Exec(ctx, query, folderID, ids, businessID); err != nil {
		return fmt.Errorf("repository: move media assets: %w", err)
	}

	return nil
}

// IsImageURLInUse checks by exact URL match rather than the media_asset_id
// FK, so it still catches a shared file even if the FK linkage is ever
// missing or stale — the URL is the actual truth of what's on disk. Scoped
// to businessID so one tenant's cleanup can never be blocked by another
// tenant's file coincidentally sharing a URL.
func (r *mediaRepository) IsImageURLInUse(ctx context.Context, businessID uuid.UUID, imageURL string) (bool, error) {
	const query = `
		SELECT EXISTS (
			SELECT 1 FROM product_images pi JOIN products p ON p.id = pi.product_id
				WHERE pi.image_url = $1 AND p.business_id = $2
			UNION ALL
			SELECT 1 FROM slider_posters WHERE image_url = $1 AND business_id = $2
			UNION ALL
			SELECT 1 FROM media_assets WHERE image_url = $1 AND business_id = $2
		)`

	var inUse bool
	if err := r.pool.QueryRow(ctx, query, imageURL, businessID).Scan(&inUse); err != nil {
		return false, fmt.Errorf("repository: check image url in use: %w", err)
	}
	return inUse, nil
}

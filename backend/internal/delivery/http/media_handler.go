package httpdelivery

import (
	"encoding/json"
	"net/http"
	"time"

	"github.com/google/uuid"

	"backend/internal/domain"
	"backend/internal/usecase"
)

type MediaHandler struct {
	media      *usecase.MediaUsecase
	uploadsDir string
	publicBase string
}

func NewMediaHandler(media *usecase.MediaUsecase, uploadsDir, publicBase string) *MediaHandler {
	return &MediaHandler{media: media, uploadsDir: uploadsDir, publicBase: publicBase}
}

// --- Folders ---

type mediaFolderDTO struct {
	ID        string    `json:"id"`
	Name      string    `json:"name"`
	CreatedAt time.Time `json:"created_at"`
}

func toMediaFolderDTO(f domain.MediaFolder) mediaFolderDTO {
	return mediaFolderDTO{ID: f.ID.String(), Name: f.Name, CreatedAt: f.CreatedAt}
}

// ListFolders handles GET /api/v1/admin/media/folders (protected).
func (h *MediaHandler) ListFolders(w http.ResponseWriter, r *http.Request) {
	claims, ok := ClaimsFromContext(r.Context())
	if !ok {
		writeError(w, http.StatusUnauthorized, "missing or malformed authorization header")
		return
	}

	folders, err := h.media.ListFolders(r.Context(), claims.BusinessID)
	if err != nil {
		writeError(w, http.StatusInternalServerError, "failed to fetch media folders")
		return
	}

	dtos := make([]mediaFolderDTO, 0, len(folders))
	for _, f := range folders {
		dtos = append(dtos, toMediaFolderDTO(f))
	}

	writeJSON(w, http.StatusOK, dtos)
}

type createFolderRequest struct {
	Name string `json:"name"`
}

// CreateFolder handles POST /api/v1/admin/media/folders (protected).
func (h *MediaHandler) CreateFolder(w http.ResponseWriter, r *http.Request) {
	claims, ok := ClaimsFromContext(r.Context())
	if !ok {
		writeError(w, http.StatusUnauthorized, "missing or malformed authorization header")
		return
	}

	var req createFolderRequest
	if err := json.NewDecoder(r.Body).Decode(&req); err != nil {
		writeError(w, http.StatusBadRequest, "invalid request body")
		return
	}

	folder, err := h.media.CreateFolder(r.Context(), req.Name, claims.UserID, claims.BusinessID)
	if handleUsecaseError(w, err) {
		return
	}

	writeJSON(w, http.StatusCreated, toMediaFolderDTO(*folder))
}

// DeleteFolder handles DELETE /api/v1/admin/media/folders/{id} (protected).
// Assets inside the folder are reassigned to root, never deleted.
func (h *MediaHandler) DeleteFolder(w http.ResponseWriter, r *http.Request) {
	claims, ok := ClaimsFromContext(r.Context())
	if !ok {
		writeError(w, http.StatusUnauthorized, "missing or malformed authorization header")
		return
	}

	id, err := uuid.Parse(r.PathValue("id"))
	if err != nil {
		writeError(w, http.StatusBadRequest, "invalid folder id")
		return
	}

	if err := h.media.DeleteFolder(r.Context(), id, claims.BusinessID); handleUsecaseError(w, err) {
		return
	}

	w.WriteHeader(http.StatusNoContent)
}

// --- Assets ---

type mediaAssetDTO struct {
	ID               string    `json:"id"`
	FolderID         *string   `json:"folder_id"`
	FolderName       string    `json:"folder_name,omitempty"`
	ImageURL         string    `json:"image_url"`
	OriginalFilename string    `json:"original_filename"`
	SizeBytes        int64     `json:"size_bytes"`
	Width            int       `json:"width"`
	Height           int       `json:"height"`
	InUseCount       int       `json:"in_use_count"`
	CreatedAt        time.Time `json:"created_at"`
}

func toMediaAssetDTO(a domain.MediaAsset) mediaAssetDTO {
	var folderID *string
	if a.FolderID != nil {
		s := a.FolderID.String()
		folderID = &s
	}

	return mediaAssetDTO{
		ID:               a.ID.String(),
		FolderID:         folderID,
		FolderName:       a.FolderName,
		ImageURL:         a.ImageURL,
		OriginalFilename: a.OriginalFilename,
		SizeBytes:        a.SizeBytes,
		Width:            a.Width,
		Height:           a.Height,
		InUseCount:       a.InUseCount,
		CreatedAt:        a.CreatedAt,
	}
}

type paginatedMediaAssetsResponse struct {
	Assets   []mediaAssetDTO `json:"assets"`
	Total    int             `json:"total"`
	Page     int             `json:"page"`
	PageSize int             `json:"page_size"`
}

// ListAssets handles GET /api/v1/admin/media (protected). folder_id omitted
// or empty means root only — folders don't nest, so there's no "all assets
// everywhere" view, matching the breadcrumb-navigated UI.
func (h *MediaHandler) ListAssets(w http.ResponseWriter, r *http.Request) {
	claims, ok := ClaimsFromContext(r.Context())
	if !ok {
		writeError(w, http.StatusUnauthorized, "missing or malformed authorization header")
		return
	}

	var folderID *uuid.UUID
	if raw := r.URL.Query().Get("folder_id"); raw != "" {
		id, err := uuid.Parse(raw)
		if err != nil {
			writeError(w, http.StatusBadRequest, "invalid folder_id")
			return
		}
		folderID = &id
	}

	page, pageSize := parsePagination(r)
	assets, total, err := h.media.ListAssets(r.Context(), claims.BusinessID, folderID, page, pageSize)
	if err != nil {
		writeError(w, http.StatusInternalServerError, "failed to fetch media assets")
		return
	}

	dtos := make([]mediaAssetDTO, 0, len(assets))
	for _, a := range assets {
		dtos = append(dtos, toMediaAssetDTO(a))
	}

	writeJSON(w, http.StatusOK, paginatedMediaAssetsResponse{
		Assets:   dtos,
		Total:    total,
		Page:     page,
		PageSize: pageSize,
	})
}

// Upload handles POST /api/v1/admin/media/upload (protected). It accepts
// multipart/form-data with an "image" field and an optional "folder_id"
// field, and creates a standalone Media Library asset — unlike
// UploadHandler.Upload, this is never tied to a product at save time.
func (h *MediaHandler) Upload(w http.ResponseWriter, r *http.Request) {
	claims, ok := ClaimsFromContext(r.Context())
	if !ok {
		writeError(w, http.StatusUnauthorized, "missing or malformed authorization header")
		return
	}

	if !parseUploadForm(w, r) {
		return
	}

	var folderID *uuid.UUID
	if raw := r.FormValue("folder_id"); raw != "" {
		id, err := uuid.Parse(raw)
		if err != nil {
			writeError(w, http.StatusBadRequest, "invalid folder_id")
			return
		}
		folderID = &id
	}

	// maxLibraryImageWidth (not maxImageWidth): a library upload is a
	// reusable master asset that may later be cropped to several different
	// aspect ratios for different products/sliders, so it keeps more source
	// resolution than a final, single-purpose render needs.
	saved, err := saveUploadedImage(r, h.uploadsDir, h.publicBase, maxLibraryImageWidth)
	if err != nil {
		writeUploadError(w, err)
		return
	}

	asset := &domain.MediaAsset{
		BusinessID:       claims.BusinessID,
		FolderID:         folderID,
		ImageURL:         saved.ImageURL,
		OriginalFilename: saved.OriginalFilename,
		SizeBytes:        saved.SizeBytes,
		Width:            saved.Width,
		Height:           saved.Height,
		CreatedBy:        &claims.UserID,
	}
	if err := h.media.CreateAsset(r.Context(), asset); err != nil {
		writeError(w, http.StatusInternalServerError, "failed to save media asset reference")
		return
	}

	writeJSON(w, http.StatusCreated, toMediaAssetDTO(*asset))
}

func parseUUIDs(raw []string) ([]uuid.UUID, error) {
	ids := make([]uuid.UUID, 0, len(raw))
	for _, s := range raw {
		id, err := uuid.Parse(s)
		if err != nil {
			return nil, err
		}
		ids = append(ids, id)
	}
	return ids, nil
}

type bulkDeleteRequest struct {
	IDs []string `json:"ids"`
}

type bulkDeleteResponse struct {
	DeletedCount int `json:"deleted_count"`
	SkippedCount int `json:"skipped_count"`
}

// BulkDelete handles POST /api/v1/admin/media/bulk-delete (protected). Assets
// still referenced by a product or slider are skipped rather than deleted, so
// a library cleanup can never break a live product/slider page.
func (h *MediaHandler) BulkDelete(w http.ResponseWriter, r *http.Request) {
	claims, ok := ClaimsFromContext(r.Context())
	if !ok {
		writeError(w, http.StatusUnauthorized, "missing or malformed authorization header")
		return
	}

	var req bulkDeleteRequest
	if err := json.NewDecoder(r.Body).Decode(&req); err != nil {
		writeError(w, http.StatusBadRequest, "invalid request body")
		return
	}

	ids, err := parseUUIDs(req.IDs)
	if err != nil {
		writeError(w, http.StatusBadRequest, "invalid asset id")
		return
	}

	deletedURLs, skipped, err := h.media.DeleteAssets(r.Context(), claims.BusinessID, ids)
	if err != nil {
		writeError(w, http.StatusInternalServerError, "failed to delete media assets")
		return
	}

	for _, url := range deletedURLs {
		deleteFileIfUnused(r.Context(), h.media, claims.BusinessID, h.uploadsDir, url)
	}

	writeJSON(w, http.StatusOK, bulkDeleteResponse{
		DeletedCount: len(deletedURLs),
		SkippedCount: len(skipped),
	})
}

type moveAssetsRequest struct {
	IDs      []string `json:"ids"`
	FolderID *string  `json:"folder_id"`
}

// MoveAssets handles PUT /api/v1/admin/media/move (protected).
func (h *MediaHandler) MoveAssets(w http.ResponseWriter, r *http.Request) {
	claims, ok := ClaimsFromContext(r.Context())
	if !ok {
		writeError(w, http.StatusUnauthorized, "missing or malformed authorization header")
		return
	}

	var req moveAssetsRequest
	if err := json.NewDecoder(r.Body).Decode(&req); err != nil {
		writeError(w, http.StatusBadRequest, "invalid request body")
		return
	}

	ids, err := parseUUIDs(req.IDs)
	if err != nil {
		writeError(w, http.StatusBadRequest, "invalid asset id")
		return
	}

	var folderID *uuid.UUID
	if req.FolderID != nil && *req.FolderID != "" {
		id, err := uuid.Parse(*req.FolderID)
		if err != nil {
			writeError(w, http.StatusBadRequest, "invalid folder_id")
			return
		}
		folderID = &id
	}

	if err := h.media.MoveAssets(r.Context(), claims.BusinessID, ids, folderID); err != nil {
		writeError(w, http.StatusInternalServerError, "failed to move media assets")
		return
	}

	w.WriteHeader(http.StatusNoContent)
}

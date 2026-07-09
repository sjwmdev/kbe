package httpdelivery

import (
	"context"
	"errors"
	"fmt"
	"image"
	_ "image/gif"
	"image/jpeg"
	_ "image/png"
	"net/http"
	"os"
	"path"
	"path/filepath"

	"github.com/disintegration/imaging"
	"github.com/google/uuid"
	_ "golang.org/x/image/webp"

	"backend/internal/domain"
	"backend/internal/usecase"
)

const (
	maxUploadSize = 10 << 20 // 10 MB

	// maxImageWidth caps a final, single-purpose render (a product or slider
	// image, already cropped to its exact on-page aspect ratio) — nothing on
	// the site ever displays wider than this, so keeping more resolution
	// than that only wastes storage/bandwidth.
	maxImageWidth = 1600

	// maxLibraryImageWidth caps a Media Library "master" upload instead —
	// deliberately higher, since a single library asset may later be cropped
	// to several different aspect ratios for different products/sliders, and
	// each of those crops deserves as much source resolution as the master
	// can still offer.
	maxLibraryImageWidth = 2400

	// jpegQuality is tuned for the size/clarity tradeoff on photographic
	// content: perceptibly smaller than a "safe" 90+ setting while staying
	// visually excellent for product photography. (True lossy WebP would
	// compress further still, but Go has no CGO-free encoder for it — see
	// saveUploadedImage.)
	jpegQuality = 80
)

// Sentinel errors from saveUploadedImage, distinguished by writeUploadError
// so each upload endpoint can tell the admin exactly what went wrong instead
// of a single generic message.
var (
	errMissingImageFile  = errors.New("missing image file")
	errUnsupportedFormat = errors.New("unsupported or corrupt image file")
)

// parseUploadForm wraps r.Body in a size-limited reader and parses the
// multipart form, writing a specific error response if it fails —
// distinguishing "the file is too large" from a genuinely malformed request,
// since those need different user-facing guidance. Returns false if the
// caller should stop handling the request.
//
// The Content-Length check happens first and rejects oversized uploads
// before reading a single byte of the body. This matters because once
// MaxBytesReader trips mid-read on a large multipart body, the browser is
// usually still streaming the rest of the file when the server responds —
// closing the connection at that point frequently causes the OS to send a
// TCP RST instead of a clean response, which the browser reports as a
// network error with no JSON body at all (the exact "generic error" bug
// reported for the Media Library upload). Checking Content-Length upfront
// means the server responds before the client has sent the oversized body,
// which avoids that race for the overwhelming majority of real uploads
// (browsers always know the file size upfront).
func parseUploadForm(w http.ResponseWriter, r *http.Request) bool {
	if r.ContentLength > maxUploadSize {
		writeErrorCode(w, http.StatusRequestEntityTooLarge,
			"Picha ni kubwa mno. Kiwango cha juu kinachoruhusiwa ni MB 10.", "file_too_large")
		return false
	}

	r.Body = http.MaxBytesReader(w, r.Body, maxUploadSize)
	if err := r.ParseMultipartForm(maxUploadSize); err != nil {
		var tooLarge *http.MaxBytesError
		if errors.As(err, &tooLarge) {
			writeErrorCode(w, http.StatusRequestEntityTooLarge,
				"Picha ni kubwa mno. Kiwango cha juu kinachoruhusiwa ni MB 10.", "file_too_large")
		} else {
			writeErrorCode(w, http.StatusBadRequest,
				"Fomu ya kupakia haikusomeka. Jaribu tena.", "malformed_upload")
		}
		return false
	}
	return true
}

// writeUploadError maps a saveUploadedImage error to a specific, actionable
// response instead of a single generic "upload failed" message.
func writeUploadError(w http.ResponseWriter, err error) {
	switch {
	case errors.Is(err, errMissingImageFile):
		writeErrorCode(w, http.StatusBadRequest,
			"Hakuna picha iliyochaguliwa.", "missing_file")
	case errors.Is(err, errUnsupportedFormat):
		writeErrorCode(w, http.StatusBadRequest,
			"Aina ya faili hii haitambuliki. Tumia JPG, PNG, GIF au WEBP.", "invalid_image_format")
	default:
		writeErrorCode(w, http.StatusInternalServerError,
			"Imeshindwa kuhifadhi picha. Jaribu tena.", "upload_failed")
	}
}

// deleteFileIfUnused best-effort removes imageURL's underlying file from
// uploadsDir — unless it's still referenced elsewhere (a product image, a
// slider poster, and a Media Library asset can all share one physical file,
// e.g. a library asset backfilled from a pre-existing product image), in
// which case the file is left in place. Shared by every delete flow that
// touches disk (product image, slider poster, Media Library bulk-delete) so
// this guard is applied identically everywhere instead of being
// re-implemented per handler.
func deleteFileIfUnused(ctx context.Context, media *usecase.MediaUsecase, businessID uuid.UUID, uploadsDir, imageURL string) {
	inUse, err := media.IsImageURLInUse(ctx, businessID, imageURL)
	if err != nil || inUse {
		return
	}
	if filename := path.Base(imageURL); filename != "." && filename != "/" {
		_ = os.Remove(filepath.Join(uploadsDir, filename))
	}
}

type UploadHandler struct {
	products   *usecase.ProductUsecase
	media      *usecase.MediaUsecase
	uploadsDir string
	publicBase string
}

func NewUploadHandler(products *usecase.ProductUsecase, media *usecase.MediaUsecase, uploadsDir, publicBase string) *UploadHandler {
	return &UploadHandler{products: products, media: media, uploadsDir: uploadsDir, publicBase: publicBase}
}

type uploadResponse struct {
	ImageURL string `json:"image_url"`
}

// Upload handles POST /api/v1/admin/upload (protected). It accepts
// multipart/form-data with an "image" file field plus an "is_primary" field,
// downscales oversized images automatically, and records the resulting
// image against the product identified by the URL path — nested under its
// parent resource for the same reason /admin/sliders/upload and
// /admin/media/upload are, rather than a flat /admin/upload. An optional
// "media_asset_id" field tags the new image with the Media Library asset it
// was cropped from — set when this upload is the cropped derivative of an
// "Agiza kutoka Media" pick, left empty for a fresh upload from disk.
func (h *UploadHandler) Upload(w http.ResponseWriter, r *http.Request) {
	claims, ok := ClaimsFromContext(r.Context())
	if !ok {
		writeError(w, http.StatusUnauthorized, "missing or malformed authorization header")
		return
	}

	productID, err := uuid.Parse(r.PathValue("id"))
	if err != nil {
		writeError(w, http.StatusBadRequest, "invalid product id")
		return
	}

	product, err := h.products.GetByID(r.Context(), productID)
	if err != nil || product.BusinessID != claims.BusinessID {
		writeError(w, http.StatusNotFound, "product not found")
		return
	}

	if !parseUploadForm(w, r) {
		return
	}

	isPrimary := r.FormValue("is_primary") == "true"

	var mediaAssetID *uuid.UUID
	if raw := r.FormValue("media_asset_id"); raw != "" {
		id, err := uuid.Parse(raw)
		if err != nil {
			writeError(w, http.StatusBadRequest, "invalid media_asset_id")
			return
		}
		mediaAssetID = &id
	}

	saved, err := saveUploadedImage(r, h.uploadsDir, h.publicBase, maxImageWidth)
	if err != nil {
		writeUploadError(w, err)
		return
	}

	if _, err := h.products.AddImage(r.Context(), productID, saved.ImageURL, isPrimary, mediaAssetID); err != nil {
		writeError(w, http.StatusInternalServerError, "failed to save image reference")
		return
	}

	writeJSON(w, http.StatusCreated, uploadResponse{ImageURL: saved.ImageURL})
}

// savedImage describes a file just written to disk by saveUploadedImage —
// everything a Media Library asset record needs, captured once at save time
// so callers never have to re-read the file to learn its dimensions/size.
type savedImage struct {
	ImageURL         string
	OriginalFilename string
	SizeBytes        int64
	Width            int
	Height           int
}

// saveUploadedImage reads the "image" multipart field from r (the caller must
// have already called r.ParseMultipartForm), downscales images wider than
// maxWidth, and re-encodes the result as a tuned-quality .jpg in uploadsDir.
// Shared by the product-image upload flow above, the slider-poster upload
// flow in content_handler.go, and the Media Library upload flow in
// media_handler.go — none of which are tied to each other, but all of which
// want the same "compress sensibly on the way in" behavior. Go's standard
// library has no WebP encoder (golang.org/x/image/webp is decode-only, and a
// real lossy encoder needs libwebp via CGO, which this deployment doesn't
// have) — jpegQuality is the practical substitute for that "auto-optimize on
// upload" requirement.
func saveUploadedImage(r *http.Request, uploadsDir, publicBase string, maxWidth int) (*savedImage, error) {
	file, header, err := r.FormFile("image")
	if err != nil {
		return nil, errMissingImageFile
	}
	defer file.Close()

	img, _, err := image.Decode(file)
	if err != nil {
		return nil, errUnsupportedFormat
	}

	if img.Bounds().Dx() > maxWidth {
		img = imaging.Resize(img, maxWidth, 0, imaging.Lanczos)
	}

	if err := os.MkdirAll(uploadsDir, 0o755); err != nil {
		return nil, fmt.Errorf("failed to prepare uploads directory")
	}

	filename := uuid.New().String() + ".jpg"
	fullPath := filepath.Join(uploadsDir, filename)
	dst, err := os.Create(fullPath)
	if err != nil {
		return nil, fmt.Errorf("failed to save image")
	}
	defer dst.Close()

	if err := jpeg.Encode(dst, img, &jpeg.Options{Quality: jpegQuality}); err != nil {
		return nil, fmt.Errorf("failed to encode image")
	}

	var sizeBytes int64
	if info, err := os.Stat(fullPath); err == nil {
		sizeBytes = info.Size()
	}

	return &savedImage{
		ImageURL:         fmt.Sprintf("%s/%s", publicBase, filename),
		OriginalFilename: header.Filename,
		SizeBytes:        sizeBytes,
		Width:            img.Bounds().Dx(),
		Height:           img.Bounds().Dy(),
	}, nil
}

// DeleteImage handles DELETE /api/v1/admin/images/{id} (protected). It
// removes the image record (auto-promoting a new primary if needed) and
// best-effort deletes the underlying file from disk — unless that same file
// is still referenced elsewhere (e.g. a Media Library asset backfilled from
// this exact product image), in which case the row is removed but the file
// is left in place.
func (h *UploadHandler) DeleteImage(w http.ResponseWriter, r *http.Request) {
	claims, ok := ClaimsFromContext(r.Context())
	if !ok {
		writeError(w, http.StatusUnauthorized, "missing or malformed authorization header")
		return
	}

	id, err := uuid.Parse(r.PathValue("id"))
	if err != nil {
		writeError(w, http.StatusBadRequest, "invalid image id")
		return
	}

	image, err := h.products.DeleteImage(r.Context(), id, claims.BusinessID)
	if err != nil {
		if errors.Is(err, domain.ErrNotFound) {
			writeError(w, http.StatusNotFound, "image not found")
			return
		}
		writeError(w, http.StatusInternalServerError, "failed to delete image")
		return
	}

	deleteFileIfUnused(r.Context(), h.media, claims.BusinessID, h.uploadsDir, image.ImageURL)

	w.WriteHeader(http.StatusNoContent)
}

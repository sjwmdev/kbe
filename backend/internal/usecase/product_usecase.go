package usecase

import (
	"context"
	"fmt"

	"github.com/google/uuid"

	"backend/internal/domain"
)

// ProductInput carries the fields an admin can set on a product, shared by
// both create and update flows.
type ProductInput struct {
	Name              string
	Description       string
	Price             float64
	CategoryID        uuid.UUID
	IsActive          bool
	StockQuantity     int
	LowStockThreshold int
	Colors            []string
}

func (in ProductInput) Validate() error {
	if in.Name == "" {
		return fmt.Errorf("%w: name is required", ErrValidation)
	}
	if in.Price < 0 {
		return fmt.Errorf("%w: price must not be negative", ErrValidation)
	}
	if in.CategoryID == uuid.Nil {
		return fmt.Errorf("%w: category is required", ErrValidation)
	}
	if in.StockQuantity < 0 {
		return fmt.Errorf("%w: stock quantity must not be negative", ErrValidation)
	}
	if in.LowStockThreshold < 0 {
		return fmt.Errorf("%w: low stock threshold must not be negative", ErrValidation)
	}
	for _, c := range in.Colors {
		if !domain.IsValidProductColor(c) {
			return fmt.Errorf("%w: invalid color %q", ErrValidation, c)
		}
	}

	return nil
}

type ProductUsecase struct {
	products   domain.ProductRepository
	images     domain.ProductImageRepository
	likes      domain.ProductLikeRepository
	categories domain.CategoryRepository
}

func NewProductUsecase(products domain.ProductRepository, images domain.ProductImageRepository, likes domain.ProductLikeRepository, categories domain.CategoryRepository) *ProductUsecase {
	return &ProductUsecase{products: products, images: images, likes: likes, categories: categories}
}

// checkCategory confirms categoryID both exists and belongs to businessID —
// a plain "does this UUID look valid" check in ProductInput.Validate can't
// catch a category ID from a different business, so this runs separately
// wherever a category is actually being assigned. Returns the category so
// callers can refresh a product's display-only CategoryName/CategorySlug
// fields without a second round trip.
func (u *ProductUsecase) checkCategory(ctx context.Context, categoryID, businessID uuid.UUID) (*domain.Category, error) {
	category, err := u.categories.FindByID(ctx, categoryID, businessID)
	if err != nil {
		return nil, err
	}
	if category == nil {
		return nil, fmt.Errorf("%w: category not found", ErrValidation)
	}
	return category, nil
}

// ListActive returns a page of active products for the public listing page
// of one business, each already carrying its primary image and like count.
// filter's fields are each optional (nil/empty means no filter on that
// dimension).
func (u *ProductUsecase) ListActive(ctx context.Context, businessID uuid.UUID, filter domain.ProductFilter, page, pageSize int) ([]domain.Product, int, error) {
	return u.products.FindAllActive(ctx, businessID, filter, page, pageSize)
}

// ListAll returns a page of products, including inactive (soft-deleted) ones,
// for the admin inventory table, always scoped to businessID. createdBy nil
// means no additional ownership filter (SuperAdmin); non-nil scopes the
// listing further to that user's own products.
func (u *ProductUsecase) ListAll(ctx context.Context, businessID uuid.UUID, createdBy *uuid.UUID, page, pageSize int) ([]domain.Product, int, error) {
	return u.products.FindAll(ctx, businessID, createdBy, page, pageSize)
}

// GetByID returns a single product with its full image gallery for the
// public product detail page. Deliberately not businessID-scoped — the ID
// alone uniquely identifies the product, and there's no list being filtered
// (see ProductRepository.FindByID).
func (u *ProductUsecase) GetByID(ctx context.Context, id uuid.UUID) (*domain.Product, error) {
	product, err := u.products.FindByID(ctx, id)
	if err != nil {
		return nil, err
	}
	if product == nil {
		return nil, domain.ErrNotFound
	}

	images, err := u.images.FindByProductID(ctx, id)
	if err != nil {
		return nil, err
	}
	product.Images = images

	return product, nil
}

// GetAdminDetail returns a single product with its full image gallery for
// the admin read-only product details page. Same data-isolation rule as
// Update/Delete — the tenant boundary is never bypassed, and a
// non-SuperAdmin caller may only view a product they created.
func (u *ProductUsecase) GetAdminDetail(ctx context.Context, id, businessID, callerID uuid.UUID, isSuperAdmin bool) (*domain.Product, error) {
	product, err := u.products.FindByID(ctx, id)
	if err != nil {
		return nil, err
	}
	if product == nil || product.BusinessID != businessID {
		return nil, domain.ErrNotFound
	}
	if !isSuperAdmin && (product.CreatedBy == nil || *product.CreatedBy != callerID) {
		return nil, domain.ErrForbidden
	}

	images, err := u.images.FindByProductID(ctx, id)
	if err != nil {
		return nil, err
	}
	product.Images = images

	return product, nil
}

// Create records the authenticated caller's business and their own user ID
// as the product's creator — the basis for data isolation (non-SuperAdmin
// roles only see/edit their own products within their own business).
func (u *ProductUsecase) Create(ctx context.Context, in ProductInput, businessID, createdBy uuid.UUID) (*domain.Product, error) {
	if err := in.Validate(); err != nil {
		return nil, err
	}
	category, err := u.checkCategory(ctx, in.CategoryID, businessID)
	if err != nil {
		return nil, err
	}

	product := &domain.Product{
		BusinessID:        businessID,
		Name:              in.Name,
		Description:       SanitizeDescriptionHTML(in.Description),
		Price:             in.Price,
		CategoryID:        in.CategoryID,
		IsActive:          true,
		StockQuantity:     in.StockQuantity,
		LowStockThreshold: in.LowStockThreshold,
		Colors:            in.Colors,
		CreatedBy:         &createdBy,
	}
	if err := u.products.Create(ctx, product); err != nil {
		return nil, err
	}
	product.CategoryName = category.Name
	product.CategorySlug = category.Slug

	return product, nil
}

// Update enforces data isolation: the product must belong to businessID
// (checked unconditionally, even for SuperAdmin — the tenant boundary is
// never bypassed), and a non-SuperAdmin caller may only edit a product they
// created.
func (u *ProductUsecase) Update(ctx context.Context, id uuid.UUID, in ProductInput, businessID, callerID uuid.UUID, isSuperAdmin bool) (*domain.Product, error) {
	if err := in.Validate(); err != nil {
		return nil, err
	}

	existing, err := u.products.FindByID(ctx, id)
	if err != nil {
		return nil, err
	}
	if existing == nil || existing.BusinessID != businessID {
		return nil, domain.ErrNotFound
	}
	if !isSuperAdmin && (existing.CreatedBy == nil || *existing.CreatedBy != callerID) {
		return nil, domain.ErrForbidden
	}
	category, err := u.checkCategory(ctx, in.CategoryID, businessID)
	if err != nil {
		return nil, err
	}

	existing.Name = in.Name
	existing.Description = SanitizeDescriptionHTML(in.Description)
	existing.Price = in.Price
	existing.CategoryID = in.CategoryID
	existing.IsActive = in.IsActive
	existing.StockQuantity = in.StockQuantity
	existing.LowStockThreshold = in.LowStockThreshold
	existing.Colors = in.Colors

	if err := u.products.Update(ctx, existing); err != nil {
		return nil, err
	}
	existing.CategoryName = category.Name
	existing.CategorySlug = category.Slug

	return existing, nil
}

// Delete soft-deletes a product (is_active = false), never a hard delete.
// Same data-isolation rule as Update.
func (u *ProductUsecase) Delete(ctx context.Context, id uuid.UUID, businessID, callerID uuid.UUID, isSuperAdmin bool) error {
	existing, err := u.products.FindByID(ctx, id)
	if err != nil {
		return err
	}
	if existing == nil || existing.BusinessID != businessID {
		return domain.ErrNotFound
	}
	if !isSuperAdmin && (existing.CreatedBy == nil || *existing.CreatedBy != callerID) {
		return domain.ErrForbidden
	}

	return u.products.SoftDelete(ctx, id)
}

// Restore reverses a soft delete/hide, making the product visible again.
// Same data-isolation rule as Update/Delete.
func (u *ProductUsecase) Restore(ctx context.Context, id uuid.UUID, businessID, callerID uuid.UUID, isSuperAdmin bool) error {
	existing, err := u.products.FindByID(ctx, id)
	if err != nil {
		return err
	}
	if existing == nil || existing.BusinessID != businessID {
		return domain.ErrNotFound
	}
	if !isSuperAdmin && (existing.CreatedBy == nil || *existing.CreatedBy != callerID) {
		return domain.ErrForbidden
	}

	return u.products.Restore(ctx, id)
}

// ForceDelete permanently removes a product row — for products created by
// mistake with no order history. The repository translates the database's
// ON DELETE RESTRICT violation (order_items.product_id) into
// domain.ErrProductInUse when the product has order/financial history,
// rather than silently cascading and corrupting that history. Same
// data-isolation rule as Update/Delete; requires the separate
// products.forceDelete permission (checked by the caller/middleware), since
// this is materially more dangerous than a soft delete.
func (u *ProductUsecase) ForceDelete(ctx context.Context, id uuid.UUID, businessID, callerID uuid.UUID, isSuperAdmin bool) error {
	existing, err := u.products.FindByID(ctx, id)
	if err != nil {
		return err
	}
	if existing == nil || existing.BusinessID != businessID {
		return domain.ErrNotFound
	}
	if !isSuperAdmin && (existing.CreatedBy == nil || *existing.CreatedBy != callerID) {
		return domain.ErrForbidden
	}

	return u.products.HardDelete(ctx, id)
}

// Like increments the social-proof like counter for a product. Public,
// unauthenticated, and deliberately not businessID-scoped — same reasoning
// as GetByID.
func (u *ProductUsecase) Like(ctx context.Context, id uuid.UUID) (int, error) {
	product, err := u.products.FindByID(ctx, id)
	if err != nil {
		return 0, err
	}
	if product == nil {
		return 0, domain.ErrNotFound
	}

	return u.likes.Increment(ctx, id)
}

// Unlike reverses Like. Public, unauthenticated, and deliberately not
// businessID-scoped — same reasoning as Like/GetByID; the client (not an
// account, since the storefront has no customer login) is the only thing
// tracking which products it has liked.
func (u *ProductUsecase) Unlike(ctx context.Context, id uuid.UUID) (int, error) {
	product, err := u.products.FindByID(ctx, id)
	if err != nil {
		return 0, err
	}
	if product == nil {
		return 0, domain.ErrNotFound
	}

	return u.likes.Decrement(ctx, id)
}

// AddImage records an image against a product — either a freshly uploaded
// file (mediaAssetID nil) or an existing Media Library asset being reused
// without re-uploading (mediaAssetID set), both going through the same path.
// The caller (upload handler) has already resolved and business-checked the
// target product before calling this.
func (u *ProductUsecase) AddImage(ctx context.Context, productID uuid.UUID, imageURL string, isPrimary bool, mediaAssetID *uuid.UUID) (*domain.ProductImage, error) {
	image := &domain.ProductImage{
		ProductID:    productID,
		ImageURL:     imageURL,
		IsPrimary:    isPrimary,
		MediaAssetID: mediaAssetID,
	}
	if err := u.images.Create(ctx, image); err != nil {
		return nil, err
	}

	return image, nil
}

// DeleteImage removes an image from a product, after verifying the image's
// product belongs to businessID (product_images has no business_id column of
// its own — it's scoped via this join back to its parent product, since it's
// only ever reached either via a product's own gallery or this direct-by-ID
// path). If the removed image was the primary one and other images remain,
// the earliest-uploaded remaining image is promoted to primary so the
// product is never left without one. Returns the deleted image record so
// callers can clean up the underlying file.
func (u *ProductUsecase) DeleteImage(ctx context.Context, imageID, businessID uuid.UUID) (*domain.ProductImage, error) {
	image, err := u.images.FindByID(ctx, imageID)
	if err != nil {
		return nil, err
	}
	if image == nil {
		return nil, domain.ErrNotFound
	}

	product, err := u.products.FindByID(ctx, image.ProductID)
	if err != nil {
		return nil, err
	}
	if product == nil || product.BusinessID != businessID {
		return nil, domain.ErrNotFound
	}

	if err := u.images.Delete(ctx, imageID); err != nil {
		return nil, err
	}

	if image.IsPrimary {
		remaining, err := u.images.FindByProductID(ctx, image.ProductID)
		if err != nil {
			return nil, err
		}
		if len(remaining) > 0 {
			if err := u.images.SetPrimary(ctx, remaining[0].ID); err != nil {
				return nil, err
			}
		}
	}

	return image, nil
}

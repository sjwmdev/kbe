package domain

import (
	"context"
	"time"

	"github.com/google/uuid"
)

// UserRepository is the port for admin user persistence.
type UserRepository interface {
	// FindByEmail is deliberately global (not businessID-scoped) — email is
	// unique system-wide (see users_email_unique) and login itself doesn't
	// carry a tenant identifier in phase 1 of the multi-tenant retrofit.
	FindByEmail(ctx context.Context, email string) (*User, error)
	FindByID(ctx context.Context, id, businessID uuid.UUID) (*User, error)
	FindAll(ctx context.Context, businessID uuid.UUID) ([]User, error)
	CountActiveByRole(ctx context.Context, roleID, businessID uuid.UUID) (int, error)
	Create(ctx context.Context, user *User) error
	UpdateProfile(ctx context.Context, user *User) error
	UpdateUser(ctx context.Context, user *User) error
	SetActive(ctx context.Context, id, businessID uuid.UUID, isActive bool) error
	Delete(ctx context.Context, id, businessID uuid.UUID) error
	UpdatePasswordHash(ctx context.Context, id uuid.UUID, passwordHash string) error
	SetMustChangePassword(ctx context.Context, id uuid.UUID, value bool) error
	IncrementFailedAttempts(ctx context.Context, id uuid.UUID) (int, error)
	LockUntil(ctx context.Context, id uuid.UUID, until time.Time) error
	ResetLoginAttempts(ctx context.Context, id uuid.UUID) error
}

// ProductRepository is the port for product persistence.
type ProductRepository interface {
	// FindAllActive is the public product listing page for one business:
	// categoryID nil means no filter. Paginated the same way as FindAll
	// below, for the same reason — a growing catalog shouldn't mean an
	// ever-larger single response.
	FindAllActive(ctx context.Context, businessID uuid.UUID, categoryID *uuid.UUID, page, pageSize int) ([]Product, int, error)
	// FindAll is the admin inventory listing, always scoped to businessID;
	// createdBy nil additionally means "no ownership filter within this
	// business" (SuperAdmin sees everything in their own tenant), non-nil
	// scopes further to that user's own products. Returns the page plus the
	// total matching row count for pagination controls.
	FindAll(ctx context.Context, businessID uuid.UUID, createdBy *uuid.UUID, page, pageSize int) ([]Product, int, error)
	// FindByID is intentionally NOT businessID-scoped at the query level — it
	// backs the public single-product page (no tenant context available) as
	// well as admin mutation flows, which must instead compare the returned
	// row's BusinessID against the caller's and reject a mismatch themselves
	// (mirrors the existing CreatedBy ownership check).
	FindByID(ctx context.Context, id uuid.UUID) (*Product, error)
	Create(ctx context.Context, product *Product) error
	Update(ctx context.Context, product *Product) error
	SoftDelete(ctx context.Context, id uuid.UUID) error
}

// ProductImageRepository is the port for product image persistence.
type ProductImageRepository interface {
	FindByProductID(ctx context.Context, productID uuid.UUID) ([]ProductImage, error)
	FindByID(ctx context.Context, id uuid.UUID) (*ProductImage, error)
	Create(ctx context.Context, image *ProductImage) error
	Delete(ctx context.Context, id uuid.UUID) error
	SetPrimary(ctx context.Context, id uuid.UUID) error
}

// ProductLikeRepository is the port for product like-count persistence.
type ProductLikeRepository interface {
	Increment(ctx context.Context, productID uuid.UUID) (int, error)
}

// SettingsRepository is the port for one business's settings row.
type SettingsRepository interface {
	Get(ctx context.Context, businessID uuid.UUID) (*SiteSettings, error)
	Update(ctx context.Context, settings *SiteSettings) error
	// Create inserts the initial settings row for a newly-provisioned
	// business — used only by cmd/provision-business, never by the
	// tenant-facing admin API (which only ever updates an existing row).
	Create(ctx context.Context, settings *SiteSettings) error
}

// StaticPageRepository is the port for admin-editable static page content.
type StaticPageRepository interface {
	FindBySlug(ctx context.Context, slug StaticPageSlug, businessID uuid.UUID) (*StaticPage, error)
	FindAll(ctx context.Context, businessID uuid.UUID) ([]StaticPage, error)
	Update(ctx context.Context, page *StaticPage) error
	// Create inserts the initial 4 static page rows for a newly-provisioned
	// business — used only by cmd/provision-business.
	Create(ctx context.Context, page *StaticPage) error
}

// SliderPosterRepository is the port for homepage hero slider posters.
type SliderPosterRepository interface {
	FindAllActive(ctx context.Context, businessID uuid.UUID) ([]SliderPoster, error)
	FindAll(ctx context.Context, businessID uuid.UUID) ([]SliderPoster, error)
	FindByID(ctx context.Context, id, businessID uuid.UUID) (*SliderPoster, error)
	Create(ctx context.Context, poster *SliderPoster) error
	Update(ctx context.Context, poster *SliderPoster) error
	Delete(ctx context.Context, id, businessID uuid.UUID) error
}

// RoleRepository is the port for role persistence and their permission grants.
// RoleRepository is the port for role persistence. Every lookup requires
// businessID as well as the role's own id — a role row belonging to a
// different business than the caller's simply won't be found, which is the
// defense-in-depth backstop behind RequireSuperAdmin/RequirePermission (see
// RoleUsecase.IsSuperAdminRole/GetRolePermissionKeys).
type RoleRepository interface {
	FindAll(ctx context.Context, businessID uuid.UUID) ([]Role, error)
	FindByID(ctx context.Context, id, businessID uuid.UUID) (*Role, error)
	Create(ctx context.Context, role *Role) error
	Update(ctx context.Context, role *Role) error
	Delete(ctx context.Context, id, businessID uuid.UUID) error
	FindPermissionIDs(ctx context.Context, roleID, businessID uuid.UUID) ([]uuid.UUID, error)
	FindPermissionKeys(ctx context.Context, roleID, businessID uuid.UUID) ([]string, error)
	SetPermissions(ctx context.Context, roleID, businessID uuid.UUID, permissionIDs []uuid.UUID) error
}

// PermissionRepository is the port for the fixed permission catalog.
type PermissionRepository interface {
	FindAll(ctx context.Context) ([]Permission, error)
}

// MediaRepository is the port for the standalone Media Library — folders and
// the assets within them, independent of any specific product or slider.
type MediaRepository interface {
	ListFolders(ctx context.Context, businessID uuid.UUID) ([]MediaFolder, error)
	CreateFolder(ctx context.Context, folder *MediaFolder) error
	// DeleteFolder removes the folder itself; its assets are reassigned to
	// root (folder_id = NULL) first via ON DELETE SET NULL, never deleted.
	DeleteFolder(ctx context.Context, id, businessID uuid.UUID) error

	// ListAssets returns one page of assets in folderID (nil = root only),
	// plus the total matching count for pagination.
	ListAssets(ctx context.Context, businessID uuid.UUID, folderID *uuid.UUID, page, pageSize int) ([]MediaAsset, int, error)
	CreateAsset(ctx context.Context, asset *MediaAsset) error
	// DeleteAssets deletes every asset in ids (scoped to businessID) that
	// isn't currently referenced by a product or slider, returning the
	// deleted assets' image URLs (so the caller can clean up files on disk)
	// and the IDs that were skipped because they're still in use.
	DeleteAssets(ctx context.Context, businessID uuid.UUID, ids []uuid.UUID) (deletedURLs []string, skippedIDs []uuid.UUID, err error)
	MoveAssets(ctx context.Context, businessID uuid.UUID, ids []uuid.UUID, folderID *uuid.UUID) error

	// IsImageURLInUse reports whether any product image, slider poster, or
	// media asset within businessID still references imageURL. Used before
	// physically deleting a file from disk — several rows can point at the
	// same underlying file (e.g. a Media Library asset backfilled from a
	// pre-existing product image), so removing one row's file must not break
	// another's.
	IsImageURLInUse(ctx context.Context, businessID uuid.UUID, imageURL string) (bool, error)
}

// AuditLogRepository is the port for the system-wide audit trail — mutating
// admin actions and login attempts, viewable and clearable by SuperAdmin only.
type AuditLogRepository interface {
	Create(ctx context.Context, log *AuditLog) error
	// List returns one page of log entries for businessID ordered
	// newest-first, plus the total matching count for pagination.
	List(ctx context.Context, businessID uuid.UUID, page, pageSize int) ([]AuditLog, int, error)
	Clear(ctx context.Context, businessID uuid.UUID) error
}

// CustomerRepository is the port for the lightweight customer records
// captured at order-entry time.
type CustomerRepository interface {
	// FindOrCreateByPhone looks up a customer by phone within businessID,
	// creating one if none exists; an existing customer's name is refreshed
	// to the given value (keeps the latest name on repeat customers).
	FindOrCreateByPhone(ctx context.Context, businessID uuid.UUID, name, phone string) (*Customer, error)
	// CountActiveSince counts distinct customers with at least one
	// non-cancelled order placed within [since, until).
	CountActiveSince(ctx context.Context, businessID uuid.UUID, createdBy *uuid.UUID, since, until time.Time) (int, error)
}

// OrderRepository is the port for manually-recorded sales and their line
// items.
type OrderRepository interface {
	// Create persists the order and its items and decrements each item's
	// product stock, all within a single transaction.
	Create(ctx context.Context, order *Order) (*Order, error)
	// List returns one page of orders (newest first) plus the total matching
	// count, always scoped to businessID. createdBy nil means no additional
	// ownership filter within that business (SuperAdmin sees everything in
	// their own tenant).
	List(ctx context.Context, businessID uuid.UUID, createdBy *uuid.UUID, page, pageSize int) ([]Order, int, error)
	// FindByID is intentionally NOT businessID-scoped at the query level —
	// mirrors ProductRepository.FindByID; callers compare the returned row's
	// BusinessID against the caller's themselves.
	FindByID(ctx context.Context, id uuid.UUID) (*Order, error)
	// UpdateStatus transitions an order's status; transitioning to
	// OrderCancelled restocks its line items' products within the same
	// transaction.
	UpdateStatus(ctx context.Context, id uuid.UUID, status OrderStatus) (*Order, error)
	// SummaryStats sums total_amount and counts non-cancelled orders created
	// within [since, until), always scoped to businessID, optionally further
	// to createdBy.
	SummaryStats(ctx context.Context, businessID uuid.UUID, createdBy *uuid.UUID, since, until time.Time) (sales float64, orderCount int, err error)
	// TopProductPerformance returns up to limit products ordered by units
	// sold (descending) within non-cancelled orders since the given time,
	// always scoped to businessID.
	TopProductPerformance(ctx context.Context, businessID uuid.UUID, createdBy *uuid.UUID, since time.Time, limit int) ([]ProductPerformance, error)
}

// BusinessRepository is the port for tenant (business) persistence. This is
// a platform-level concept — created only via the provision-business CLI,
// never editable by a tenant's own admins.
type BusinessRepository interface {
	Create(ctx context.Context, business *Business) error
	FindByID(ctx context.Context, id uuid.UUID) (*Business, error)
	FindBySlug(ctx context.Context, slug string) (*Business, error)
	FindAll(ctx context.Context) ([]Business, error)
}

// CategoryRepository is the port for a business's own product categories
// (replacing the old fixed perfume/cosmetics/shoes enum).
type CategoryRepository interface {
	FindAll(ctx context.Context, businessID uuid.UUID) ([]Category, error)
	FindByID(ctx context.Context, id, businessID uuid.UUID) (*Category, error)
	Create(ctx context.Context, category *Category) error
	Update(ctx context.Context, category *Category) error
	// Delete fails if any product still references this category — see
	// domain.ErrCategoryInUse.
	Delete(ctx context.Context, id, businessID uuid.UUID) error
}

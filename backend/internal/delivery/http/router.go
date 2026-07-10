package httpdelivery

import (
	"net/http"

	"backend/internal/usecase"
)

type RouterDeps struct {
	ProductHandler      *ProductHandler
	AuthHandler         *AuthHandler
	UploadHandler       *UploadHandler
	ContentHandler      *ContentHandler
	RoleHandler         *RoleHandler
	UserHandler         *UserHandler
	MediaHandler        *MediaHandler
	AuditLogHandler     *AuditLogHandler
	OrderHandler        *OrderHandler
	DashboardHandler    *DashboardHandler
	CategoryHandler     *CategoryHandler
	NotificationHandler *NotificationHandler
	TemplateHandler     *MessageTemplateHandler
	RoleUsecase         *usecase.RoleUsecase
	AuditLogUsecase     *usecase.AuditLogUsecase
	TokenManager        *TokenManager
	UploadsDir          string
	AllowedOrigin       string
}

func NewRouter(deps RouterDeps) http.Handler {
	mux := http.NewServeMux()

	mux.HandleFunc("GET /health", func(w http.ResponseWriter, r *http.Request) {
		writeJSON(w, http.StatusOK, map[string]string{"status": "ok"})
	})

	// Public routes.
	mux.HandleFunc("GET /api/v1/products", deps.ProductHandler.List)
	mux.HandleFunc("GET /api/v1/products/{id}", deps.ProductHandler.Get)
	mux.HandleFunc("POST /api/v1/products/{id}/like", deps.ProductHandler.Like)
	mux.HandleFunc("DELETE /api/v1/products/{id}/like", deps.ProductHandler.Unlike)
	mux.HandleFunc("POST /api/v1/admin/login", deps.AuthHandler.Login)
	mux.HandleFunc("POST /api/v1/admin/forgot-password", deps.AuthHandler.ForgotPassword)
	mux.HandleFunc("GET /api/v1/settings", deps.ContentHandler.GetSettings)
	mux.HandleFunc("GET /api/v1/pages/{slug}", deps.ContentHandler.GetPage)
	mux.HandleFunc("GET /api/v1/sliders", deps.ContentHandler.ListActiveSliders)
	mux.HandleFunc("GET /api/v1/categories", deps.CategoryHandler.List)

	requireAuth := RequireAuth(deps.TokenManager)
	auditLog := AuditLog(deps.AuditLogUsecase)

	// selfService: authenticated, but no permission check and no password-
	// change gate — used only by the password-change endpoint itself, which
	// must stay reachable precisely when that gate is up.
	selfService := func(h http.HandlerFunc) http.Handler {
		return requireAuth(auditLog(h))
	}

	// selfServiceGated: authenticated + blocked by RequirePasswordChanged, but
	// no specific permission needed (every user manages their own profile).
	selfServiceGated := func(h http.HandlerFunc) http.Handler {
		return requireAuth(auditLog(RequirePasswordChanged(h)))
	}

	// protect: the standard chain for every permission-gated admin route —
	// authenticate, audit-log mutations (including permission-denied ones),
	// block until the password is changed, then check the specific
	// permission key from the Task 11 catalog.
	protect := func(permKey string, h http.HandlerFunc) http.Handler {
		return requireAuth(auditLog(RequirePasswordChanged(RequirePermission(deps.RoleUsecase, permKey)(h))))
	}

	// protectAny: same chain as protect, but passes when the role holds ANY
	// of the listed keys — for routes shared by two modules (product-image
	// endpoints belong to product management as much as the media library).
	protectAny := func(h http.HandlerFunc, permKeys ...string) http.Handler {
		return requireAuth(auditLog(RequirePasswordChanged(RequirePermission(deps.RoleUsecase, permKeys...)(h))))
	}

	// superAdminOnly: authenticated + audit-logged, but gated by a hard
	// role-name check instead of a grantable permission key — used only for
	// the audit log routes themselves (see RequireSuperAdmin).
	superAdminOnly := func(h http.HandlerFunc) http.Handler {
		return requireAuth(auditLog(RequireSuperAdmin(deps.RoleUsecase)(h)))
	}

	mux.Handle("GET /api/v1/admin/products", protect("products.view", deps.ProductHandler.ListAll))
	mux.Handle("GET /api/v1/admin/products/{id}", protect("products.view", deps.ProductHandler.GetAdminDetail))
	mux.Handle("POST /api/v1/admin/products", protect("products.create", deps.ProductHandler.Create))
	mux.Handle("PUT /api/v1/admin/products/{id}", protect("products.edit", deps.ProductHandler.Update))
	mux.Handle("DELETE /api/v1/admin/products/{id}", protect("products.delete", deps.ProductHandler.Delete))
	mux.Handle("PUT /api/v1/admin/products/{id}/restore", protect("products.restore", deps.ProductHandler.Restore))
	mux.Handle("DELETE /api/v1/admin/products/{id}/force", protect("products.forceDelete", deps.ProductHandler.ForceDelete))
	// Product-image attach/detach is part of managing a product, not just
	// the media library — a role that can create or edit products must be
	// able to give them images without also holding media.* grants (the
	// handler still enforces the product belongs to the caller's business).
	mux.Handle("POST /api/v1/admin/products/{id}/images", protectAny(deps.UploadHandler.Upload, "media.upload", "products.create", "products.edit"))
	mux.Handle("DELETE /api/v1/admin/images/{id}", protectAny(deps.UploadHandler.DeleteImage, "media.delete", "products.edit", "products.create"))
	mux.Handle("PUT /api/v1/admin/settings", protect("settings.edit", deps.ContentHandler.UpdateSettings))
	mux.Handle("GET /api/v1/admin/pages", protect("pages.view", deps.ContentHandler.ListPages))
	mux.Handle("PUT /api/v1/admin/pages/{slug}", protect("pages.edit", deps.ContentHandler.UpdatePage))
	mux.Handle("GET /api/v1/admin/sliders", protect("sliders.view", deps.ContentHandler.ListAllSliders))
	mux.Handle("POST /api/v1/admin/sliders", protect("sliders.create", deps.ContentHandler.CreateSlider))
	mux.Handle("PUT /api/v1/admin/sliders/{id}", protect("sliders.edit", deps.ContentHandler.UpdateSlider))
	mux.Handle("DELETE /api/v1/admin/sliders/{id}", protect("sliders.delete", deps.ContentHandler.DeleteSlider))
	mux.Handle("POST /api/v1/admin/sliders/upload", protect("media.upload", deps.ContentHandler.UploadSliderImage))

	mux.Handle("GET /api/v1/admin/me", selfServiceGated(deps.AuthHandler.Me))
	mux.Handle("PUT /api/v1/admin/me", selfServiceGated(deps.AuthHandler.UpdateProfile))
	mux.Handle("PUT /api/v1/admin/me/password", selfService(deps.AuthHandler.ChangePassword))

	mux.Handle("GET /api/v1/admin/roles", protect("roles.view", deps.RoleHandler.ListRoles))
	mux.Handle("POST /api/v1/admin/roles", protect("roles.create", deps.RoleHandler.CreateRole))
	mux.Handle("PUT /api/v1/admin/roles/{id}", protect("roles.edit", deps.RoleHandler.UpdateRole))
	mux.Handle("DELETE /api/v1/admin/roles/{id}", protect("roles.delete", deps.RoleHandler.DeleteRole))
	mux.Handle("GET /api/v1/admin/permissions", protect("roles.view", deps.RoleHandler.ListPermissions))
	mux.Handle("GET /api/v1/admin/roles/{id}/permissions", protect("roles.view", deps.RoleHandler.GetRolePermissions))
	mux.Handle("PUT /api/v1/admin/roles/{id}/permissions", protect("roles.edit", deps.RoleHandler.SetRolePermissions))

	mux.Handle("GET /api/v1/admin/users", protect("users.view", deps.UserHandler.ListUsers))
	mux.Handle("POST /api/v1/admin/users", protect("users.create", deps.UserHandler.CreateUser))
	mux.Handle("PUT /api/v1/admin/users/{id}", protect("users.edit", deps.UserHandler.UpdateUser))
	mux.Handle("DELETE /api/v1/admin/users/{id}", protect("users.delete", deps.UserHandler.DeleteUser))
	mux.Handle("PUT /api/v1/admin/users/{id}/active", protect("users.edit", deps.UserHandler.SetActive))
	mux.Handle("POST /api/v1/admin/users/{id}/reset-password", protect("users.resetPassword", deps.UserHandler.ResetPassword))

	mux.Handle("GET /api/v1/admin/media/folders", protect("media.view", deps.MediaHandler.ListFolders))
	mux.Handle("POST /api/v1/admin/media/folders", protect("media.upload", deps.MediaHandler.CreateFolder))
	mux.Handle("DELETE /api/v1/admin/media/folders/{id}", protect("media.delete", deps.MediaHandler.DeleteFolder))
	mux.Handle("GET /api/v1/admin/media", protect("media.view", deps.MediaHandler.ListAssets))
	mux.Handle("POST /api/v1/admin/media/upload", protect("media.upload", deps.MediaHandler.Upload))
	mux.Handle("POST /api/v1/admin/media/bulk-delete", protect("media.delete", deps.MediaHandler.BulkDelete))
	mux.Handle("PUT /api/v1/admin/media/move", protect("media.upload", deps.MediaHandler.MoveAssets))

	mux.Handle("GET /api/v1/admin/audit-logs", superAdminOnly(deps.AuditLogHandler.ListLogs))
	mux.Handle("DELETE /api/v1/admin/audit-logs", superAdminOnly(deps.AuditLogHandler.ClearLogs))

	mux.Handle("GET /api/v1/admin/orders", protect("orders.view", deps.OrderHandler.List))
	mux.Handle("POST /api/v1/admin/orders", protect("orders.create", deps.OrderHandler.Create))
	mux.Handle("PUT /api/v1/admin/orders/{id}/status", protect("orders.edit", deps.OrderHandler.UpdateStatus))

	// Reading category names requires only authentication, not
	// categories.view: the product create/edit form needs the list to fill
	// its category select, and a role allowed to create products may well
	// not manage categories. The names are business-scoped via the JWT
	// claims inside ListAdmin (and are public on the storefront anyway);
	// creating/editing/deleting categories stays permission-gated below.
	mux.Handle("GET /api/v1/admin/categories", selfServiceGated(deps.CategoryHandler.ListAdmin))
	mux.Handle("POST /api/v1/admin/categories", protect("categories.create", deps.CategoryHandler.Create))
	mux.Handle("PUT /api/v1/admin/categories/{id}", protect("categories.edit", deps.CategoryHandler.Update))
	mux.Handle("DELETE /api/v1/admin/categories/{id}", protect("categories.delete", deps.CategoryHandler.Delete))

	mux.Handle("GET /api/v1/admin/notifications", protect("notifications.view", deps.NotificationHandler.List))
	mux.Handle("GET /api/v1/admin/notifications/unread-count", protect("notifications.view", deps.NotificationHandler.CountUnread))
	mux.Handle("PUT /api/v1/admin/notifications/{id}/read", protect("notifications.view", deps.NotificationHandler.MarkRead))
	mux.Handle("DELETE /api/v1/admin/notifications", protect("notifications.manage", deps.NotificationHandler.Clear))
	mux.Handle("DELETE /api/v1/admin/notifications/{id}", protect("notifications.manage", deps.NotificationHandler.Delete))
	mux.Handle("GET /api/v1/admin/message-templates", protect("notifications.view", deps.TemplateHandler.List))

	// No permission key — the "Muhtasari" dashboard nav item itself is
	// visible to every authenticated role, so its data follows suit.
	mux.Handle("GET /api/v1/admin/dashboard/summary", selfServiceGated(deps.DashboardHandler.GetSummary))

	// Serve uploaded product images.
	mux.Handle("/uploads/", http.StripPrefix("/uploads/", http.FileServer(http.Dir(deps.UploadsDir))))

	// Catch-all: anything not matched by a more specific pattern above gets a
	// consistent JSON 404 instead of Go's default plain-text body.
	mux.HandleFunc("/", NotFound)

	return CORS(deps.AllowedOrigin)(SecurityHeaders(Recoverer(LimitBodySize(mux))))
}

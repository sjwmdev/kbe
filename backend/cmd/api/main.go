package main

import (
	"context"
	"log"
	"net/http"
	"os"
	"time"

	delivery "backend/internal/delivery/http"
	"backend/internal/repository"
	"backend/internal/usecase"
)

func main() {
	ctx := context.Background()

	dsn := getenv("DATABASE_URL", "postgres://postgres:postgres@localhost:5432/kbe?sslmode=disable")
	jwtSecret := os.Getenv("JWT_SECRET")
	if jwtSecret == "" {
		log.Fatal("JWT_SECRET environment variable is required")
	}
	port := getenv("PORT", "8080")
	allowedOrigin := getenv("FRONTEND_ORIGIN", "http://localhost:5173")
	uploadsDir := getenv("UPLOADS_DIR", "uploads")
	// defaultBusinessSlug resolves which tenant an unauthenticated public
	// request (product catalog, sliders, settings, static pages) sees when it
	// doesn't pass ?business=<slug> — see tenant.go. Every request the
	// current single-tenant frontend sends omits this param, so it always
	// falls back to this default.
	defaultBusinessSlug := getenv("DEFAULT_BUSINESS_SLUG", "kalour")

	pool, err := repository.NewPostgresPool(ctx, dsn)
	if err != nil {
		log.Fatalf("failed to connect to database: %v", err)
	}
	defer pool.Close()

	userRepo := repository.NewUserRepository(pool)
	productRepo := repository.NewProductRepository(pool)
	imageRepo := repository.NewProductImageRepository(pool)
	likeRepo := repository.NewProductLikeRepository(pool)
	settingsRepo := repository.NewSettingsRepository(pool)
	staticPageRepo := repository.NewStaticPageRepository(pool)
	sliderPosterRepo := repository.NewSliderPosterRepository(pool)
	roleRepo := repository.NewRoleRepository(pool)
	permissionRepo := repository.NewPermissionRepository(pool)
	mediaRepo := repository.NewMediaRepository(pool)
	auditLogRepo := repository.NewAuditLogRepository(pool)
	customerRepo := repository.NewCustomerRepository(pool)
	orderRepo := repository.NewOrderRepository(pool)
	businessRepo := repository.NewBusinessRepository(pool)
	categoryRepo := repository.NewCategoryRepository(pool)

	authUsecase := usecase.NewAuthUsecase(userRepo)
	productUsecase := usecase.NewProductUsecase(productRepo, imageRepo, likeRepo, categoryRepo)
	categoryUsecase := usecase.NewCategoryUsecase(categoryRepo)
	contentUsecase := usecase.NewContentUsecase(settingsRepo, staticPageRepo, sliderPosterRepo)
	roleUsecase := usecase.NewRoleUsecase(roleRepo, permissionRepo)
	userUsecase := usecase.NewUserUsecase(userRepo, roleRepo)
	mediaUsecase := usecase.NewMediaUsecase(mediaRepo)
	auditLogUsecase := usecase.NewAuditLogUsecase(auditLogRepo)
	orderUsecase := usecase.NewOrderUsecase(orderRepo, customerRepo, productRepo)
	businessUsecase := usecase.NewBusinessUsecase(businessRepo)

	tokenManager := delivery.NewTokenManager(jwtSecret, 24*time.Hour)

	router := delivery.NewRouter(delivery.RouterDeps{
		ProductHandler:   delivery.NewProductHandler(productUsecase, roleUsecase, businessUsecase, defaultBusinessSlug),
		AuthHandler:      delivery.NewAuthHandler(authUsecase, roleUsecase, auditLogUsecase, tokenManager),
		UploadHandler:    delivery.NewUploadHandler(productUsecase, mediaUsecase, uploadsDir, "/uploads"),
		ContentHandler:   delivery.NewContentHandler(contentUsecase, mediaUsecase, businessUsecase, defaultBusinessSlug, uploadsDir, "/uploads"),
		RoleHandler:      delivery.NewRoleHandler(roleUsecase),
		UserHandler:      delivery.NewUserHandler(userUsecase),
		MediaHandler:     delivery.NewMediaHandler(mediaUsecase, uploadsDir, "/uploads"),
		AuditLogHandler:  delivery.NewAuditLogHandler(auditLogUsecase),
		OrderHandler:     delivery.NewOrderHandler(orderUsecase, roleUsecase),
		DashboardHandler: delivery.NewDashboardHandler(orderUsecase, roleUsecase),
		CategoryHandler:  delivery.NewCategoryHandler(categoryUsecase, businessUsecase, defaultBusinessSlug),
		RoleUsecase:      roleUsecase,
		AuditLogUsecase:  auditLogUsecase,
		TokenManager:     tokenManager,
		UploadsDir:       uploadsDir,
		AllowedOrigin:    allowedOrigin,
	})

	server := &http.Server{
		Addr:         ":" + port,
		Handler:      router,
		ReadTimeout:  15 * time.Second,
		WriteTimeout: 15 * time.Second,
	}

	log.Printf("kbe backend listening on :%s", port)
	if err := server.ListenAndServe(); err != nil {
		log.Fatalf("server error: %v", err)
	}
}

func getenv(key, fallback string) string {
	if v := os.Getenv(key); v != "" {
		return v
	}
	return fallback
}

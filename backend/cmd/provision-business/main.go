package main

import (
	"context"
	"log"
	"os"

	"github.com/google/uuid"
	"golang.org/x/crypto/bcrypt"

	"backend/internal/domain"
	"backend/internal/repository"
	"backend/internal/usecase"
)

// This is a one-off CLI, not an HTTP endpoint — mirrors cmd/seed's reasoning
// exactly: businesses are provisioned manually by the platform operator, not
// via public self-service signup. In one run this creates the business row,
// its own SuperAdmin/Manager/Editor roles (SuperAdmin granted every known
// permission), default categories, an initial settings/static-pages row, and
// the first user (SuperAdmin, must change password on first login).
//
// Run with:
//
//	BUSINESS_NAME=... BUSINESS_SLUG=... ADMIN_EMAIL=... ADMIN_USERNAME=... ADMIN_PASSWORD=... \
//	  go run ./cmd/provision-business
func main() {
	ctx := context.Background()

	dsn := os.Getenv("DATABASE_URL")
	if dsn == "" {
		dsn = "postgres://postgres:postgres@localhost:5432/kbe?sslmode=disable"
	}

	name := os.Getenv("BUSINESS_NAME")
	slug := os.Getenv("BUSINESS_SLUG")
	email := os.Getenv("ADMIN_EMAIL")
	username := os.Getenv("ADMIN_USERNAME")
	password := os.Getenv("ADMIN_PASSWORD")
	if name == "" || slug == "" || email == "" || username == "" || password == "" {
		log.Fatal("BUSINESS_NAME, BUSINESS_SLUG, ADMIN_EMAIL, ADMIN_USERNAME and ADMIN_PASSWORD environment variables are required")
	}

	pool, err := repository.NewPostgresPool(ctx, dsn)
	if err != nil {
		log.Fatalf("failed to connect to database: %v", err)
	}
	defer pool.Close()

	businessRepo := repository.NewBusinessRepository(pool)
	categoryRepo := repository.NewCategoryRepository(pool)
	roleRepo := repository.NewRoleRepository(pool)
	permissionRepo := repository.NewPermissionRepository(pool)
	settingsRepo := repository.NewSettingsRepository(pool)
	pageRepo := repository.NewStaticPageRepository(pool)
	userRepo := repository.NewUserRepository(pool)

	businesses := usecase.NewBusinessUsecase(businessRepo)
	categories := usecase.NewCategoryUsecase(categoryRepo)
	roles := usecase.NewRoleUsecase(roleRepo, permissionRepo)

	business, err := businesses.Create(ctx, usecase.BusinessInput{Name: name, Slug: slug})
	if err != nil {
		log.Fatalf("failed to create business: %v", err)
	}
	log.Printf("business %q (%s) created with id %s", business.Name, business.Slug, business.ID)

	defaultCategories := []usecase.CategoryInput{
		{Name: "Bidhaa", Slug: "general", DisplayOrder: 1},
	}
	for _, in := range defaultCategories {
		if _, err := categories.Create(ctx, in, business.ID); err != nil {
			log.Fatalf("failed to seed default category %q: %v", in.Name, err)
		}
	}
	log.Printf("seeded %d default categories for %q", len(defaultCategories), business.Name)

	// Roles: same 3-role starting point every business gets, mirroring the
	// original migration 0004 seed — SuperAdmin granted every known
	// permission, Manager/Editor start with none (granted later via the
	// Roles admin UI).
	roleDefs := []usecase.RoleInput{
		{Name: "SuperAdmin", Description: "Ufikiaji kamili wa mfumo"},
		{Name: "Manager", Description: "Anasimamia bidhaa na maudhui"},
		{Name: "Editor", Description: "Anahariri maudhui pekee"},
	}
	var superAdminRoleID *uuid.UUID
	for _, def := range roleDefs {
		role, err := roles.CreateRole(ctx, def, business.ID)
		if err != nil {
			log.Fatalf("failed to create role %q: %v", def.Name, err)
		}
		if def.Name == "SuperAdmin" {
			id := role.ID
			superAdminRoleID = &id
		}
	}
	if superAdminRoleID == nil {
		log.Fatal("SuperAdmin role was not created")
	}

	allPermissions, err := permissionRepo.FindAll(ctx)
	if err != nil {
		log.Fatalf("failed to look up permission catalog: %v", err)
	}
	permIDs := make([]uuid.UUID, 0, len(allPermissions))
	for _, p := range allPermissions {
		permIDs = append(permIDs, p.ID)
	}
	if err := roles.SetRolePermissions(ctx, *superAdminRoleID, business.ID, permIDs); err != nil {
		log.Fatalf("failed to grant permissions to SuperAdmin role: %v", err)
	}
	log.Printf("seeded 3 roles for %q (SuperAdmin granted all %d permissions)", business.Name, len(permIDs))

	// Initial settings row (this table has no defaults of its own — every
	// business needs exactly one row before GetSettings/UpdateSettings work).
	if err := settingsRepo.Create(ctx, &domain.SiteSettings{
		BusinessID:           business.ID,
		WhatsAppNumber:       "255000000000",
		ContactEmail:         email,
		ContactAddress:       "",
		CompanyName:          business.Name,
		BrandAccentColor:     "#b80049",
		BrandAccentColorDark: "#8f003d",
	}); err != nil {
		log.Fatalf("failed to seed initial settings: %v", err)
	}

	for _, slug := range []domain.StaticPageSlug{domain.PageAbout, domain.PageContact, domain.PagePrivacy, domain.PageTerms} {
		if err := pageRepo.Create(ctx, &domain.StaticPage{
			BusinessID: business.ID,
			Slug:       slug,
			Title:      business.Name,
			Body:       "",
		}); err != nil {
			log.Fatalf("failed to seed static page %q: %v", slug, err)
		}
	}
	log.Printf("seeded initial settings and static pages for %q", business.Name)

	// First user.
	hash, err := bcrypt.GenerateFromPassword([]byte(password), bcrypt.DefaultCost)
	if err != nil {
		log.Fatalf("failed to hash password: %v", err)
	}
	user := &domain.User{
		BusinessID:         business.ID,
		Username:           username,
		Email:              email,
		PasswordHash:       string(hash),
		RoleID:             superAdminRoleID,
		MustChangePassword: true,
	}
	if err := userRepo.Create(ctx, user); err != nil {
		log.Fatalf("failed to create first user: %v", err)
	}

	log.Printf("business %q fully provisioned — first SuperAdmin user %q created, must change password on first login", business.Name, email)
}

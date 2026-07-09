package main

import (
	"context"
	"log"
	"os"

	"golang.org/x/crypto/bcrypt"

	"backend/internal/domain"
	"backend/internal/repository"
)

// This is a one-off CLI, not an HTTP endpoint: the API intentionally has no
// public admin-registration route. Seeds the first SuperAdmin user for an
// already-provisioned business (see cmd/provision-business).
// Run with: BUSINESS_SLUG=... ADMIN_EMAIL=... ADMIN_USERNAME=... ADMIN_PASSWORD=... go run ./cmd/seed
func main() {
	ctx := context.Background()

	dsn := os.Getenv("DATABASE_URL")
	if dsn == "" {
		dsn = "postgres://postgres:postgres@localhost:5432/kbe?sslmode=disable"
	}

	businessSlug := os.Getenv("BUSINESS_SLUG")
	if businessSlug == "" {
		businessSlug = "kalour"
	}
	email := os.Getenv("ADMIN_EMAIL")
	username := os.Getenv("ADMIN_USERNAME")
	password := os.Getenv("ADMIN_PASSWORD")
	if email == "" || username == "" || password == "" {
		log.Fatal("ADMIN_EMAIL, ADMIN_USERNAME and ADMIN_PASSWORD environment variables are required")
	}

	pool, err := repository.NewPostgresPool(ctx, dsn)
	if err != nil {
		log.Fatalf("failed to connect to database: %v", err)
	}
	defer pool.Close()

	businessRepo := repository.NewBusinessRepository(pool)
	userRepo := repository.NewUserRepository(pool)
	roleRepo := repository.NewRoleRepository(pool)

	business, err := businessRepo.FindBySlug(ctx, businessSlug)
	if err != nil {
		log.Fatalf("failed to look up business %q: %v", businessSlug, err)
	}
	if business == nil {
		log.Fatalf("no business with slug %q — run cmd/provision-business first", businessSlug)
	}

	existing, err := userRepo.FindByEmail(ctx, email)
	if err != nil {
		log.Fatalf("failed to check existing admin: %v", err)
	}
	if existing != nil {
		log.Printf("admin user %q already exists, skipping", email)
		return
	}

	hash, err := bcrypt.GenerateFromPassword([]byte(password), bcrypt.DefaultCost)
	if err != nil {
		log.Fatalf("failed to hash password: %v", err)
	}

	user := &domain.User{
		BusinessID:         business.ID,
		Username:           username,
		Email:              email,
		PasswordHash:       string(hash),
		MustChangePassword: true,
	}

	roles, err := roleRepo.FindAll(ctx, business.ID)
	if err != nil {
		log.Fatalf("failed to look up roles: %v", err)
	}
	for _, role := range roles {
		if role.Name == "SuperAdmin" {
			roleID := role.ID
			user.RoleID = &roleID
			break
		}
	}
	if user.RoleID == nil {
		log.Println("warning: no SuperAdmin role found for this business — apply migrations first; creating user without a role")
	}

	if err := userRepo.Create(ctx, user); err != nil {
		log.Fatalf("failed to create admin user: %v", err)
	}

	log.Printf("admin user %q created successfully for business %q — must change password on first login", email, business.Name)
}

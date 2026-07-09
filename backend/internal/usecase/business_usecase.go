package usecase

import (
	"context"
	"fmt"
	"regexp"

	"github.com/google/uuid"

	"backend/internal/domain"
)

var slugPattern = regexp.MustCompile(`^[a-z0-9]+(-[a-z0-9]+)*$`)

// BusinessUsecase manages tenants. This is a platform-level concern — there
// is deliberately no HTTP route for it; businesses are provisioned via
// `cmd/provision-business`, mirroring how the sole admin user is bootstrapped
// via `cmd/seed`.
type BusinessUsecase struct {
	businesses domain.BusinessRepository
}

func NewBusinessUsecase(businesses domain.BusinessRepository) *BusinessUsecase {
	return &BusinessUsecase{businesses: businesses}
}

type BusinessInput struct {
	Name string
	Slug string
}

func (in BusinessInput) Validate() error {
	if in.Name == "" {
		return fmt.Errorf("%w: name is required", ErrValidation)
	}
	if in.Slug == "" || !slugPattern.MatchString(in.Slug) {
		return fmt.Errorf("%w: slug must be lowercase letters, numbers, and hyphens only", ErrValidation)
	}
	return nil
}

func (u *BusinessUsecase) Create(ctx context.Context, in BusinessInput) (*domain.Business, error) {
	if err := in.Validate(); err != nil {
		return nil, err
	}

	existing, err := u.businesses.FindBySlug(ctx, in.Slug)
	if err != nil {
		return nil, err
	}
	if existing != nil {
		return nil, fmt.Errorf("%w: a business with this slug already exists", ErrValidation)
	}

	business := &domain.Business{Name: in.Name, Slug: in.Slug, IsActive: true}
	if err := u.businesses.Create(ctx, business); err != nil {
		return nil, err
	}

	return business, nil
}

func (u *BusinessUsecase) List(ctx context.Context) ([]domain.Business, error) {
	return u.businesses.FindAll(ctx)
}

func (u *BusinessUsecase) GetByID(ctx context.Context, id uuid.UUID) (*domain.Business, error) {
	business, err := u.businesses.FindByID(ctx, id)
	if err != nil {
		return nil, err
	}
	if business == nil {
		return nil, domain.ErrNotFound
	}
	return business, nil
}

func (u *BusinessUsecase) GetBySlug(ctx context.Context, slug string) (*domain.Business, error) {
	business, err := u.businesses.FindBySlug(ctx, slug)
	if err != nil {
		return nil, err
	}
	if business == nil {
		return nil, domain.ErrNotFound
	}
	return business, nil
}

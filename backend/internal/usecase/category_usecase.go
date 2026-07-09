package usecase

import (
	"context"
	"fmt"

	"github.com/google/uuid"

	"backend/internal/domain"
)

type CategoryUsecase struct {
	categories domain.CategoryRepository
}

func NewCategoryUsecase(categories domain.CategoryRepository) *CategoryUsecase {
	return &CategoryUsecase{categories: categories}
}

type CategoryInput struct {
	Name         string
	Slug         string
	DisplayOrder int
}

func (in CategoryInput) Validate() error {
	if in.Name == "" {
		return fmt.Errorf("%w: name is required", ErrValidation)
	}
	if in.Slug == "" || !slugPattern.MatchString(in.Slug) {
		return fmt.Errorf("%w: slug must be lowercase letters, numbers, and hyphens only", ErrValidation)
	}
	return nil
}

func (u *CategoryUsecase) List(ctx context.Context, businessID uuid.UUID) ([]domain.Category, error) {
	return u.categories.FindAll(ctx, businessID)
}

func (u *CategoryUsecase) Create(ctx context.Context, in CategoryInput, businessID uuid.UUID) (*domain.Category, error) {
	if err := in.Validate(); err != nil {
		return nil, err
	}

	category := &domain.Category{
		BusinessID:   businessID,
		Name:         in.Name,
		Slug:         in.Slug,
		DisplayOrder: in.DisplayOrder,
	}
	if err := u.categories.Create(ctx, category); err != nil {
		return nil, err
	}

	return category, nil
}

func (u *CategoryUsecase) Update(ctx context.Context, id uuid.UUID, in CategoryInput, businessID uuid.UUID) (*domain.Category, error) {
	if err := in.Validate(); err != nil {
		return nil, err
	}

	existing, err := u.categories.FindByID(ctx, id, businessID)
	if err != nil {
		return nil, err
	}
	if existing == nil {
		return nil, domain.ErrNotFound
	}

	existing.Name = in.Name
	existing.Slug = in.Slug
	existing.DisplayOrder = in.DisplayOrder

	if err := u.categories.Update(ctx, existing); err != nil {
		return nil, err
	}

	return existing, nil
}

// Delete removes a category. If any product still references it, the
// repository translates the database's ON DELETE RESTRICT violation into
// domain.ErrCategoryInUse — a friendly 400, not a raw DB error.
func (u *CategoryUsecase) Delete(ctx context.Context, id uuid.UUID, businessID uuid.UUID) error {
	existing, err := u.categories.FindByID(ctx, id, businessID)
	if err != nil {
		return err
	}
	if existing == nil {
		return domain.ErrNotFound
	}

	return u.categories.Delete(ctx, id, businessID)
}

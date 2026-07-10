package domain

import "errors"

// ErrNotFound is returned by repositories when a requested record does not exist.
var ErrNotFound = errors.New("not found")

// ErrInvalidCredentials is returned when admin login credentials don't match.
var ErrInvalidCredentials = errors.New("invalid credentials")

// ErrAccountLocked is returned when a login attempt hits a temporary lockout
// from too many recent failed attempts.
var ErrAccountLocked = errors.New("account temporarily locked")

// ErrAccountInactive is returned when a deactivated user attempts to log in.
var ErrAccountInactive = errors.New("account is inactive")

// ErrForbidden is returned when a caller is authenticated but not allowed to
// act on a specific resource (e.g. a Manager editing another user's product).
var ErrForbidden = errors.New("forbidden")

// ErrCategoryInUse is returned when deleting a category that still has
// products assigned to it — a product without a category is a broken UI
// state, so this is blocked rather than silently nulling/cascading.
var ErrCategoryInUse = errors.New("category is still in use by one or more products")

// ErrProductInUse is returned when permanently deleting a product that still
// has order history — financial/order records must not lose their product
// reference, so hard delete is blocked (soft delete/hide remains available).
var ErrProductInUse = errors.New("product cannot be permanently deleted because it has order history")

// ErrInsufficientStock is returned when an order would decrement a
// product's stock below zero — checked both ahead of time (usecase) and
// atomically at write time (repository), the latter closing the race where
// two concurrent orders both pass the ahead-of-time check.
var ErrInsufficientStock = errors.New("insufficient stock")

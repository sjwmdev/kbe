package usecase

import "errors"

// ErrValidation is wrapped with a specific reason and returned when
// caller-supplied input fails business validation rules.
var ErrValidation = errors.New("validation error")

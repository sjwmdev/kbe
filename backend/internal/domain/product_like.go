package domain

import "github.com/google/uuid"

type ProductLike struct {
	ProductID  uuid.UUID
	LikesCount int
}

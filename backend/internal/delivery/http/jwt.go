package httpdelivery

import (
	"errors"
	"time"

	"github.com/golang-jwt/jwt/v5"
	"github.com/google/uuid"

	"backend/internal/domain"
)

var errInvalidToken = errors.New("invalid or expired token")

type Claims struct {
	UserID             uuid.UUID  `json:"user_id"`
	BusinessID         uuid.UUID  `json:"business_id"`
	Username           string     `json:"username"`
	Email              string     `json:"email"`
	RoleID             *uuid.UUID `json:"role_id,omitempty"`
	MustChangePassword bool       `json:"must_change_password"`
	jwt.RegisteredClaims
}

// TokenManager issues and validates the JWTs that protect admin routes.
type TokenManager struct {
	secret []byte
	ttl    time.Duration
}

func NewTokenManager(secret string, ttl time.Duration) *TokenManager {
	return &TokenManager{secret: []byte(secret), ttl: ttl}
}

// Generate issues a fresh token from the user's current DB state. Called
// both at login and right after a successful password change — the latter
// matters because MustChangePassword is baked into the token, so without a
// fresh one the old (stale) token would keep tripping RequirePasswordChanged
// even after the user complies.
func (m *TokenManager) Generate(user *domain.User) (string, error) {
	claims := Claims{
		UserID:             user.ID,
		BusinessID:         user.BusinessID,
		Username:           user.Username,
		Email:              user.Email,
		RoleID:             user.RoleID,
		MustChangePassword: user.MustChangePassword,
		RegisteredClaims: jwt.RegisteredClaims{
			ExpiresAt: jwt.NewNumericDate(time.Now().Add(m.ttl)),
			IssuedAt:  jwt.NewNumericDate(time.Now()),
		},
	}

	token := jwt.NewWithClaims(jwt.SigningMethodHS256, claims)
	return token.SignedString(m.secret)
}

func (m *TokenManager) Parse(tokenString string) (*Claims, error) {
	claims := &Claims{}
	token, err := jwt.ParseWithClaims(tokenString, claims, func(t *jwt.Token) (interface{}, error) {
		if _, ok := t.Method.(*jwt.SigningMethodHMAC); !ok {
			return nil, errInvalidToken
		}
		return m.secret, nil
	})
	if err != nil || !token.Valid {
		return nil, errInvalidToken
	}

	return claims, nil
}

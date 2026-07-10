package httpdelivery

import (
	"net/http"
	"time"

	"github.com/google/uuid"

	"backend/internal/domain"
	"backend/internal/usecase"
)

type NotificationHandler struct {
	notifications *usecase.NotificationUsecase
}

func NewNotificationHandler(notifications *usecase.NotificationUsecase) *NotificationHandler {
	return &NotificationHandler{notifications: notifications}
}

type notificationDTO struct {
	ID         string    `json:"id"`
	Category   string    `json:"category"`
	Message    string    `json:"message"`
	LinkURL    string    `json:"link_url"`
	IsRead     bool      `json:"is_read"`
	IsResolved bool      `json:"is_resolved"`
	CreatedAt  time.Time `json:"created_at"`
}

// List handles GET /api/v1/admin/notifications (protected). Optional query
// params: category (one of the known category keys), read=true|false,
// resolved=true|false — absent means no filter on that dimension.
func (h *NotificationHandler) List(w http.ResponseWriter, r *http.Request) {
	claims, ok := ClaimsFromContext(r.Context())
	if !ok {
		writeError(w, http.StatusUnauthorized, "missing or malformed authorization header")
		return
	}

	filter := domain.NotificationFilter{Category: r.URL.Query().Get("category")}
	if v := r.URL.Query().Get("read"); v != "" {
		b := v == "true"
		filter.IsRead = &b
	}
	if v := r.URL.Query().Get("resolved"); v != "" {
		b := v == "true"
		filter.IsResolved = &b
	}

	page, pageSize := parsePagination(r)
	notifications, total, err := h.notifications.List(r.Context(), claims.BusinessID, filter, page, pageSize)
	if handleUsecaseError(w, err) {
		return
	}

	dtos := make([]notificationDTO, 0, len(notifications))
	for _, n := range notifications {
		dtos = append(dtos, notificationDTO{
			ID:         n.ID.String(),
			Category:   n.Category,
			Message:    n.Message,
			LinkURL:    n.LinkURL,
			IsRead:     n.IsRead,
			IsResolved: n.IsResolved,
			CreatedAt:  n.CreatedAt,
		})
	}

	writeJSON(w, http.StatusOK, map[string]any{
		"notifications": dtos,
		"total":         total,
		"page":          page,
		"page_size":     pageSize,
	})
}

// CountUnread handles GET /api/v1/admin/notifications/unread-count
// (protected) — backs the sidebar bell badge.
func (h *NotificationHandler) CountUnread(w http.ResponseWriter, r *http.Request) {
	claims, ok := ClaimsFromContext(r.Context())
	if !ok {
		writeError(w, http.StatusUnauthorized, "missing or malformed authorization header")
		return
	}

	count, err := h.notifications.CountUnread(r.Context(), claims.BusinessID)
	if err != nil {
		writeError(w, http.StatusInternalServerError, "failed to count notifications")
		return
	}

	writeJSON(w, http.StatusOK, map[string]int{"unread_count": count})
}

// MarkRead handles PUT /api/v1/admin/notifications/{id}/read (protected).
func (h *NotificationHandler) MarkRead(w http.ResponseWriter, r *http.Request) {
	claims, ok := ClaimsFromContext(r.Context())
	if !ok {
		writeError(w, http.StatusUnauthorized, "missing or malformed authorization header")
		return
	}

	id, err := uuid.Parse(r.PathValue("id"))
	if err != nil {
		writeError(w, http.StatusBadRequest, "invalid notification id")
		return
	}

	if err := h.notifications.MarkRead(r.Context(), id, claims.BusinessID); handleUsecaseError(w, err) {
		return
	}

	w.WriteHeader(http.StatusNoContent)
}

// Delete handles DELETE /api/v1/admin/notifications/{id} (protected,
// notifications.manage) — permanently removes one notification.
func (h *NotificationHandler) Delete(w http.ResponseWriter, r *http.Request) {
	claims, ok := ClaimsFromContext(r.Context())
	if !ok {
		writeError(w, http.StatusUnauthorized, "missing or malformed authorization header")
		return
	}

	id, err := uuid.Parse(r.PathValue("id"))
	if err != nil {
		writeError(w, http.StatusBadRequest, "invalid notification id")
		return
	}

	if err := h.notifications.Delete(r.Context(), id, claims.BusinessID); handleUsecaseError(w, err) {
		return
	}

	w.WriteHeader(http.StatusNoContent)
}

// Clear handles DELETE /api/v1/admin/notifications (protected) — permanently
// removes every notification for the caller's business.
func (h *NotificationHandler) Clear(w http.ResponseWriter, r *http.Request) {
	claims, ok := ClaimsFromContext(r.Context())
	if !ok {
		writeError(w, http.StatusUnauthorized, "missing or malformed authorization header")
		return
	}

	if err := h.notifications.Clear(r.Context(), claims.BusinessID); err != nil {
		writeError(w, http.StatusInternalServerError, "failed to clear notifications")
		return
	}

	w.WriteHeader(http.StatusNoContent)
}

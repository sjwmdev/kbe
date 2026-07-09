package httpdelivery

import (
	"net/http"
	"time"

	"backend/internal/domain"
	"backend/internal/usecase"
)

type AuditLogHandler struct {
	audit *usecase.AuditLogUsecase
}

func NewAuditLogHandler(audit *usecase.AuditLogUsecase) *AuditLogHandler {
	return &AuditLogHandler{audit: audit}
}

type auditLogDTO struct {
	ID         string    `json:"id"`
	Username   string    `json:"username"`
	Method     string    `json:"method"`
	Path       string    `json:"path"`
	StatusCode int       `json:"status_code"`
	DurationMs int       `json:"duration_ms"`
	IPAddress  string    `json:"ip_address"`
	CreatedAt  time.Time `json:"created_at"`
}

func toAuditLogDTO(l domain.AuditLog) auditLogDTO {
	return auditLogDTO{
		ID:         l.ID.String(),
		Username:   l.Username,
		Method:     l.Method,
		Path:       l.Path,
		StatusCode: l.StatusCode,
		DurationMs: l.DurationMs,
		IPAddress:  l.IPAddress,
		CreatedAt:  l.CreatedAt,
	}
}

type paginatedAuditLogsResponse struct {
	Logs     []auditLogDTO `json:"logs"`
	Total    int           `json:"total"`
	Page     int           `json:"page"`
	PageSize int           `json:"page_size"`
}

// ListLogs handles GET /api/v1/admin/audit-logs (SuperAdmin only).
func (h *AuditLogHandler) ListLogs(w http.ResponseWriter, r *http.Request) {
	claims, ok := ClaimsFromContext(r.Context())
	if !ok {
		writeError(w, http.StatusUnauthorized, "missing or malformed authorization header")
		return
	}

	page, pageSize := parsePagination(r)

	logs, total, err := h.audit.List(r.Context(), claims.BusinessID, page, pageSize)
	if err != nil {
		writeError(w, http.StatusInternalServerError, "failed to fetch audit logs")
		return
	}

	dtos := make([]auditLogDTO, 0, len(logs))
	for _, l := range logs {
		dtos = append(dtos, toAuditLogDTO(l))
	}

	writeJSON(w, http.StatusOK, paginatedAuditLogsResponse{
		Logs:     dtos,
		Total:    total,
		Page:     page,
		PageSize: pageSize,
	})
}

// ClearLogs handles DELETE /api/v1/admin/audit-logs (SuperAdmin only).
func (h *AuditLogHandler) ClearLogs(w http.ResponseWriter, r *http.Request) {
	claims, ok := ClaimsFromContext(r.Context())
	if !ok {
		writeError(w, http.StatusUnauthorized, "missing or malformed authorization header")
		return
	}

	if err := h.audit.Clear(r.Context(), claims.BusinessID); err != nil {
		writeError(w, http.StatusInternalServerError, "failed to clear audit logs")
		return
	}

	w.WriteHeader(http.StatusNoContent)
}

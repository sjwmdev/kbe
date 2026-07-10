package httpdelivery

import (
	"net/http"

	"backend/internal/domain"
)

// MessageTemplateHandler exposes the code-defined message template catalog
// (see domain/message_template.go) so the admin UI can offer a template
// choice when preparing a message. Read-only by design — the catalog is
// fixed in code, same as the permission catalog.
type MessageTemplateHandler struct{}

func NewMessageTemplateHandler() *MessageTemplateHandler {
	return &MessageTemplateHandler{}
}

type messageTemplateDTO struct {
	Key          string   `json:"key"`
	Channel      string   `json:"channel"`
	Name         string   `json:"name"`
	Subject      string   `json:"subject"`
	Body         string   `json:"body"`
	Placeholders []string `json:"placeholders"`
}

// List handles GET /api/v1/admin/message-templates (protected,
// notifications.view — templates are part of preparing notifications/
// messages, so they share that permission rather than adding a new one).
func (h *MessageTemplateHandler) List(w http.ResponseWriter, r *http.Request) {
	dtos := make([]messageTemplateDTO, 0, len(domain.MessageTemplates))
	for _, t := range domain.MessageTemplates {
		dtos = append(dtos, messageTemplateDTO{
			Key:          t.Key,
			Channel:      t.Channel,
			Name:         t.Name,
			Subject:      t.Subject,
			Body:         t.Body,
			Placeholders: t.Placeholders,
		})
	}
	writeJSON(w, http.StatusOK, dtos)
}

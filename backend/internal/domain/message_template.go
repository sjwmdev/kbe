package domain

import "strings"

// Message template keys — one per (purpose, channel) pair.
const (
	TemplatePasswordResetEmail     = "password_reset_email"
	TemplatePasswordResetWhatsApp  = "password_reset_whatsapp"
	TemplatePasswordResetDashboard = "password_reset_dashboard"
	TemplateLowStockDashboard      = "low_stock_dashboard"
)

// MessageTemplate is one reusable system message with {placeholder} slots.
//
// The catalog is code-defined and shared by every business — the same
// deliberate choice as the permission catalog: the set of system messages
// is fixed by what the code can actually send, so a DB table would only
// add drift risk. Per-business editable wording is a future enhancement,
// not built now.
type MessageTemplate struct {
	Key          string
	Channel      string // one of the CommunicationChannel* constants
	Name         string // human label shown when the admin picks a template
	Subject      string // email subject line; empty for other channels
	Body         string
	Placeholders []string
}

// MessageTemplates is the full catalog, in display order.
var MessageTemplates = []MessageTemplate{
	{
		Key:     TemplatePasswordResetEmail,
		Channel: CommunicationChannelEmail,
		Name:    "Kuweka Upya Nenosiri (Barua Pepe)",
		Subject: "Nenosiri lako jipya la muda",
		Body: "Habari {user_name},\n\n" +
			"Ombi lako la kuweka upya nenosiri limekamilika. Nenosiri lako jipya la muda ni:\n\n" +
			"{temporary_password}\n\n" +
			"Ingia kupitia {login_url} ukitumia barua pepe yako ({email}) na nenosiri hili. " +
			"Utaombwa kuweka nenosiri jipya mara tu utakapoingia.\n\n" +
			"Kama hukuomba kubadilisha nenosiri, wasiliana na msimamizi mara moja.",
		Placeholders: []string{"user_name", "email", "temporary_password", "login_url"},
	},
	{
		Key:     TemplatePasswordResetWhatsApp,
		Channel: CommunicationChannelWhatsApp,
		Name:    "Kuweka Upya Nenosiri (WhatsApp)",
		Body: "Habari {user_name}, nenosiri lako jipya la muda ni: {temporary_password} — " +
			"ingia kupitia {login_url} kisha ubadilishe nenosiri mara moja.",
		Placeholders: []string{"user_name", "temporary_password", "login_url"},
	},
	{
		Key:     TemplatePasswordResetDashboard,
		Channel: CommunicationChannelDashboard,
		Name:    "Ombi la Kuweka Upya Nenosiri (Arifa)",
		Body:    "Password reset requested for {user_name} ({email}).",
		Placeholders: []string{
			"user_name", "email",
		},
	},
	{
		Key:          TemplateLowStockDashboard,
		Channel:      CommunicationChannelDashboard,
		Name:         "Stoo Ndogo (Arifa)",
		Body:         "Low stock alert: {product_name} has only {stock_quantity} items remaining.",
		Placeholders: []string{"product_name", "stock_quantity"},
	},
}

// FindMessageTemplate returns the template for key, or nil if unknown.
func FindMessageTemplate(key string) *MessageTemplate {
	for i := range MessageTemplates {
		if MessageTemplates[i].Key == key {
			return &MessageTemplates[i]
		}
	}
	return nil
}

// RenderMessageTemplate substitutes every {name} placeholder in body with
// its value from data. Unknown placeholders are left as-is so a missing
// value is visible rather than silently blank.
func RenderMessageTemplate(body string, data map[string]string) string {
	pairs := make([]string, 0, len(data)*2)
	for name, value := range data {
		pairs = append(pairs, "{"+name+"}", value)
	}
	return strings.NewReplacer(pairs...).Replace(body)
}

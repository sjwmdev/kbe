package domain

import "testing"

func TestRenderMessageTemplate(t *testing.T) {
	tmpl := FindMessageTemplate(TemplatePasswordResetWhatsApp)
	if tmpl == nil {
		t.Fatal("password_reset_whatsapp template missing from catalog")
	}

	got := RenderMessageTemplate(tmpl.Body, map[string]string{
		"user_name":          "Asha",
		"temporary_password": "Xy7!kQ2p",
		"login_url":          "http://localhost:5173/admin/login",
	})
	want := "Habari Asha, nenosiri lako jipya la muda ni: Xy7!kQ2p — " +
		"ingia kupitia http://localhost:5173/admin/login kisha ubadilishe nenosiri mara moja."
	if got != want {
		t.Errorf("rendered whatsapp template mismatch:\n got: %q\nwant: %q", got, want)
	}
}

func TestRenderMessageTemplateLowStockMatchesLegacyFormat(t *testing.T) {
	// The low-stock message format was verified end-to-end before templates
	// existed — rendering through the template must not change it.
	tmpl := FindMessageTemplate(TemplateLowStockDashboard)
	got := RenderMessageTemplate(tmpl.Body, map[string]string{
		"product_name":   "Minimal Leather Handbag",
		"stock_quantity": "3",
	})
	want := "Low stock alert: Minimal Leather Handbag has only 3 items remaining."
	if got != want {
		t.Errorf("low stock render = %q, want %q", got, want)
	}
}

func TestRenderMessageTemplateLeavesUnknownPlaceholders(t *testing.T) {
	got := RenderMessageTemplate("Hi {user_name}, code {missing}", map[string]string{"user_name": "Asha"})
	if got != "Hi Asha, code {missing}" {
		t.Errorf("unknown placeholder should stay visible, got %q", got)
	}
}

func TestFindMessageTemplateUnknownKey(t *testing.T) {
	if FindMessageTemplate("nope") != nil {
		t.Error("unknown key should return nil")
	}
}

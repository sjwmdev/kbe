package usecase

import "github.com/microcosm-cc/bluemonday"

// descriptionPolicy is the allowlist for product descriptions written
// through the admin WYSIWYG editor — sanitized once here on write (not
// re-sanitized on every read), so anything stored is already safe to render
// with dangerouslySetInnerHTML on the frontend.
var descriptionPolicy = newDescriptionPolicy()

func newDescriptionPolicy() *bluemonday.Policy {
	p := bluemonday.NewPolicy()

	p.AllowElements("p", "br", "div", "span")
	p.AllowElements("b", "strong", "i", "em", "u")
	p.AllowElements("h1", "h2", "h3", "h4", "h5", "h6")
	p.AllowElements("ul", "ol", "li")
	p.AllowElements("table", "thead", "tbody", "tr", "td", "th")

	p.AllowStandardURLs()
	p.AllowAttrs("href").OnElements("a")
	p.AllowElements("a")
	p.RequireNoFollowOnLinks(true)
	p.AddTargetBlankToFullyQualifiedLinks(true)

	// Text color and alignment, applied by the editor as inline styles —
	// the only style properties allowed, everything else is stripped.
	p.AllowAttrs("style").OnElements("span", "p", "div", "h1", "h2", "h3", "h4", "h5", "h6")
	p.AllowStyles("color", "text-align").Globally()

	return p
}

// SanitizeDescriptionHTML strips anything not on descriptionPolicy's
// allowlist (scripts, event handlers, iframes, etc.) before a product
// description is stored.
func SanitizeDescriptionHTML(html string) string {
	return descriptionPolicy.Sanitize(html)
}

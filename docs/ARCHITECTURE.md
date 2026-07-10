# Kalour Beauty Empire — Architecture & Developer Guide

This document explains what the project is, how it is built, and the
conventions every change must follow. It is written so a new developer or an
AI agent can pick up any task and produce work that is indistinguishable in
style, structure, and quality from the existing code.

---

## 1. What the project is

Kalour Beauty Empire is a **multi-tenant e-commerce platform** with two faces:

1. **Public storefront** (Swahili-first): product catalog with category /
   color / price filtering, product detail pages with image galleries and
   likes, hero slider, and static pages (About, Contact, Privacy, Terms).
   There are **no customer accounts** — sales are negotiated over WhatsApp;
   every product CTA builds a prefilled `wa.me` link to the business number.
2. **Admin dashboard** (`/admin`): products (with stock and WYSIWYG
   descriptions), categories, orders (recording WhatsApp-negotiated sales),
   customers (implicit, created per order), media library, sliders, static
   pages, site settings/branding, users, roles/permissions (RBAC),
   notifications, audit logs, and a KPI dashboard.

**Multi-tenancy:** every business (tenant) has fully isolated data. The
storefront serves one business chosen by `DEFAULT_BUSINESS_SLUG`; the admin
dashboard scopes everything to the business in the caller's JWT. New tenants
are provisioned by the platform operator with a CLI, never via public signup.

**Language:** all user-facing text (storefront and admin) is **Swahili**.
Code, comments, commit messages, and API error strings are English.

---

## 2. Tech stack

| Layer     | Technology |
|-----------|------------|
| Backend   | Go 1.22+ (stdlib `net/http` with method+path pattern routing — no framework), pgx/v5, bcrypt, HS256 JWT, bluemonday (HTML sanitizing) |
| Database  | PostgreSQL 16, plain-SQL migrations (numbered up/down files) |
| Frontend  | React 19 + TypeScript (strict) + Vite, Tailwind CSS v4 (`@theme` tokens), React Router v7, lucide-react icons |
| Fonts     | Plus Jakarta Sans (Google Fonts) |
| Tooling   | `go vet`, `gofmt`, `tsc --noEmit`, `oxlint`, `npm run build` |

There is deliberately **no** ORM, no CSS-in-JS, no state-management library,
no heavyweight editor/component frameworks. Before adding a dependency, check
whether the stdlib/browser already covers it (e.g. the WYSIWYG editor is a
`contentEditable` + `execCommand` component, not TipTap).

---

## 3. Repository layout

```
kbe/
├── backend/
│   ├── cmd/
│   │   ├── api/                  # HTTP server entrypoint + env wiring
│   │   ├── seed/                 # one-off: bootstrap first admin user
│   │   └── provision-business/   # one-off: create a new tenant (CLI, not HTTP)
│   ├── internal/
│   │   ├── domain/               # entities, constants, repository interfaces (ports)
│   │   ├── repository/           # pgx implementations of the ports (SQL lives here)
│   │   ├── usecase/              # business rules, validation, permission-aware logic
│   │   └── delivery/http/        # handlers (DTOs), router, middleware, JWT
│   ├── migrations/               # NNNN_name.up.sql / .down.sql, applied in order
│   └── uploads/                  # runtime-uploaded images (gitignored)
├── frontend/
│   └── src/
│       ├── components/           # shared UI (storefront + generic)
│       │   ├── admin/            # dashboard-only components
│       │   └── home/             # storefront homepage components
│       ├── context/              # Auth, Toast, Confirm, Theme, Settings providers
│       ├── lib/                  # api.ts (all fetch calls), format, whatsapp, etc.
│       ├── pages/                # storefront pages
│       │   └── admin/            # dashboard pages
│       ├── types/                # TS interfaces mirroring backend DTOs
│       ├── App.tsx               # all routes (admin pages lazy-loaded)
│       └── index.css             # design tokens + global typography rules
└── docs/                         # planning docs, this file, DEPLOYMENT.md
```

---

## 4. Backend architecture (Clean Architecture)

Dependency direction is strictly inward: `delivery → usecase → domain ←
repository`. The domain layer imports nothing from the other layers.

- **domain/** — structs (`Product`, `Order`, `User`, `Notification`, …),
  domain constants (order statuses, notification categories, communication
  channels, message templates, product colors), sentinel errors
  (`ErrNotFound`, `ErrForbidden`, `ErrValidation` wrappers…), and one
  interface per repository (the ports). Filter argument structs
  (`ProductFilter`, `NotificationFilter`) also live here.
- **repository/** — pgx implementations. All SQL is here and nowhere else.
  Every query on a tenant-owned table filters `WHERE business_id = $1`
  **unconditionally** — see §6.
- **usecase/** — input structs with `Validate()` methods, business rules
  (stock checks, last-SuperAdmin guard, notification dedup), and
  orchestration. Usecases depend only on domain interfaces, never on pgx.
- **delivery/http/** — one handler file per module. Handlers: parse/validate
  the request shape, resolve `Claims` from context, call one usecase method,
  map the result to a JSON DTO. No business logic. `router.go` declares every
  route with an explicit middleware chain; `middleware.go` holds
  `RequireAuth`, `RequirePermission` (variadic any-of), `RequireSuperAdmin`,
  `RequirePasswordChanged`, `AuditLog`, CORS, and panic recovery.

**Error convention:** usecases return wrapped sentinel errors
(`fmt.Errorf("%w: message", ErrValidation)`); the shared
`handleUsecaseError` in delivery maps them to status codes (validation → 400,
not found → 404, forbidden → 403, conflict cases → 409). Handlers write
errors only via `writeError(w, status, msg)` — never `panic`, never raw
`http.Error`.

### API shape

- Base: `/api/v1`. Public routes: products list/detail/like, categories,
  settings, sliders, static pages, admin login, forgot-password.
- Admin routes: `/api/v1/admin/...`, JWT bearer auth, each wrapped in one of:
  - `protect(permissionKey, handler)` — the standard chain
    (auth → audit-log → password-changed gate → permission check),
  - `protectAny(handler, keys...)` — same, passes on any of several keys,
  - `selfServiceGated(handler)` — authenticated only (profile, dashboard
    summary, notifications read, category name list),
  - `superAdminOnly(handler)` — hard role-name check (audit logs only).
- Lists are paginated with `?page=&page_size=` and respond
  `{items..., total, page, page_size}`. Optional filters are query params.
- Mutations are audit-logged automatically by the `AuditLog` middleware.

---

## 5. Frontend architecture

- **Single API module:** every HTTP call lives in `src/lib/api.ts` as a typed
  function built on a shared `request()` helper that raises `ApiError`
  (carrying `status` and backend `code`). Components never call `fetch`
  directly.
- **Contexts:** `AuthContext` (token in localStorage; profile, permissions,
  `hasPermission(key)`, `mustChangePassword`, login/logout/applySession),
  `ToastContext` (`toast.success/error/promise`), `ConfirmContext`
  (`await confirm({title, message, confirmLabel})` promise-based modal),
  `ThemeContext` (manual `.dark` class on `<html>`, light default),
  `SettingsContext` (tenant branding: applies CSS variables +
  `document.title` at runtime).
- **Routing:** all routes in `App.tsx`. Admin pages are `lazy()`-loaded.
  `ProtectedRoute` redirects unauthenticated users to `/admin/login`.
- **Types:** `src/types/*.ts` mirror backend DTOs 1:1 (snake_case fields).
  Label maps for enums live next to the type
  (`NOTIFICATION_CATEGORY_LABELS`, `COMMUNICATION_CHANNEL_LABELS`, …) — when
  rendering enum-ish values, always go through a label map with a fallback,
  never switch statements in JSX.

### Standard page anatomy (admin list page)

Every admin list page follows the same skeleton — copy an existing page
(e.g. `UsersPage.tsx`, `NotificationsPage.tsx`) rather than inventing:

1. State: `items`, `total`, `page`, filter states, `loading` (first load),
   optional `refreshing` (later refetches keep rows visible and dim them).
2. One `useEffect` fetch keyed on `[token, page, filters, refreshKey]` with a
   `cancelled` flag; 401 → toast + `logout()`; other errors → Swahili toast.
3. Render order: header row (title + primary action button) → filters →
   empty-state paragraph → table in
   `overflow-hidden rounded-2xl border border-line shadow-card` → pagination
   footer.
4. Loading: `Skeleton` rows on first load only. Never swap a populated table
   back to skeletons on refetch.
5. Row actions through `ActionMenu` (portal-based three-dot menu), items
   filtered by `hasPermission(...)`.
6. Destructive actions: `await confirm(...)` first, then
   `toast.promise(apiCall, {loading, success, error})`.

### Permissions in the UI

`hasPermission("module.action")` gates nav items, buttons, and menu entries.
This is **cosmetic only** — the real enforcement is the backend route/usecase
gating. Any new feature must add both sides.

---

## 6. Multi-tenancy & security model

- `businesses` table is the tenant root. Every tenant-owned table carries
  `business_id` (FK, NOT NULL, indexed).
- JWT claims carry `UserID`, `RoleID`, `BusinessID`, `MustChangePassword`.
- **The governing rule:** SuperAdmin bypass only ever means "no `created_by`
  ownership filter *within the business*" — **never** "no `business_id`
  filter". Every repository query on tenant data filters by `business_id`
  unconditionally, for every role.
- Roles are per-business (`UNIQUE(business_id, name)`); the ~30-key
  permission catalog is global and code/migration-defined. Role lookups
  always pass `(roleID, businessID)` so a foreign-business role resolves to
  "no permissions" automatically.
- Login is global-email (emails and usernames are unique system-wide).
  Brute-force lockout after 5 failures (15 min). Passwords: bcrypt.
  Temporary passwords (`crypto/rand`, 12 chars) are returned exactly once
  and force a change on next login (`RequirePasswordChanged` middleware
  blocks everything else until then).
- Forgot-password is **admin-handled**: an anonymous request raises a
  dashboard notification (deduped, anti-enumeration response); an admin with
  `users.resetPassword` generates the temp password and sends it via the
  message-template system (email/WhatsApp copy or wa.me deep link).
- Product description HTML is sanitized server-side (bluemonday allowlist)
  on write; the frontend trusts stored HTML on read.
- Audit log records every admin mutation (method, path, status, duration,
  user) plus logins; viewing it is strictly SuperAdmin.

---

## 7. Database & migrations

- Migrations are hand-written SQL in `backend/migrations/`, numbered
  `NNNN_name.up.sql` / `.down.sql`, applied in order with `psql -f` (no
  migration tool). Latest as of this writing: `0021`.
- Convention for schema changes on live tables: add nullable → backfill →
  `SET NOT NULL` (see 0011/0012), and drop old columns one release later.
- Key tables: `businesses`, `users`, `roles`, `permissions`,
  `role_permissions`, `categories`, `products` (+ `product_images`,
  `product_likes`), `customers`, `orders`, `order_items` (FK `RESTRICT` on
  product — hard-deleting a sold product is refused), `notifications`,
  `media_folders`/`media_assets`, `slider_posters`, `site_settings` (one row
  per business), `static_pages` (PK `(business_id, slug)`), `audit_logs`.
- Stock decrements are race-safe:
  `UPDATE ... SET stock_quantity = stock_quantity - $1 WHERE id = $2 AND
  stock_quantity >= $1` + `RowsAffected()` check.
- Notifications dedup via partial index on unresolved
  `(business_id, category, reference_id)`.

---

## 8. Design system (UI)

All tokens live in `frontend/src/index.css` under `@theme` (Tailwind v4) and
are overridden by the `.dark` block. **Never hardcode colors in components**
— use the semantic utilities:

| Token / utility | Light | Dark | Use |
|---|---|---|---|
| `bg-page` | `#f7f8fa` | `#0b0b0d` | app canvas |
| `bg-surface` | `#ffffff` | `#17171a` | cards, tables, modals |
| `bg-surface-hover` | `#f1f3f6` | `#222226` | hovers, input fills |
| `text-ink` | `#0d1626` | `#f7f8fa` | primary text |
| `text-ink-muted` | `#3f4a5c` | `#b3b9c4` | secondary text |
| `border-line` | `#e3e6eb` | `#2c2c31` | all borders |
| `brand-accent` / `-dark` | `#b80049` / `#8f003d` | same | CTAs, active states, small accents only — never large surfaces |
| `text-icon` | brand pink | white | decorative icons |
| `shadow-card` | soft 2-layer | deeper | card/table elevation |

Typography: Plus Jakarta Sans; body tracking `-0.01em`; headings `-0.02em` +
`text-wrap: balance`; tables get `tabular-nums`; `thead th` is globally
uppercase 0.72rem with `+0.06em` tracking. Page titles:
`text-2xl font-extrabold text-ink`; section titles: `text-lg font-bold`;
buttons: `font-bold`/`font-semibold`.

Recurring shapes: primary buttons are pill
(`rounded-full bg-brand-accent px-5 py-2.5 text-sm font-bold text-white
hover:bg-brand-accent-dark`), secondary are pill with `border-line` border;
cards/tables `rounded-xl`/`rounded-2xl border border-line bg-surface
shadow-card`; inputs `rounded-lg border-line bg-surface-hover
focus:border-brand-accent` (no heavy focus rings); modals are centered with
`bg-black/50` backdrop + `modal-pop-in` keyframe; dropdowns/popovers render
through **portals with fixed positioning** clamped to the viewport (see
`ActionMenu.tsx` — never absolute-position a popup inside an
`overflow-hidden` container).

Status colors go through `StatusBadge` + `statusTone.ts`
(success/warning/neutral/danger) — no ad-hoc greens/reds.

---

## 9. Message templates & notifications

- Notification categories: `low_stock`, `password_reset_request`, `system`,
  `order`, `user`. Table is generic; new categories need only a domain
  constant.
- Lifecycle: created (unread/unresolved) → `MarkRead` (also resolves) or
  resolved by the action that satisfies it (e.g. password reset). Dedup: one
  unresolved notification per (category, reference).
- Message templates are a **code-defined catalog**
  (`domain/message_template.go`) with `{placeholder}` rendering, mirroring
  the permission catalog's philosophy — the set of system messages is fixed
  by what the code can send. `RenderMessageTemplate` leaves unknown
  placeholders visible. Unit-tested.

---

## 10. Coding standards

**Go**
- `gofmt` clean, `go vet` clean, build must pass — always run all three.
- Comments explain *why* and document invariants (see the tenancy comments
  in repositories); no narrating-the-obvious comments.
- New module = domain interface + repository impl + usecase + handler +
  explicit routes + migration if schema changes. Follow an existing module
  (notifications is the smallest complete example).

**TypeScript/React**
- `npx tsc --noEmit`, `oxlint`, `npm run build` must pass.
- Function components only; hooks + contexts; no classes, no default exports.
- All user-facing strings in Swahili; keep the tone consistent with existing
  copy ("Imeshindwa ku...", "Una uhakika...").
- Fetch → `lib/api.ts` only. Types → `src/types`. New enum labels → label map.

**Both**
- Backend enforcement first, UI gating second — a permission that is only
  hidden client-side is a bug.
- Test evidence over assumption: exercise the changed flow (curl and/or
  browser) before calling it done.
- Commit messages: lowercase short title + explanatory body.

---

## 11. Local development

```sh
# database (PostgreSQL 16 running locally)
psql "postgres://postgres:postgres@localhost:5432/kbe" -f backend/migrations/0001_....up.sql   # each, in order

# backend
cd backend && cp .env.example .env   # edit values
go run ./cmd/api                     # :8080

# first-run bootstrap (once): seed the first admin user
BUSINESS_SLUG=kalour ADMIN_EMAIL=... ADMIN_USERNAME=... ADMIN_PASSWORD=... go run ./cmd/seed

# frontend
cd frontend && npm install && npm run dev   # :5173

# checks
cd backend && go build ./... && go vet ./... && gofmt -l . && go test ./...
cd frontend && npx tsc --noEmit -p tsconfig.app.json && npm run lint && npm run build
```

New tenant: `BUSINESS_NAME=... BUSINESS_SLUG=... ADMIN_EMAIL=...
ADMIN_USERNAME=... ADMIN_PASSWORD=... go run ./cmd/provision-business`.

Deployment: see [DEPLOYMENT.md](DEPLOYMENT.md).

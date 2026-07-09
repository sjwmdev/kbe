# Real Order & Inventory Tracking + Dashboard Redesign

## Context

The user shared a reference dashboard mockup (Total Sales / Total Orders /
Active Customers KPI cards, a compact "Recent Product Performance" table with
stock-status badges, a top-right "+ New Product" button) and asked for the
admin "Muhtasari" (Dashboard) page to match it.

Kalour Beauty Empire has no cart/checkout — sales are negotiated over
WhatsApp outside the app. Today's backend tracks nothing needed for that
mockup: no `orders` table, no customer records, no stock-quantity field on
products (only `is_active` as a visibility toggle) and no way to compute
"units sold". Asked the user directly whether to (a) restyle the dashboard
using only real, existing data, (b) build real order/inventory tracking, or
(c) use placeholder numbers. **They chose (b)**: build the real thing. This
plan adds a manual order-entry system (staff record a sale after a WhatsApp
deal closes), a stock-quantity field on products, and a redesigned dashboard
driven by that real data.

Explored and confirmed reusable conventions (all from the existing
codebase, not invented): the `COUNT(*) OVER()` single-round-trip pagination
pattern (`product_repository.go`), the ownership model `CreatedBy
*uuid.UUID` + `isSuperAdmin bool` used throughout `ProductUsecase`/
`ProductHandler`, the pgx transaction pattern already used in
`role_repository.go` (`pool.Begin` / `defer tx.Rollback` / `tx.Commit`), the
RBAC permission-catalog seeding in `migrations/0004_rbac.up.sql` plus the
`MODULE_LABELS`/`MODULE_ORDER` maps in `RolePermissionsPanel.tsx`, and the
frontend `StatusBadge`/`statusTone.ts` pill pattern. Latest migration is
`0007_audit_logs`, so this is `0008_orders`.

## Design decisions

- **Stock model**: add `stock_quantity` + `low_stock_threshold` directly to
  `products` (not a separate table — it's a single scalar per product, same
  reasoning as `is_active`). `domain.Product` gets a `StockStatus() string`
  method (`"out_of_stock" | "low_stock" | "in_stock"`) as the single source
  of truth, mirroring `Role.IsSuperAdmin()`'s pattern — reused by both the
  Products table and the dashboard's product-performance table.
- **Stock movement**: recording an order decrements each line item's product
  stock immediately (the WhatsApp deal is already closed by the time staff
  enter it); cancelling an order restocks the quantities. Both happen inside
  one pgx transaction alongside the order/order_items insert, so a crash
  mid-write can never desync stock from orders.
- **Orders have no `delete` permission** — unlike products/roles/users,
  orders are historical records. The equivalent of "removing" one is
  transitioning its status to `cancelled` (which restocks), gated by
  `orders.edit`. Documented here so this isn't mistaken for an inconsistency
  with the other CRUD modules.
- **Customers are not a standalone CRUD page** — a customer is
  found-or-created by phone number at order-creation time
  (`CustomerRepository.FindOrCreateByPhone`). No separate `customers.*`
  permission module; visible only via the Orders page and the dashboard's
  "Active Customers" KPI. Scope stays tight to what was actually asked for.
- **Ownership scoping matches Products exactly**: orders get `created_by`;
  non-SuperAdmin staff see only their own orders, SuperAdmin sees all — same
  `createdBy *uuid.UUID` / `isSuperAdmin bool` idiom already used everywhere
  else, no new authorization concept introduced.
- **Dashboard summary has no permission gate** — the "Muhtasari" nav item
  itself has always been visible to every authenticated role with no
  permission key (see `navItems` in `AdminLayout.tsx`), so its data endpoint
  uses the same `selfServiceGated` chain (authenticated + password-changed),
  not a new permission.
- **Windows for the KPIs**: "Total Sales" / "Total Orders" = sum/count over
  the last 30 days (non-cancelled orders only), trend % vs. the preceding
  30-day window. "Active Customers" = distinct customers with ≥1 non-cancelled
  order in the last 30 days, same trend comparison. "Recent Product
  Performance" = top 5 products by units sold in the last 30 days. One
  endpoint returns everything the page needs in a single fetch, matching the
  old page's one-call simplicity.

## Backend

**Migration `backend/migrations/0008_orders.up.sql` / `.down.sql`**
```sql
ALTER TABLE products ADD COLUMN stock_quantity INT NOT NULL DEFAULT 0;
ALTER TABLE products ADD COLUMN low_stock_threshold INT NOT NULL DEFAULT 5;

CREATE TABLE customers (
    id         UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    name       VARCHAR(255) NOT NULL,
    phone      VARCHAR(32) NOT NULL UNIQUE,
    created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE orders (
    id           UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    customer_id  UUID NOT NULL REFERENCES customers(id),
    status       VARCHAR(20) NOT NULL DEFAULT 'pending'
                 CHECK (status IN ('pending','confirmed','delivered','cancelled')),
    total_amount DECIMAL(12,2) NOT NULL,
    created_by   UUID REFERENCES users(id) ON DELETE SET NULL,
    created_at   TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at   TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE order_items (
    id         UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    order_id   UUID NOT NULL REFERENCES orders(id) ON DELETE CASCADE,
    product_id UUID NOT NULL REFERENCES products(id),
    quantity   INT NOT NULL CHECK (quantity > 0),
    unit_price DECIMAL(10,2) NOT NULL
);

CREATE INDEX idx_orders_created_at ON orders (created_at DESC);
CREATE INDEX idx_order_items_order_id ON order_items (order_id);
CREATE INDEX idx_order_items_product_id ON order_items (product_id);
```
`unit_price` is snapshotted per line item (not joined live from `products`)
so historical order totals stay correct if a product's price changes later
— same reasoning as `audit_logs.username` being a denormalized snapshot.

**Domain** (`internal/domain/`)
- `product.go`: add `StockQuantity`, `LowStockThreshold int` fields; add
  `func (p Product) StockStatus() string`.
- `customer.go` (new): `Customer{ID, Name, Phone, CreatedAt}`.
- `order.go` (new): `OrderStatus` string type + consts
  (`OrderPending/Confirmed/Delivered/Cancelled`); `OrderItem{ID, ProductID,
  ProductName, Quantity, UnitPrice}`; `Order{ID, Customer Customer, Status,
  TotalAmount, Items []OrderItem, CreatedBy *uuid.UUID, CreatedAt, UpdatedAt}`.
- `repository.go`: add `CustomerRepository` (`FindOrCreateByPhone(ctx, name,
  phone string) (*Customer, error)`, `CountActiveSince(ctx, since
  time.Time) (int, error)`) and `OrderRepository` (`Create(ctx, order
  *Order) (*Order, error)` — transactional, inserts order+items, decrements
  product stock; `List(ctx, createdBy *uuid.UUID, page, pageSize int)
  ([]Order, int, error)`; `UpdateStatus(ctx, id uuid.UUID, status
  OrderStatus, callerID uuid.UUID, isSuperAdmin bool) (*Order, error)` —
  restocks items when transitioning to `cancelled`; `SummaryStats(ctx,
  createdBy *uuid.UUID, since, until time.Time) (sales float64, orders int,
  err error)`; `TopProductPerformance(ctx, createdBy *uuid.UUID, since
  time.Time, limit int) ([]ProductPerformance, error)`).

**Repository** (`internal/repository/`)
- `customer_repository.go`: `FindOrCreateByPhone` does a `SELECT` then
  `INSERT ... ON CONFLICT (phone) DO UPDATE SET name = EXCLUDED.name
  RETURNING *` (keeps the latest name on repeat customers); `CountActiveSince`
  is a `COUNT(DISTINCT customer_id)` join against non-cancelled orders.
- `order_repository.go`: `Create` uses `pool.Begin`/`defer tx.Rollback`/
  `tx.Exec` per item + `UPDATE products SET stock_quantity = stock_quantity
  - $1 WHERE id = $2`/`tx.Commit`, mirroring `role_repository.go`'s
  `SetPermissions`. `List` follows the exact `COUNT(*) OVER()` +
  conditional `WHERE created_by = $1` pattern from `product_repository.go`.
  `SummaryStats`/`TopProductPerformance` are straightforward aggregate SQL
  scoped by the same optional `created_by` filter.

**Usecase** (`internal/usecase/order_usecase.go`, new)
- Composes `OrderRepository`, `CustomerRepository`, `ProductRepository` (to
  validate each product exists, belongs to the caller unless SuperAdmin, and
  has enough stock before committing — returns `ErrValidation` otherwise,
  same error convention as `ProductUsecase`).
- `Create(ctx, in OrderInput, createdBy uuid.UUID) (*Order, error)`,
  `List(ctx, createdBy *uuid.UUID, page, pageSize) (...)`,
  `UpdateStatus(ctx, id, status, callerID, isSuperAdmin) (*Order, error)`,
  `DashboardSummary(ctx, createdBy *uuid.UUID) (DashboardSummary, error)` —
  computes both 30-day windows and calls `SummaryStats` twice (current vs.
  prior) plus `TopProductPerformance` once, assembling the trend
  percentages (`nil`/omitted when the prior window was zero, to avoid a
  divide-by-zero "infinite%" figure).

**Delivery** (`internal/delivery/http/`)
- `order_handler.go` (new): `List`, `Create`, `UpdateStatus` — same shape as
  `product_handler.go` (DTOs, `parsePagination`, `handleUsecaseError`).
- `dashboard_handler.go` (new): `GetSummary` — calls
  `OrderUsecase.DashboardSummary`, scoped by caller ownership exactly like
  `ProductHandler.isSuperAdmin`/`createdBy` today.
- `router.go`: add permissions `orders.view`, `orders.create`, `orders.edit`
  to the seed migration and:
  ```go
  mux.Handle("GET /api/v1/admin/orders", protect("orders.view", deps.OrderHandler.List))
  mux.Handle("POST /api/v1/admin/orders", protect("orders.create", deps.OrderHandler.Create))
  mux.Handle("PUT /api/v1/admin/orders/{id}/status", protect("orders.edit", deps.OrderHandler.UpdateStatus))
  mux.Handle("GET /api/v1/admin/dashboard/summary", selfServiceGated(deps.DashboardHandler.GetSummary))
  ```
- `cmd/api/main.go`: wire the two new repos, `OrderUsecase`, the two new
  handlers, add them to `RouterDeps`.

## Frontend

- `lib/statusTone.ts`: add a 4th tone, `"warning"` (amber,
  `bg-amber-100 text-amber-700 dark:bg-amber-500/15 dark:text-amber-400`) —
  needed so "Low Stock" reads distinctly from "Out of Stock" (danger/red).
- `types/product.ts`: add `stock_quantity`, `low_stock_threshold`,
  `stock_status` to the `Product` type.
- `types/order.ts` (new): `Order`, `OrderItem`, `OrderStatus`,
  `DashboardSummary` (`total_sales`, `total_sales_trend_pct`,
  `total_orders`, `total_orders_trend_pct`, `active_customers`,
  `active_customers_trend_pct`, `product_performance: ProductPerformance[]`).
- `lib/api.ts`: `fetchOrders`, `createOrder`, `updateOrderStatus`,
  `fetchDashboardSummary` — same `Bearer` header / `ApiError` conventions as
  every existing call.
- `pages/admin/ProductFormPage.tsx`: add "Kiasi Stoo" (stock quantity) and
  "Kiwango cha Chini" (low-stock threshold) number inputs next to the
  existing price field.
- `pages/admin/ProductsPage.tsx`: add a stock-status `StatusBadge` column
  (success/warning/danger for in/low/out of stock) next to the existing
  active/hidden badge.
- `pages/admin/OrdersPage.tsx` (new): list page mirroring
  `ProductsPage.tsx`'s exact structure (skeleton, prev/next pagination,
  `hasPermission` gating) — columns Mteja / Bidhaa (item summary) / Jumla /
  Hali (status badge) / Tarehe, with an inline status `<select>` in the
  Actions column gated by `orders.edit`.
- `pages/admin/OrderFormPage.tsx` (new): customer name/phone inputs plus a
  dynamic line-item list (product `<select>` + quantity, add/remove rows,
  live-computed subtotal and total), gated by `orders.create`.
- `components/admin/RolePermissionsPanel.tsx`: add `orders: "Oda"` to
  `MODULE_LABELS` and to `MODULE_ORDER`.
- `components/admin/AdminLayout.tsx`: new nav entry "Oda" (ShoppingCart
  icon) under the existing `contentNavItems`-style grouping, gated by
  `hasPermission("orders.view")`.
- `App.tsx`: two new lazy routes for `OrdersPage`/`OrderFormPage`.
- `pages/admin/DashboardPage.tsx` (rewritten): header row gets a right-aligned
  "+ Ongeza Bidhaa" button (replacing today's 3rd stat-card CTA); three KPI
  cards — Mauzo Yote (Total Sales, `formatPrice`), Oda Zote (Total Orders),
  Wateja Amilifu (Active Customers) — each with a small ↑/↓ trend line reused
  across all three (green up / red down / neutral "Bila mabadiliko" when the
  prior window was zero); "Utendaji wa Bidhaa Hivi Karibuni" compact table
  (Bidhaa / Kundi / Idadi Iliyouzwa / Hali) replacing the old "most liked"
  list. Single fetch via `fetchDashboardSummary`.

## Verification

1. Apply the migration; `go build ./...`, `gofmt -l .`, `go vet ./...`,
   `npm run build`, `npm run lint` — all clean.
2. curl: create a product with `stock_quantity: 10`; create an order for 3
   units and confirm the product's stock drops to 7 and `total_amount` is
   correct; cancel the order and confirm stock returns to 10; confirm a
   Manager token can only see/edit their own orders while SuperAdmin sees
   all; hit `GET /admin/dashboard/summary` and confirm sales/orders/customer
   counts match what was just created.
3. Browser: log in, confirm the redesigned Dashboard shows real KPI numbers
   and the product-performance table with correct stock-status badges;
   create an order via the new Orders page end-to-end and watch the
   dashboard numbers update on refresh; confirm a role without
   `orders.view` never sees the "Oda" nav item; check both light and dark
   mode for the new page and badges.
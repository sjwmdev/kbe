package repository

import (
	"context"
	"errors"
	"fmt"
	"time"

	"github.com/google/uuid"
	"github.com/jackc/pgx/v5"
	"github.com/jackc/pgx/v5/pgxpool"

	"backend/internal/domain"
)

type orderRepository struct {
	pool *pgxpool.Pool
}

func NewOrderRepository(pool *pgxpool.Pool) domain.OrderRepository {
	return &orderRepository{pool: pool}
}

// Create inserts the order and its items and decrements each item's product
// stock, all within one transaction — a crash mid-write can never leave
// stock desynced from a recorded sale.
func (r *orderRepository) Create(ctx context.Context, order *domain.Order) (*domain.Order, error) {
	tx, err := r.pool.Begin(ctx)
	if err != nil {
		return nil, fmt.Errorf("repository: begin create order tx: %w", err)
	}
	defer tx.Rollback(ctx)

	const insertOrder = `
		INSERT INTO orders (business_id, customer_id, status, total_amount, created_by)
		VALUES ($1, $2, $3, $4, $5)
		RETURNING id, created_at, updated_at`
	if err := tx.QueryRow(ctx, insertOrder, order.BusinessID, order.Customer.ID, order.Status, order.TotalAmount, order.CreatedBy).
		Scan(&order.ID, &order.CreatedAt, &order.UpdatedAt); err != nil {
		return nil, fmt.Errorf("repository: insert order: %w", err)
	}

	const insertItem = `
		INSERT INTO order_items (order_id, product_id, quantity, unit_price)
		VALUES ($1, $2, $3, $4)
		RETURNING id`
	// The stock_quantity >= $1 guard makes this decrement atomic against
	// concurrent orders for the same product — the usecase already checked
	// stock before starting this transaction, but that check-then-act gap is
	// exactly where two simultaneous orders could otherwise both pass and
	// both decrement, driving stock negative. If another order wins the
	// race, this UPDATE affects zero rows and callers see ErrInsufficientStock.
	const decrementStock = `UPDATE products SET stock_quantity = stock_quantity - $1 WHERE id = $2 AND stock_quantity >= $1`

	for i := range order.Items {
		item := &order.Items[i]
		if err := tx.QueryRow(ctx, insertItem, order.ID, item.ProductID, item.Quantity, item.UnitPrice).Scan(&item.ID); err != nil {
			return nil, fmt.Errorf("repository: insert order item: %w", err)
		}
		tag, err := tx.Exec(ctx, decrementStock, item.Quantity, item.ProductID)
		if err != nil {
			return nil, fmt.Errorf("repository: decrement product stock: %w", err)
		}
		if tag.RowsAffected() == 0 {
			return nil, fmt.Errorf("repository: decrement product stock for %s: %w", item.ProductName, domain.ErrInsufficientStock)
		}
	}

	if err := tx.Commit(ctx); err != nil {
		return nil, fmt.Errorf("repository: commit create order tx: %w", err)
	}

	return order, nil
}

// List returns one page of orders (newest first) plus the total matching
// count via the same COUNT(*) OVER() pattern as ProductRepository.FindAll.
// Always scoped to businessID; createdBy nil means no additional ownership
// filter within that business. Items aren't joined here (a one-to-many join
// would multiply order rows); they're fetched in one follow-up batch query
// keyed by the returned order IDs, then grouped in Go — one extra round trip
// total, not one per order.
func (r *orderRepository) List(ctx context.Context, businessID uuid.UUID, createdBy *uuid.UUID, page, pageSize int) ([]domain.Order, int, error) {
	if page < 1 {
		page = 1
	}
	if pageSize < 1 {
		pageSize = 20
	}
	offset := (page - 1) * pageSize

	query := `
		SELECT o.id, o.business_id, o.status, o.total_amount, o.created_by, o.created_at, o.updated_at,
			c.id, c.name, c.phone, c.created_at,
			COUNT(*) OVER()
		FROM orders o
		JOIN customers c ON c.id = o.customer_id
		WHERE o.business_id = $1`

	args := make([]any, 1, 3)
	args[0] = businessID
	if createdBy != nil {
		args = append(args, *createdBy)
		query += fmt.Sprintf(` AND o.created_by = $%d`, len(args))
	}
	query += fmt.Sprintf(` ORDER BY o.created_at DESC LIMIT $%d OFFSET $%d`, len(args)+1, len(args)+2)
	args = append(args, pageSize, offset)

	rows, err := r.pool.Query(ctx, query, args...)
	if err != nil {
		return nil, 0, fmt.Errorf("repository: list orders: %w", err)
	}
	defer rows.Close()

	var orders []domain.Order
	total := 0
	for rows.Next() {
		var o domain.Order
		if err := rows.Scan(
			&o.ID, &o.BusinessID, &o.Status, &o.TotalAmount, &o.CreatedBy, &o.CreatedAt, &o.UpdatedAt,
			&o.Customer.ID, &o.Customer.Name, &o.Customer.Phone, &o.Customer.CreatedAt,
			&total,
		); err != nil {
			return nil, 0, fmt.Errorf("repository: scan order row: %w", err)
		}
		orders = append(orders, o)
	}
	if err := rows.Err(); err != nil {
		return nil, 0, fmt.Errorf("repository: iterate order rows: %w", err)
	}

	if err := r.attachItems(ctx, orders); err != nil {
		return nil, 0, err
	}

	return orders, total, nil
}

// attachItems batch-fetches order_items for every order in orders (one
// query, not one per order) and assigns each order its matching items.
func (r *orderRepository) attachItems(ctx context.Context, orders []domain.Order) error {
	if len(orders) == 0 {
		return nil
	}

	ids := make([]uuid.UUID, len(orders))
	for i, o := range orders {
		ids[i] = o.ID
	}

	const query = `
		SELECT oi.order_id, oi.id, oi.product_id, p.name, c.name, oi.quantity, oi.unit_price
		FROM order_items oi
		JOIN products p ON p.id = oi.product_id
		JOIN categories c ON c.id = p.category_id
		WHERE oi.order_id = ANY($1)
		ORDER BY oi.id`

	rows, err := r.pool.Query(ctx, query, ids)
	if err != nil {
		return fmt.Errorf("repository: find order items: %w", err)
	}
	defer rows.Close()

	itemsByOrder := make(map[uuid.UUID][]domain.OrderItem, len(orders))
	for rows.Next() {
		var orderID uuid.UUID
		var item domain.OrderItem
		if err := rows.Scan(&orderID, &item.ID, &item.ProductID, &item.ProductName, &item.CategoryName, &item.Quantity, &item.UnitPrice); err != nil {
			return fmt.Errorf("repository: scan order item row: %w", err)
		}
		itemsByOrder[orderID] = append(itemsByOrder[orderID], item)
	}
	if err := rows.Err(); err != nil {
		return fmt.Errorf("repository: iterate order item rows: %w", err)
	}

	for i := range orders {
		orders[i].Items = itemsByOrder[orders[i].ID]
	}

	return nil
}

// FindByID is intentionally not businessID-scoped at the query level —
// mirrors ProductRepository.FindByID; callers (OrderUsecase) compare the
// returned row's BusinessID against the caller's themselves.
func (r *orderRepository) FindByID(ctx context.Context, id uuid.UUID) (*domain.Order, error) {
	const query = `
		SELECT o.id, o.business_id, o.status, o.total_amount, o.created_by, o.created_at, o.updated_at,
			c.id, c.name, c.phone, c.created_at
		FROM orders o
		JOIN customers c ON c.id = o.customer_id
		WHERE o.id = $1`

	var o domain.Order
	err := r.pool.QueryRow(ctx, query, id).Scan(
		&o.ID, &o.BusinessID, &o.Status, &o.TotalAmount, &o.CreatedBy, &o.CreatedAt, &o.UpdatedAt,
		&o.Customer.ID, &o.Customer.Name, &o.Customer.Phone, &o.Customer.CreatedAt,
	)
	if errors.Is(err, pgx.ErrNoRows) {
		return nil, nil
	}
	if err != nil {
		return nil, fmt.Errorf("repository: find order by id: %w", err)
	}

	orders := []domain.Order{o}
	if err := r.attachItems(ctx, orders); err != nil {
		return nil, err
	}

	return &orders[0], nil
}

// UpdateStatus transitions an order's status. Transitioning to
// OrderCancelled restocks its line items' products within the same
// transaction; any other transition (including cancelling an already-
// cancelled order, a no-op) never touches stock. Business ownership is
// verified by the caller (OrderUsecase) via FindByID before this is called.
func (r *orderRepository) UpdateStatus(ctx context.Context, id uuid.UUID, status domain.OrderStatus) (*domain.Order, error) {
	tx, err := r.pool.Begin(ctx)
	if err != nil {
		return nil, fmt.Errorf("repository: begin update order status tx: %w", err)
	}
	defer tx.Rollback(ctx)

	var currentStatus domain.OrderStatus
	if err := tx.QueryRow(ctx, `SELECT status FROM orders WHERE id = $1`, id).Scan(&currentStatus); err != nil {
		if errors.Is(err, pgx.ErrNoRows) {
			return nil, domain.ErrNotFound
		}
		return nil, fmt.Errorf("repository: find order status: %w", err)
	}

	tag, err := tx.Exec(ctx, `UPDATE orders SET status = $1, updated_at = now() WHERE id = $2`, status, id)
	if err != nil {
		return nil, fmt.Errorf("repository: update order status: %w", err)
	}
	if tag.RowsAffected() == 0 {
		return nil, domain.ErrNotFound
	}

	if status == domain.OrderCancelled && currentStatus != domain.OrderCancelled {
		rows, err := tx.Query(ctx, `SELECT product_id, quantity FROM order_items WHERE order_id = $1`, id)
		if err != nil {
			return nil, fmt.Errorf("repository: find order items to restock: %w", err)
		}
		type restockLine struct {
			productID uuid.UUID
			quantity  int
		}
		var lines []restockLine
		for rows.Next() {
			var line restockLine
			if err := rows.Scan(&line.productID, &line.quantity); err != nil {
				rows.Close()
				return nil, fmt.Errorf("repository: scan restock line: %w", err)
			}
			lines = append(lines, line)
		}
		rows.Close()
		if err := rows.Err(); err != nil {
			return nil, fmt.Errorf("repository: iterate restock lines: %w", err)
		}

		for _, line := range lines {
			if _, err := tx.Exec(ctx,
				`UPDATE products SET stock_quantity = stock_quantity + $1 WHERE id = $2`,
				line.quantity, line.productID,
			); err != nil {
				return nil, fmt.Errorf("repository: restock product: %w", err)
			}
		}
	}

	if err := tx.Commit(ctx); err != nil {
		return nil, fmt.Errorf("repository: commit update order status tx: %w", err)
	}

	return r.FindByID(ctx, id)
}

// SummaryStats sums total_amount and counts non-cancelled orders created
// within [since, until), always scoped to businessID, optionally further to
// createdBy.
func (r *orderRepository) SummaryStats(ctx context.Context, businessID uuid.UUID, createdBy *uuid.UUID, since, until time.Time) (float64, int, error) {
	query := `
		SELECT COALESCE(SUM(total_amount), 0), COUNT(*)
		FROM orders
		WHERE business_id = $1 AND status != 'cancelled' AND created_at >= $2 AND created_at < $3`

	args := []any{businessID, since, until}
	if createdBy != nil {
		query += ` AND created_by = $4`
		args = append(args, *createdBy)
	}

	var sales float64
	var count int
	if err := r.pool.QueryRow(ctx, query, args...).Scan(&sales, &count); err != nil {
		return 0, 0, fmt.Errorf("repository: order summary stats: %w", err)
	}

	return sales, count, nil
}

// TopProductPerformance returns up to limit products ordered by units sold
// (descending) within non-cancelled orders since the given time, always
// scoped to businessID.
func (r *orderRepository) TopProductPerformance(ctx context.Context, businessID uuid.UUID, createdBy *uuid.UUID, since time.Time, limit int) ([]domain.ProductPerformance, error) {
	query := `
		SELECT p.id, p.name, c.name, p.stock_quantity, p.low_stock_threshold, COALESCE(SUM(oi.quantity), 0) AS units_sold
		FROM products p
		JOIN categories c ON c.id = p.category_id
		JOIN order_items oi ON oi.product_id = p.id
		JOIN orders o ON o.id = oi.order_id
		WHERE o.business_id = $1 AND o.status != 'cancelled' AND o.created_at >= $2`

	args := []any{businessID, since}
	if createdBy != nil {
		args = append(args, *createdBy)
		query += fmt.Sprintf(` AND o.created_by = $%d`, len(args))
	}
	query += fmt.Sprintf(` GROUP BY p.id, c.name ORDER BY units_sold DESC LIMIT $%d`, len(args)+1)
	args = append(args, limit)

	rows, err := r.pool.Query(ctx, query, args...)
	if err != nil {
		return nil, fmt.Errorf("repository: top product performance: %w", err)
	}
	defer rows.Close()

	var results []domain.ProductPerformance
	for rows.Next() {
		var perf domain.ProductPerformance
		var stockQuantity, lowStockThreshold int
		if err := rows.Scan(&perf.ProductID, &perf.ProductName, &perf.CategoryName, &stockQuantity, &lowStockThreshold, &perf.UnitsSold); err != nil {
			return nil, fmt.Errorf("repository: scan product performance row: %w", err)
		}
		perf.StockStatus = domain.Product{StockQuantity: stockQuantity, LowStockThreshold: lowStockThreshold}.StockStatus()
		perf.StockQuantity = stockQuantity
		results = append(results, perf)
	}
	if err := rows.Err(); err != nil {
		return nil, fmt.Errorf("repository: iterate product performance rows: %w", err)
	}

	return results, nil
}

func (r *orderRepository) ProductOrderSummary(ctx context.Context, businessID, productID uuid.UUID) (domain.ProductOrderSummary, error) {
	const query = `
		SELECT
			COUNT(DISTINCT o.id),
			COALESCE(SUM(oi.quantity), 0),
			COALESCE(SUM(oi.quantity * oi.unit_price), 0)
		FROM order_items oi
		JOIN orders o ON o.id = oi.order_id
		WHERE o.business_id = $1 AND oi.product_id = $2 AND o.status != 'cancelled'`

	var summary domain.ProductOrderSummary
	err := r.pool.QueryRow(ctx, query, businessID, productID).
		Scan(&summary.OrderCount, &summary.UnitsSold, &summary.Revenue)
	if err != nil {
		return domain.ProductOrderSummary{}, fmt.Errorf("repository: product order summary: %w", err)
	}

	return summary, nil
}

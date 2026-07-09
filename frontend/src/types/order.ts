import type { StockStatus } from "./product";

export type OrderStatus = "pending" | "confirmed" | "delivered" | "cancelled";

export const ORDER_STATUS_LABELS: Record<OrderStatus, string> = {
  pending: "Inasubiri",
  confirmed: "Imethibitishwa",
  delivered: "Imewasilishwa",
  cancelled: "Imeghairiwa",
};

export const ORDER_STATUS_TONE: Record<
  OrderStatus,
  "success" | "warning" | "neutral" | "danger"
> = {
  pending: "warning",
  confirmed: "neutral",
  delivered: "success",
  cancelled: "danger",
};

export interface OrderCustomer {
  id: string;
  name: string;
  phone: string;
}

export interface OrderItem {
  id: string;
  product_id: string;
  product_name: string;
  category: string;
  quantity: number;
  unit_price: number;
}

export interface Order {
  id: string;
  customer: OrderCustomer;
  status: OrderStatus;
  total_amount: number;
  items: OrderItem[];
  created_at: string;
  updated_at: string;
}

export interface ProductPerformance {
  product_id: string;
  product_name: string;
  category: string;
  units_sold: number;
  stock_status: StockStatus;
}

export interface DashboardSummary {
  total_sales: number;
  total_sales_trend_pct: number | null;
  total_orders: number;
  total_orders_trend_pct: number | null;
  active_customers: number;
  active_customers_trend_pct: number | null;
  product_performance: ProductPerformance[];
}

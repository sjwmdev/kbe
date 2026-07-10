export interface Category {
  id: string;
  name: string;
  slug: string;
  display_order: number;
  created_at: string;
  updated_at: string;
}

export type StockStatus = "out_of_stock" | "low_stock" | "in_stock";

export interface ProductImage {
  id: string;
  image_url: string;
  is_primary: boolean;
}

export interface Product {
  id: string;
  name: string;
  description: string;
  price: number;
  category_id: string;
  category: string;
  is_active: boolean;
  stock_quantity: number;
  low_stock_threshold: number;
  stock_status: StockStatus;
  colors: string[];
  like_count: number;
  images: ProductImage[];
  created_at: string;
  updated_at: string;
}

/**
 * Fixed catalog of selectable product colors (name -> swatch hex),
 * mirroring the backend's domain.ValidProductColors — a closed list, not
 * free text, so the public color filter always matches real values.
 */
export const PRODUCT_COLORS: { name: string; hex: string }[] = [
  { name: "Black", hex: "#000000" },
  { name: "White", hex: "#ffffff" },
  { name: "Blue", hex: "#2563eb" },
  { name: "Green", hex: "#16a34a" },
  { name: "Brown", hex: "#92400e" },
  { name: "Yellow", hex: "#eab308" },
  { name: "Red", hex: "#dc2626" },
  { name: "Pink", hex: "#ec4899" },
  { name: "Gold", hex: "#d4af37" },
  { name: "Rose Gold", hex: "#b76e79" },
  { name: "Beige", hex: "#f5f5dc" },
  { name: "Nude", hex: "#e3bc9a" },
  { name: "Cream", hex: "#fffdd0" },
  { name: "Silver", hex: "#c0c0c0" },
];

export interface ProductOrderSummary {
  order_count: number;
  units_sold: number;
  revenue: number;
}

export interface ProductDetail extends Product {
  created_by_name: string;
  order_summary: ProductOrderSummary;
}

export const STOCK_STATUS_LABELS: Record<StockStatus, string> = {
  out_of_stock: "Imeisha",
  low_stock: "Kiasi Kidogo",
  in_stock: "Ipo",
};

export const STOCK_STATUS_TONE: Record<StockStatus, "success" | "warning" | "danger"> = {
  out_of_stock: "danger",
  low_stock: "warning",
  in_stock: "success",
};

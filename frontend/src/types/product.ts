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
  like_count: number;
  images: ProductImage[];
  created_at: string;
  updated_at: string;
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

export type NotificationCategory =
  | "low_stock"
  | "password_reset_request"
  | "system"
  | "order"
  | "user";

export const NOTIFICATION_CATEGORY_LABELS: Record<NotificationCategory, string> = {
  low_stock: "Stoo Ndogo",
  password_reset_request: "Ombi la Nenosiri",
  system: "Mfumo",
  order: "Oda",
  user: "Mtumiaji",
};

export interface Notification {
  id: string;
  category: string;
  message: string;
  link_url: string;
  is_read: boolean;
  is_resolved: boolean;
  created_at: string;
}

export interface NotificationFilter {
  category?: NotificationCategory | "";
  read?: boolean;
  resolved?: boolean;
}

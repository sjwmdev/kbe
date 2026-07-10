import type { Category, Product, ProductDetail } from "../types/product";
import type {
  SiteSettings,
  StaticPage,
  StaticPageSlug,
  SliderPoster,
} from "../types/content";
import type {
  Role,
  Permission,
  AdminUser,
  CommunicationChannel,
} from "../types/rbac";
import type { MediaFolder, MediaAsset } from "../types/media";
import type { AuditLog } from "../types/audit";
import type { DashboardSummary, Order, OrderStatus } from "../types/order";
import type { Notification, NotificationFilter } from "../types/notification";
import type { MessageTemplate } from "../types/template";

export const API_BASE_URL: string =
  import.meta.env.VITE_API_BASE_URL ?? "http://localhost:8080";

/** Resolves a possibly-relative media path (e.g. "/uploads/x.jpg") returned by the API into an absolute URL. */
export function resolveMediaUrl(path: string): string {
  if (path.startsWith("http://") || path.startsWith("https://")) {
    return path;
  }
  return `${API_BASE_URL}${path}`;
}

export class ApiError extends Error {
  status: number;
  /** Machine-readable error code (e.g. "account_locked", "password_change_required"). */
  code?: string;

  constructor(status: number, message: string, code?: string) {
    super(message);
    this.status = status;
    this.code = code;
  }
}

const UPLOAD_ERROR_MESSAGES: Record<string, string> = {
  file_too_large: "Picha ni kubwa mno. Kiwango cha juu kinachoruhusiwa ni MB 10.",
  invalid_image_format:
    "Aina ya faili hii haitambuliki. Tumia JPG, PNG, GIF au WEBP.",
  missing_file: "Hakuna picha iliyochaguliwa.",
  malformed_upload: "Fomu ya kupakia haikusomeka. Jaribu tena.",
  upload_failed: "Imeshindwa kuhifadhi picha. Jaribu tena.",
  upload_network_error:
    "Imeshindwa kupakia picha. Hakikisha picha si kubwa mno (zaidi ya MB 10) na muunganisho wa mtandao ni mzuri, kisha jaribu tena.",
};

/**
 * Maps an upload failure to a specific, user-friendly Swahili message (e.g.
 * "file too large", "unsupported format") when the error carries a
 * recognized code, or undefined otherwise — callers supply their own
 * contextual fallback for unrecognized errors.
 */
export function uploadErrorMessage(err: unknown): string | undefined {
  if (err instanceof ApiError && err.code && UPLOAD_ERROR_MESSAGES[err.code]) {
    return UPLOAD_ERROR_MESSAGES[err.code];
  }
  return undefined;
}

async function request<T>(
  path: string,
  options: RequestInit = {},
): Promise<T> {
  const res = await fetch(`${API_BASE_URL}${path}`, {
    ...options,
    headers: {
      ...(options.body && !(options.body instanceof FormData)
        ? { "Content-Type": "application/json" }
        : {}),
      ...options.headers,
    },
  });

  if (!res.ok) {
    let message = res.statusText;
    let code: string | undefined;
    try {
      const body = await res.json();
      if (body?.error) message = body.error;
      if (body?.code) code = body.code;
    } catch {
      // response had no JSON body; fall back to status text.
    }
    throw new ApiError(res.status, message, code);
  }

  if (res.status === 204) {
    return undefined as T;
  }

  return (await res.json()) as T;
}

function authHeaders(token: string): HeadersInit {
  return { Authorization: `Bearer ${token}` };
}

/**
 * Uploads a FormData body via XMLHttpRequest instead of fetch — fetch has no
 * way to observe upload progress, while XHR's `upload.onprogress` gives real
 * byte-level percentages for the admin upload progress bars.
 */
function uploadWithProgress<T>(
  path: string,
  token: string,
  formData: FormData,
  onProgress?: (percent: number) => void,
): Promise<T> {
  return new Promise((resolve, reject) => {
    const xhr = new XMLHttpRequest();
    xhr.open("POST", `${API_BASE_URL}${path}`);
    xhr.setRequestHeader("Authorization", `Bearer ${token}`);

    xhr.upload.onprogress = (e) => {
      if (e.lengthComputable && onProgress) {
        onProgress(Math.round((e.loaded / e.total) * 100));
      }
    };

    xhr.onload = () => {
      let body: unknown;
      try {
        body = xhr.responseText ? JSON.parse(xhr.responseText) : undefined;
      } catch {
        body = undefined;
      }

      if (xhr.status >= 200 && xhr.status < 300) {
        resolve(body as T);
        return;
      }

      const parsed = body as { error?: string; code?: string } | undefined;
      reject(new ApiError(xhr.status, parsed?.error ?? xhr.statusText, parsed?.code));
    };

    // A network-level failure (no HTTP response at all) during a file
    // upload is almost always the file being too large for the connection
    // to complete — surfaced with a code so callers show that hint instead
    // of a bare "network error".
    xhr.onerror = () => reject(new ApiError(0, "network error", "upload_network_error"));

    xhr.send(formData);
  });
}

export interface ProductFilter {
  categoryId?: string;
  color?: string;
  minPrice?: number;
  maxPrice?: number;
}

export function fetchProducts(
  filter: ProductFilter = {},
  page = 1,
  pageSize = 24,
): Promise<PaginatedProducts> {
  const params = new URLSearchParams({
    page: String(page),
    page_size: String(pageSize),
  });
  if (filter.categoryId) params.set("category_id", filter.categoryId);
  if (filter.color) params.set("color", filter.color);
  if (filter.minPrice != null) params.set("min_price", String(filter.minPrice));
  if (filter.maxPrice != null) params.set("max_price", String(filter.maxPrice));
  return request<PaginatedProducts>(`/api/v1/products?${params.toString()}`);
}

export function fetchProduct(id: string): Promise<Product> {
  return request<Product>(`/api/v1/products/${id}`);
}

/** Admin-only listing that includes inactive (soft-deleted) products. */
export interface PaginatedProducts {
  products: Product[];
  total: number;
  page: number;
  page_size: number;
}

export function fetchAdminProducts(
  token: string,
  page = 1,
  pageSize = 20,
): Promise<PaginatedProducts> {
  return request<PaginatedProducts>(
    `/api/v1/admin/products?page=${page}&page_size=${pageSize}`,
    { headers: authHeaders(token) },
  );
}

/** Read-only admin product details page — includes order history summary. */
export function fetchAdminProductDetail(
  token: string,
  id: string,
): Promise<ProductDetail> {
  return request(`/api/v1/admin/products/${id}`, {
    headers: authHeaders(token),
  });
}

export function likeProduct(id: string): Promise<{ like_count: number }> {
  return request(`/api/v1/products/${id}/like`, { method: "POST" });
}

export function unlikeProduct(id: string): Promise<{ like_count: number }> {
  return request(`/api/v1/products/${id}/like`, { method: "DELETE" });
}

export interface SessionResponse {
  token: string;
  must_change_password: boolean;
  role: string;
  permissions: string[];
}

export function loginAdmin(
  email: string,
  password: string,
): Promise<SessionResponse> {
  return request("/api/v1/admin/login", {
    method: "POST",
    body: JSON.stringify({ email, password }),
  });
}

export interface AdminProfile {
  id: string;
  username: string;
  name: string;
  email: string;
  phone: string;
  default_communication_channel: CommunicationChannel;
  role: string;
  permissions: string[];
  must_change_password: boolean;
  created_at: string;
  updated_at: string;
}

export function fetchProfile(token: string): Promise<AdminProfile> {
  return request("/api/v1/admin/me", { headers: authHeaders(token) });
}

export function updateProfile(
  token: string,
  input: {
    name: string;
    email: string;
    phone: string;
    default_communication_channel: CommunicationChannel;
  },
): Promise<AdminProfile> {
  return request("/api/v1/admin/me", {
    method: "PUT",
    headers: authHeaders(token),
    body: JSON.stringify(input),
  });
}

/**
 * Anonymous forgot-password submission — creates a dashboard notification
 * for the admins instead of emailing a reset link. The response is the same
 * whether or not the identifier matched an account (anti-enumeration).
 */
export function requestPasswordReset(
  identifier: string,
): Promise<{ message: string }> {
  return request("/api/v1/admin/forgot-password", {
    method: "POST",
    body: JSON.stringify({ identifier }),
  });
}

export function resetUserPassword(
  token: string,
  id: string,
): Promise<{ user: AdminUser; temporary_password: string }> {
  return request(`/api/v1/admin/users/${id}/reset-password`, {
    method: "POST",
    headers: authHeaders(token),
  });
}

export function changePassword(
  token: string,
  input: { current_password: string; new_password: string },
): Promise<SessionResponse> {
  return request("/api/v1/admin/me/password", {
    method: "PUT",
    headers: authHeaders(token),
    body: JSON.stringify(input),
  });
}

export interface ProductInput {
  name: string;
  description: string;
  price: number;
  category_id: string;
  is_active: boolean;
  stock_quantity: number;
  low_stock_threshold: number;
  colors: string[];
}

export function createProduct(
  token: string,
  input: ProductInput,
): Promise<Product> {
  return request("/api/v1/admin/products", {
    method: "POST",
    headers: authHeaders(token),
    body: JSON.stringify(input),
  });
}

export function updateProduct(
  token: string,
  id: string,
  input: ProductInput,
): Promise<Product> {
  return request(`/api/v1/admin/products/${id}`, {
    method: "PUT",
    headers: authHeaders(token),
    body: JSON.stringify(input),
  });
}

export function deleteProduct(token: string, id: string): Promise<void> {
  return request(`/api/v1/admin/products/${id}`, {
    method: "DELETE",
    headers: authHeaders(token),
  });
}

/** Reverses a soft delete/hide (is_active -> true). */
export function restoreProduct(token: string, id: string): Promise<void> {
  return request(`/api/v1/admin/products/${id}/restore`, {
    method: "PUT",
    headers: authHeaders(token),
  });
}

/**
 * Permanently deletes the product row. Rejects with an ApiError (400) if
 * the product still has order history — see domain.ErrProductInUse.
 */
export function forceDeleteProduct(token: string, id: string): Promise<void> {
  return request(`/api/v1/admin/products/${id}/force`, {
    method: "DELETE",
    headers: authHeaders(token),
  });
}

export function uploadProductImage(
  token: string,
  productId: string,
  file: File,
  isPrimary: boolean,
  onProgress?: (percent: number) => void,
  // Set when this file is a cropped derivative of a Media Library pick, so
  // the resulting product image stays traceable back to its source asset.
  mediaAssetId?: string,
): Promise<{ image_url: string }> {
  const formData = new FormData();
  formData.append("is_primary", String(isPrimary));
  formData.append("image", file);
  if (mediaAssetId) formData.append("media_asset_id", mediaAssetId);

  return uploadWithProgress(
    `/api/v1/admin/products/${productId}/images`,
    token,
    formData,
    onProgress,
  );
}

export function deleteProductImage(
  token: string,
  imageId: string,
): Promise<void> {
  return request(`/api/v1/admin/images/${imageId}`, {
    method: "DELETE",
    headers: authHeaders(token),
  });
}

// --- Categories ---

export function fetchCategories(): Promise<Category[]> {
  return request<Category[]>("/api/v1/categories");
}

export function fetchAdminCategories(token: string): Promise<Category[]> {
  return request<Category[]>("/api/v1/admin/categories", {
    headers: authHeaders(token),
  });
}

export interface CategoryInput {
  name: string;
  slug: string;
  display_order: number;
}

export function createCategory(
  token: string,
  input: CategoryInput,
): Promise<Category> {
  return request("/api/v1/admin/categories", {
    method: "POST",
    headers: authHeaders(token),
    body: JSON.stringify(input),
  });
}

export function updateCategory(
  token: string,
  id: string,
  input: CategoryInput,
): Promise<Category> {
  return request(`/api/v1/admin/categories/${id}`, {
    method: "PUT",
    headers: authHeaders(token),
    body: JSON.stringify(input),
  });
}

export function deleteCategory(token: string, id: string): Promise<void> {
  return request(`/api/v1/admin/categories/${id}`, {
    method: "DELETE",
    headers: authHeaders(token),
  });
}

// --- Site settings ---

export function fetchSettings(): Promise<SiteSettings> {
  return request<SiteSettings>("/api/v1/settings");
}

export interface SettingsInput {
  whatsapp_number: string;
  contact_email: string;
  contact_address: string;
  instagram_url: string;
  facebook_url: string;
  company_name: string;
  logo_light_url: string;
  logo_dark_url: string;
  brand_accent_color: string;
  brand_accent_color_dark: string;
}

export function updateSettings(
  token: string,
  input: SettingsInput,
): Promise<SiteSettings> {
  return request("/api/v1/admin/settings", {
    method: "PUT",
    headers: authHeaders(token),
    body: JSON.stringify(input),
  });
}

// --- Static pages ---

export function fetchPage(slug: StaticPageSlug): Promise<StaticPage> {
  return request<StaticPage>(`/api/v1/pages/${slug}`);
}

export function fetchAdminPages(token: string): Promise<StaticPage[]> {
  return request<StaticPage[]>("/api/v1/admin/pages", {
    headers: authHeaders(token),
  });
}

export function updatePage(
  token: string,
  slug: StaticPageSlug,
  input: { title: string; body: string },
): Promise<StaticPage> {
  return request(`/api/v1/admin/pages/${slug}`, {
    method: "PUT",
    headers: authHeaders(token),
    body: JSON.stringify(input),
  });
}

// --- Slider posters ---

export function fetchSliders(): Promise<SliderPoster[]> {
  return request<SliderPoster[]>("/api/v1/sliders");
}

export function fetchAdminSliders(token: string): Promise<SliderPoster[]> {
  return request<SliderPoster[]>("/api/v1/admin/sliders", {
    headers: authHeaders(token),
  });
}

export interface SliderPosterInput {
  image_url: string;
  link_category: string;
  display_order: number;
  is_active: boolean;
}

export function createSlider(
  token: string,
  input: SliderPosterInput,
): Promise<SliderPoster> {
  return request("/api/v1/admin/sliders", {
    method: "POST",
    headers: authHeaders(token),
    body: JSON.stringify(input),
  });
}

export function updateSlider(
  token: string,
  id: string,
  input: SliderPosterInput,
): Promise<SliderPoster> {
  return request(`/api/v1/admin/sliders/${id}`, {
    method: "PUT",
    headers: authHeaders(token),
    body: JSON.stringify(input),
  });
}

export function deleteSlider(token: string, id: string): Promise<void> {
  return request(`/api/v1/admin/sliders/${id}`, {
    method: "DELETE",
    headers: authHeaders(token),
  });
}

export function uploadSliderImage(
  token: string,
  file: File,
  onProgress?: (percent: number) => void,
): Promise<{ image_url: string }> {
  const formData = new FormData();
  formData.append("image", file);

  return uploadWithProgress(
    "/api/v1/admin/sliders/upload",
    token,
    formData,
    onProgress,
  );
}

// --- Roles & permissions ---

export function fetchRoles(token: string): Promise<Role[]> {
  return request("/api/v1/admin/roles", { headers: authHeaders(token) });
}

export interface RoleInput {
  name: string;
  description: string;
}

export function createRole(token: string, input: RoleInput): Promise<Role> {
  return request("/api/v1/admin/roles", {
    method: "POST",
    headers: authHeaders(token),
    body: JSON.stringify(input),
  });
}

export function updateRole(
  token: string,
  id: string,
  input: RoleInput,
): Promise<Role> {
  return request(`/api/v1/admin/roles/${id}`, {
    method: "PUT",
    headers: authHeaders(token),
    body: JSON.stringify(input),
  });
}

export function deleteRole(token: string, id: string): Promise<void> {
  return request(`/api/v1/admin/roles/${id}`, {
    method: "DELETE",
    headers: authHeaders(token),
  });
}

export function fetchPermissions(token: string): Promise<Permission[]> {
  return request("/api/v1/admin/permissions", { headers: authHeaders(token) });
}

export function fetchRolePermissions(
  token: string,
  roleId: string,
): Promise<string[]> {
  return request<{ permission_ids: string[] }>(
    `/api/v1/admin/roles/${roleId}/permissions`,
    { headers: authHeaders(token) },
  ).then((res) => res.permission_ids);
}

export function updateRolePermissions(
  token: string,
  roleId: string,
  permissionIds: string[],
): Promise<void> {
  return request(`/api/v1/admin/roles/${roleId}/permissions`, {
    method: "PUT",
    headers: authHeaders(token),
    body: JSON.stringify({ permission_ids: permissionIds }),
  });
}

// --- Users (admin management, distinct from self-service /me) ---

export function fetchUsers(token: string): Promise<AdminUser[]> {
  return request("/api/v1/admin/users", { headers: authHeaders(token) });
}

export interface AdminUserInput {
  name: string;
  email: string;
  role_id: string | null;
}

export interface CreateUserResponse {
  user: AdminUser;
  temporary_password: string;
}

export function createUser(
  token: string,
  input: AdminUserInput,
): Promise<CreateUserResponse> {
  return request("/api/v1/admin/users", {
    method: "POST",
    headers: authHeaders(token),
    body: JSON.stringify(input),
  });
}

export function updateUser(
  token: string,
  id: string,
  input: AdminUserInput,
): Promise<AdminUser> {
  return request(`/api/v1/admin/users/${id}`, {
    method: "PUT",
    headers: authHeaders(token),
    body: JSON.stringify(input),
  });
}

export function setUserActive(
  token: string,
  id: string,
  isActive: boolean,
): Promise<void> {
  return request(`/api/v1/admin/users/${id}/active`, {
    method: "PUT",
    headers: authHeaders(token),
    body: JSON.stringify({ is_active: isActive }),
  });
}

export function deleteUser(token: string, id: string): Promise<void> {
  return request(`/api/v1/admin/users/${id}`, {
    method: "DELETE",
    headers: authHeaders(token),
  });
}

// --- Media Library ---

export function fetchMediaFolders(token: string): Promise<MediaFolder[]> {
  return request("/api/v1/admin/media/folders", { headers: authHeaders(token) });
}

export function createMediaFolder(
  token: string,
  name: string,
): Promise<MediaFolder> {
  return request("/api/v1/admin/media/folders", {
    method: "POST",
    headers: authHeaders(token),
    body: JSON.stringify({ name }),
  });
}

export function deleteMediaFolder(token: string, id: string): Promise<void> {
  return request(`/api/v1/admin/media/folders/${id}`, {
    method: "DELETE",
    headers: authHeaders(token),
  });
}

export interface PaginatedMediaAssets {
  assets: MediaAsset[];
  total: number;
  page: number;
  page_size: number;
}

export function fetchMediaAssets(
  token: string,
  folderId: string | null,
  page = 1,
  pageSize = 40,
): Promise<PaginatedMediaAssets> {
  const params = new URLSearchParams({
    page: String(page),
    page_size: String(pageSize),
  });
  if (folderId) params.set("folder_id", folderId);

  return request(`/api/v1/admin/media?${params.toString()}`, {
    headers: authHeaders(token),
  });
}

export function uploadMediaAsset(
  token: string,
  file: File,
  folderId: string | null,
  onProgress?: (percent: number) => void,
): Promise<MediaAsset> {
  const formData = new FormData();
  formData.append("image", file);
  if (folderId) formData.append("folder_id", folderId);

  return uploadWithProgress("/api/v1/admin/media/upload", token, formData, onProgress);
}

export interface BulkDeleteResult {
  deleted_count: number;
  skipped_count: number;
}

export function bulkDeleteMediaAssets(
  token: string,
  ids: string[],
): Promise<BulkDeleteResult> {
  return request("/api/v1/admin/media/bulk-delete", {
    method: "POST",
    headers: authHeaders(token),
    body: JSON.stringify({ ids }),
  });
}

export function moveMediaAssets(
  token: string,
  ids: string[],
  folderId: string | null,
): Promise<void> {
  return request("/api/v1/admin/media/move", {
    method: "PUT",
    headers: authHeaders(token),
    body: JSON.stringify({ ids, folder_id: folderId }),
  });
}

// --- Audit logs (SuperAdmin only) ---

export interface PaginatedAuditLogs {
  logs: AuditLog[];
  total: number;
  page: number;
  page_size: number;
}

export function fetchAuditLogs(
  token: string,
  page = 1,
  pageSize = 20,
): Promise<PaginatedAuditLogs> {
  return request(`/api/v1/admin/audit-logs?page=${page}&page_size=${pageSize}`, {
    headers: authHeaders(token),
  });
}

export function clearAuditLogs(token: string): Promise<void> {
  return request("/api/v1/admin/audit-logs", {
    method: "DELETE",
    headers: authHeaders(token),
  });
}

// --- Orders ---

export interface PaginatedOrders {
  orders: Order[];
  total: number;
  page: number;
  page_size: number;
}

export function fetchOrders(
  token: string,
  page = 1,
  pageSize = 20,
): Promise<PaginatedOrders> {
  return request(`/api/v1/admin/orders?page=${page}&page_size=${pageSize}`, {
    headers: authHeaders(token),
  });
}

export interface OrderItemInput {
  product_id: string;
  quantity: number;
}

export interface OrderInput {
  customer_name: string;
  customer_phone: string;
  items: OrderItemInput[];
}

export function createOrder(token: string, input: OrderInput): Promise<Order> {
  return request("/api/v1/admin/orders", {
    method: "POST",
    headers: authHeaders(token),
    body: JSON.stringify(input),
  });
}

export function updateOrderStatus(
  token: string,
  id: string,
  status: OrderStatus,
): Promise<Order> {
  return request(`/api/v1/admin/orders/${id}/status`, {
    method: "PUT",
    headers: authHeaders(token),
    body: JSON.stringify({ status }),
  });
}

// --- Dashboard ---

export function fetchDashboardSummary(token: string): Promise<DashboardSummary> {
  return request("/api/v1/admin/dashboard/summary", {
    headers: authHeaders(token),
  });
}

// --- Notifications ---

export interface PaginatedNotifications {
  notifications: Notification[];
  total: number;
  page: number;
  page_size: number;
}

export function fetchNotifications(
  token: string,
  page = 1,
  pageSize = 20,
  filter: NotificationFilter = {},
): Promise<PaginatedNotifications> {
  const params = new URLSearchParams({
    page: String(page),
    page_size: String(pageSize),
  });
  if (filter.category) params.set("category", filter.category);
  if (filter.read !== undefined) params.set("read", String(filter.read));
  if (filter.resolved !== undefined) params.set("resolved", String(filter.resolved));

  return request(`/api/v1/admin/notifications?${params.toString()}`, {
    headers: authHeaders(token),
  });
}

export function deleteNotification(token: string, id: string): Promise<void> {
  return request(`/api/v1/admin/notifications/${id}`, {
    method: "DELETE",
    headers: authHeaders(token),
  });
}

// --- Message templates ---

export function fetchMessageTemplates(
  token: string,
): Promise<MessageTemplate[]> {
  return request("/api/v1/admin/message-templates", {
    headers: authHeaders(token),
  });
}

export function fetchUnreadNotificationCount(
  token: string,
): Promise<{ unread_count: number }> {
  return request("/api/v1/admin/notifications/unread-count", {
    headers: authHeaders(token),
  });
}

export function markNotificationRead(token: string, id: string): Promise<void> {
  return request(`/api/v1/admin/notifications/${id}/read`, {
    method: "PUT",
    headers: authHeaders(token),
  });
}

export function clearNotifications(token: string): Promise<void> {
  return request("/api/v1/admin/notifications", {
    method: "DELETE",
    headers: authHeaders(token),
  });
}


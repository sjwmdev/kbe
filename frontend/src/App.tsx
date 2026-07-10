import { Suspense, lazy } from "react";
import { Route, Routes } from "react-router-dom";
import { Loader2 } from "lucide-react";
import { Layout } from "./components/Layout";
import { ProductListPage } from "./pages/ProductListPage";
import { ProductDetailPage } from "./pages/ProductDetailPage";
import { AboutPage } from "./pages/AboutPage";
import { ContactPage } from "./pages/ContactPage";
import { PrivacyPage } from "./pages/PrivacyPage";
import { TermsPage } from "./pages/TermsPage";
import { NotFoundPage } from "./pages/NotFoundPage";
import { ForbiddenPage } from "./pages/ForbiddenPage";
import { AuthProvider } from "./context/AuthContext";
import { ToastProvider } from "./context/ToastContext";
import { ThemeProvider } from "./context/ThemeContext";
import { SettingsProvider } from "./context/SettingsContext";
import { ConfirmProvider } from "./context/ConfirmContext";
import { ProtectedRoute } from "./components/admin/ProtectedRoute";
import { TopProgressBar } from "./components/TopProgressBar";
import { ErrorBoundary } from "./components/ErrorBoundary";

// Every /admin/* page is lazy-loaded into its own chunk, split from the
// public storefront bundle above. The vast majority of visitors are
// customers who never touch /admin at all — they shouldn't have to
// download the entire admin dashboard's code (products CRUD, media
// library, roles/permissions, audit logs, etc.) just to browse products.
const AdminLayout = lazy(() =>
  import("./components/admin/AdminLayout").then((m) => ({ default: m.AdminLayout })),
);
const LoginPage = lazy(() =>
  import("./pages/admin/LoginPage").then((m) => ({ default: m.LoginPage })),
);
const DashboardPage = lazy(() =>
  import("./pages/admin/DashboardPage").then((m) => ({ default: m.DashboardPage })),
);
const ProductsPage = lazy(() =>
  import("./pages/admin/ProductsPage").then((m) => ({ default: m.ProductsPage })),
);
const ProductFormPage = lazy(() =>
  import("./pages/admin/ProductFormPage").then((m) => ({ default: m.ProductFormPage })),
);
const ProductDetailsPage = lazy(() =>
  import("./pages/admin/ProductDetailsPage").then((m) => ({ default: m.ProductDetailsPage })),
);
const StaticPagesPage = lazy(() =>
  import("./pages/admin/StaticPagesPage").then((m) => ({ default: m.StaticPagesPage })),
);
const CategoriesPage = lazy(() =>
  import("./pages/admin/CategoriesPage").then((m) => ({ default: m.CategoriesPage })),
);
const SlidersPage = lazy(() =>
  import("./pages/admin/SlidersPage").then((m) => ({ default: m.SlidersPage })),
);
const SettingsPage = lazy(() =>
  import("./pages/admin/SettingsPage").then((m) => ({ default: m.SettingsPage })),
);
const ProfilePage = lazy(() =>
  import("./pages/admin/ProfilePage").then((m) => ({ default: m.ProfilePage })),
);
const RolesPage = lazy(() =>
  import("./pages/admin/RolesPage").then((m) => ({ default: m.RolesPage })),
);
const UsersPage = lazy(() =>
  import("./pages/admin/UsersPage").then((m) => ({ default: m.UsersPage })),
);
const MediaLibraryPage = lazy(() =>
  import("./pages/admin/MediaLibraryPage").then((m) => ({ default: m.MediaLibraryPage })),
);
const AuditLogsPage = lazy(() =>
  import("./pages/admin/AuditLogsPage").then((m) => ({ default: m.AuditLogsPage })),
);
const OrdersPage = lazy(() =>
  import("./pages/admin/OrdersPage").then((m) => ({ default: m.OrdersPage })),
);
const OrderFormPage = lazy(() =>
  import("./pages/admin/OrderFormPage").then((m) => ({ default: m.OrderFormPage })),
);
const NotificationsPage = lazy(() =>
  import("./pages/admin/NotificationsPage").then((m) => ({
    default: m.NotificationsPage,
  })),
);

function AdminLoadingFallback() {
  return (
    <div className="flex min-h-screen items-center justify-center bg-page">
      <Loader2 className="animate-spin text-brand-accent" size={32} />
    </div>
  );
}

function App() {
  return (
    <ErrorBoundary>
      <ThemeProvider>
        <SettingsProvider>
          <ToastProvider>
            <ConfirmProvider>
              <AuthProvider>
                <TopProgressBar />
                <Routes>
                  <Route element={<Layout />}>
                    <Route index element={<ProductListPage />} />
                    <Route path="products/:id" element={<ProductDetailPage />} />
                    <Route path="about" element={<AboutPage />} />
                    <Route path="contact" element={<ContactPage />} />
                    <Route path="privacy" element={<PrivacyPage />} />
                    <Route path="terms" element={<TermsPage />} />
                    <Route path="forbidden" element={<ForbiddenPage />} />
                    <Route path="*" element={<NotFoundPage />} />
                  </Route>

                  <Route
                    path="admin/login"
                    element={
                      <Suspense fallback={<AdminLoadingFallback />}>
                        <LoginPage />
                      </Suspense>
                    }
                  />

                  <Route path="admin" element={<ProtectedRoute />}>
                    <Route
                      element={
                        <Suspense fallback={<AdminLoadingFallback />}>
                          <AdminLayout />
                        </Suspense>
                      }
                    >
                      <Route index element={<DashboardPage />} />
                      <Route path="products" element={<ProductsPage />} />
                      <Route path="products/new" element={<ProductFormPage />} />
                      <Route path="products/:id" element={<ProductDetailsPage />} />
                      <Route
                        path="products/:id/edit"
                        element={<ProductFormPage />}
                      />
                      <Route path="pages" element={<StaticPagesPage />} />
                      <Route path="categories" element={<CategoriesPage />} />
                      <Route path="sliders" element={<SlidersPage />} />
                      <Route path="settings" element={<SettingsPage />} />
                      <Route path="profile" element={<ProfilePage />} />
                      <Route path="roles" element={<RolesPage />} />
                      <Route path="users" element={<UsersPage />} />
                      <Route path="media" element={<MediaLibraryPage />} />
                      <Route path="audit-logs" element={<AuditLogsPage />} />
                      <Route path="orders" element={<OrdersPage />} />
                      <Route path="orders/new" element={<OrderFormPage />} />
                      <Route
                        path="notifications"
                        element={<NotificationsPage />}
                      />
                      <Route path="*" element={<NotFoundPage />} />
                    </Route>
                  </Route>
                </Routes>
              </AuthProvider>
            </ConfirmProvider>
          </ToastProvider>
        </SettingsProvider>
      </ThemeProvider>
    </ErrorBoundary>
  );
}

export default App;

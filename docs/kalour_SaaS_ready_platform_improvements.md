Claude, we need to refactor our current codebase to transition from a single-business 'Kalour Beauty' model to a multi-tenant, SaaS-ready platform. Please implement the following architecture changes:
1. **Dynamic Category Management:** Remove all hard-coded categories. Implement a 'Categories' table and a reusable UI component that allows admins to create, edit, and delete categories via a pop-up modal during product creation. This must be generic enough to support any business type (e.g., hardware, fashion, grocery).

2. **Global System Settings & Theming:** Replace all hard-coded branding elements (Company Name, Logo URL, Brand Colors, Font Sizes) with a 'SystemSettings' database table. The frontend must fetch these configurations via API on load and apply them globally using CSS variables or a React Theme Context. This ensures that every subscriber can manage their own visual identity without code changes.

3. **Multi-Tenant Data Scoping:** Update our database schema and API layer to support multi-tenancy. Every relevant table must be scoped by a `business_id` (or `tenant_id`). Ensure all API endpoints and database queries are strictly filtered by this ID to prevent data leakage between different business subscribers.

4. **Modularity & Onboarding Readiness:** Ensure all components are generic and extendable. The system should allow a new business to register, upload their own logo, configure their theme, and define their own categories independently.

Please audit the backend and frontend to ensure all modules communicate via the API correctly, maintaining this new flexible, multi-tenant architecture.



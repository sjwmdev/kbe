# Kalour Beauty Empire Website/System Improvements — Claude Code Execution Prompt

## Context
You are working on the **Kalour Beauty Empire** e-commerce website/admin dashboard. The goal is to improve the UI/UX, permissions, product management, notifications, password-reset workflow, product filtering, stock behavior, and customer engagement interactions without breaking existing functionality.

## Core Execution Rules
1. **Start by inspecting the current codebase**: identify framework, folder structure, routes, database schema/migrations, auth system, permission middleware, product/order models, dashboard components, and frontend website components.
2. **Execute tasks one by one from simple/low-risk to complex/high-risk** as arranged below.
3. **Do not remove working functionality** unless explicitly requested.
4. **Preserve existing brand identity**: Kalour Beauty Empire, premium e-commerce feel, brand color `#b80049`, clean luxury UI.
5. **Use consistent reusable components** instead of one-off designs.
6. **Apply permission checks both in UI and backend/API/server actions**. Hiding UI alone is not enough.
7. **For every task completed**, test the affected page/flow and fix visible issues before moving to the next task.
8. **Prefer small commits/checkpoints per phase** so issues can be reviewed easily.

---

# Phase 1 — Simple UI/Text Cleanup Tasks

## 1. Shorten “Kumbukumbu za Mfumo”
Current label **“Kumbukumbu za Mfumo”** is too long. Replace it with a shorter, cleaner label across the dashboard navigation and page titles.

Recommended options:
- **Logs**
- **System Logs**
- **Audit Logs**

Use the option that best matches the current module purpose. If the page stores admin/system activity, use **Audit Logs**.

### Acceptance Criteria
- Sidebar/navigation label is shorter.
- Page title/breadcrumbs are updated consistently.
- No route breaks.

---

## 2. Remove Redundant Website Section Labels
On the public website, there are small words/labels such as **“Kuhusu Sisi”** and **“Wasiliana Nasi”** appearing above sections. Remove these smaller labels and keep only the main professional section titles.

### Acceptance Criteria
- Redundant mini-labels are removed.
- Main titles remain visible and professional.
- Layout spacing still looks clean after removal.

---

## 3. Improve Admin Product Stock Column Display
In the admin dashboard product list, the stock column currently shows something like **“Ipo (15)”** with color styling. Change it to show only the numeric stock value, for example:

```text
15
```

Do not use colored badges for this column.

### Acceptance Criteria
- Product list stock column displays plain number only.
- No “Ipo”, “Haipo”, or colored stock badge in that column.
- Sorting/filtering should continue working if it exists.

---

# Phase 2 — Standard Table Actions Pattern

## 4. Replace Visible Action Buttons with Three-Dot Menu Across Admin Tables
Standardize table actions across the entire admin dashboard. Replace multiple visible action buttons with a **three horizontal dots menu (`...`)**. On click, the menu should show available actions based on the module and permissions.

Examples of actions by module:
- Products: View Details, Edit, Hide, Unhide, Delete, Permanent Delete where allowed
- Users: View Details, Edit, Reset Password, Disable/Enable, Delete where allowed
- Orders: View Details, Update Status, Delete where allowed
- Notifications: View, Mark as Read, Clear/Delete where allowed
(So the label can be more shorter to save space)

### Implementation Notes
- Create a reusable component, e.g. `ActionMenu`, `TableActionMenu`, or equivalent.
- Menu options must be permission-aware.
- Backend/server/API must still enforce permissions.
- Use consistent styling, placement, keyboard accessibility, and outside-click close behavior.

### Acceptance Criteria
- Admin tables use a consistent three-dot action menu.
- Actions shown depend on module and user permissions.
- Existing actions still work.
- No layout clutter in table rows.

---

# Phase 3 — Product Management Improvements

## 5. Explain and Improve Product Delete Behavior
Currently products appear not to be permanently deleted. First inspect whether the system uses soft deletes and why.

Then implement a clear delete strategy:

### Required Behavior
1. Admin should be able to **soft delete/hide** a product when it should no longer appear publicly.
2. Admin with proper permission should be able to **permanently delete** a product from the database when the product was created by mistake and has no important financial/order dependency.
3. If a product already has orders/financial records, prevent unsafe permanent deletion or show a strong confirmation explaining why it is blocked.

### Suggested Permission Names
- `products.delete`
- `products.forceDelete`
- `products.restore`

### Acceptance Criteria
- Admin understands the difference between hide/soft delete and permanent delete.
- Permanent delete works for mistaken products with no critical dependencies.
- Dangerous deletion is prevented where financial/order history requires data integrity.
- User receives clear confirmation/warning messages.

---

## 6. Add Product Details Page
Add a read-only product details page for managers/admins. This page should not be editable directly. It should present trusted information about a specific product.

### Details Page Should Include
- Product name
- Category
- Price
- Current stock quantity
- Minimum stock level
- Product colors/variants if available
- Visibility/status
- Description rendered correctly
- Product images if available
- Orders summary related to that product
- Likes/favorites count if available
- Created/updated information

### UX Direction
Use a modern common admin details view: summary cards, clean sections, product image preview, metadata, and related activity if available.

### Acceptance Criteria
- Product table has “View Details” action.
- Details page is read-only.
- Product data is presented clearly and professionally.
- Page is permission-protected.

---

## 7. Add Product Color Field and Activate Color Filtering
The public website already appears to support filtering products by color, but the admin product creation/editing form does not allow adding product colors. Add color support properly.

### Required Behavior
- Admin can select or add product colors during product creation/editing.
- Common color options should include: Black, White, Blue, Green, Brown, Yellow, Red, Pink, Gold, Rose Gold, Beige, Nude, Cream, Silver.
- Support one or multiple colors per product depending on current product structure.
- Public website color filter must use real product color data from the database.

### Implementation Options
Choose the best approach after inspecting the system:
1. Simple approach: `color` or `colors` field on products table.
2. Better approach: product variants/colors relationship table if product variants already exist or are planned.

### Acceptance Criteria
- Product form supports color input.
- Product edit page can update colors.
- Public color filter works with saved product colors.
- Filtering result is accurate.

---

## 8. Activate Price Range Filter on Public Website
The website has **“Kiwango cha Bei”** price range filter, but it appears disabled or not working. Activate it.

### Required Behavior
- Users can filter products by minimum and maximum price.
- Filter should work with the existing product list/search/category filters.
- Ensure Tanzania currency prices are handled correctly.

### Acceptance Criteria
- Price filter is usable and responsive.
- Product results update correctly.
- Edge cases work: empty min, empty max, min greater than max, no results.

---

## 9. Integrate WYSIWYG Editor for Product Description
Replace the plain product description textarea with a WYSIWYG editor so admins can format product descriptions.

### Editor Requirements
Must support:
- Bold/italic/underline
- Headings
- Bullet lists
- Numbered lists
- Links
- Tables if available
- Text colors if safe and supported
- Basic alignment if available

### Security Requirements
- Sanitize rendered HTML to prevent XSS.
- Store formatted content safely.
- Render product description correctly on product details page and public product page.

### Acceptance Criteria
- Admin can create formatted descriptions.
- Formatted descriptions display correctly to customers.
- HTML is sanitized before rendering.
- Existing product descriptions remain compatible.

---

# Phase 4 — Inventory and Stock Logic

## 10. Auto-Calculate Inventory/Stock Correctly
Improve inventory behavior so stock is reliable and data-driven.

### Required Behavior
- Product stock should be auto-calculated based on inventory movements, purchases, sales/orders, or the existing stock model.
- If the current system only stores a manual stock number, inspect and improve carefully without breaking existing product creation.
- Orders must reduce stock only when appropriate based on order status/business rules.

### Acceptance Criteria
- Stock quantity is accurate.
- Stock is not guessed manually where transaction data exists.
- Admin product list, product details, and public product availability use the same stock source.

---

## 11. Prevent Orders When Stock Is Too Low or Out of Stock
Customers should not be able to order products that do not have enough stock.

### Required Behavior
- If stock is `0`, disable ordering/add-to-cart/checkout for that product.
- If requested quantity is greater than available stock, block the action and show a clear message.
- If stock is less than minimum stock, notify admin.

### Acceptance Criteria
- Out-of-stock products cannot be ordered.
- Quantity greater than available stock cannot be ordered.
- Backend validates stock, not only frontend.
- User sees clear feedback.

---

## 12. Low Stock Notification for Admin
When stock falls below the product’s minimum stock level, send/create a dashboard notification for administrators/managers.

### Required Behavior
- Notification category/type: `low_stock`
- Message example: `Low stock alert: [Product Name] has only [quantity] items remaining.`
- Notification should link to the product details page.
- Avoid duplicate spam notifications for the same product unless stock changes meaningfully or previous notification is cleared/resolved.

### Acceptance Criteria
- Admin receives low stock notification.
- Notification links to product details.
- Duplicate notification spam is avoided.

---

# Phase 5 — Public Website UX Improvements

## 13. Improve Hero Slider Transition Animation
Current slider transition looks common/basic. Improve the transition to feel more premium, smooth, and convincing for customers.

### Suggested Direction
Use a polished transition such as:
- Smooth fade + subtle zoom/pan
- Crossfade with luxury easing
- Soft parallax movement
- Ken Burns effect with controlled motion

Avoid overly flashy animations.

### Acceptance Criteria
- Slider transition feels premium and smooth.
- Performance remains good on desktop and mobile.
- Images remain sharp and layout does not jump.
- Animation fits luxury e-commerce brand style.

---

## 14. Improve Heart/Like Button Animation and Toggle Behavior
Currently the heart/like button is not convincing and only likes without unlike. Improve it.

### Required Behavior
- Clicking heart toggles like/unlike.
- Liked state uses brand color `#b80049`.
- Add a beautiful micro-animation on like, such as pop/bounce, small particles, or smooth fill animation.
- Unlike should also animate subtly.
- Optional: add a very soft sound only if it does not annoy users and can be disabled/muted. Prefer animation first over sound.

### Acceptance Criteria
- First click likes product.
- Second click unlikes product.
- Animation is smooth and premium.
- State persists correctly if the system supports logged-in users.
- Works well on mobile and desktop.

---

# Phase 6 — Role-Based Dashboard Improvements

## 15. Improve Dashboard/Muhtasari Based on Role and Permissions
Currently the dashboard shows stats like **Mauzo Yote**, **Oda zote**, **Wateja amilifu**, and **Utendaji wa Bidhaa** to all users. This may expose information to users who do not have permission.

### Required Behavior
Redesign dashboard content based on role and permissions.

Examples:
- Admin/Manager with sales/order/product permissions: can see global business stats.
- Staff without sales permission: should only see allowed operational summaries.
- Customer/user account: should see personal dashboard only, e.g. own orders, own profile, own wishlist/likes.

### Permission Rules
- If user cannot view orders, hide order stats.
- If user cannot view sales/revenue, hide revenue stats.
- If user cannot view products, hide product performance table.
- Backend/API must also prevent unauthorized stats access.

### Product Performance Table Improvement
In **Utendaji wa Bidhaa**, the **Hali ya Stoo** should show actual stock quantity, not text like `Ipo`.

Example:
```text
Product A | 15
Product B | 2
```

### Acceptance Criteria
- Dashboard content changes based on role/permissions.
- Users do not see unauthorized business metrics.
- Product performance stock column shows quantity number.
- Backend protects stats endpoints/server actions.

---

# Phase 7 — Modern Login Page and Password Reset Request Workflow

## 16. Redesign Login Page to Modern E-Commerce Style
Current login page looks too basic/common. Redesign it with a modern, premium e-commerce feel that matches Kalour Beauty Empire.

### Design Direction
- Clean modern layout, not complicated.
- Premium luxury feel using brand color `#b80049` carefully.
- Inputs should look normal/modern; remove heavy brand-color outlines.
- Add a visual panel or content area that promotes what the platform offers.
- Optional: include a small dashboard/mockup preview or feature highlights such as products, orders, stock, customers, reports.
- The page should feel convincing and professional for an e-commerce admin/system login.

### Acceptance Criteria
- Login page looks modern and premium.
- Inputs are clean and not over-outlined with brand color.
- Responsive design works on desktop and mobile.
- Login flow still works.

---

## 17. Build Notification System Foundation
Implement a dashboard notification system that can support password reset requests, low stock alerts, and future action-based notifications.

### Notification Features
- Store notifications in database.
- Categories/types such as:
  - `password_reset_request`
  - `low_stock`
  - `system`
  - `order`
  - `user`
- Notification status:
  - unread/read
  - resolved/unresolved where action is required
- Ability to view all notifications.
- Ability to filter by category/type/status/user.
- Ability to click a notification and open a related details page.
- Ability to clear notifications from dashboard.
- Ability for authorized admin to permanently delete/clear notifications at database level.
- Popup/toast or bell indicator in admin dashboard for new notifications.

### Acceptance Criteria
- Notification model/table exists.
- Admin dashboard shows notification bell/list.
- Notifications can be categorized and filtered.
- Notifications can link to related resources.
- Admin can mark read, clear, or delete where permission allows.

---

## 18. Add User Communication Preferences
Users should be able to choose their default communication channel in their profile.

### Supported Channels
- Dashboard notification
- Email
- WhatsApp

### Required Profile Fields
Add fields depending on existing schema:
- `default_communication_channel`
- phone/WhatsApp number if not already available
- email already likely exists

### Acceptance Criteria
- User can set preferred communication channel.
- Admin can see the preference on user details.
- Password reset messaging can use this preference.

---

## 19. Add Message Template System for Communication Channels
Create reusable templates for system messages, especially password reset messages.

### Template Types
- Email password reset template
- WhatsApp password reset template
- Dashboard notification template
- Low stock notification template

### Required Behavior
- Admin can choose a template when preparing a message.
- Templates can include placeholders like:
  - `{user_name}`
  - `{email}`
  - `{temporary_password}`
  - `{login_url}`
  - `{product_name}`
  - `{stock_quantity}`

### Acceptance Criteria
- Templates exist and are reusable.
- Placeholders are replaced correctly.
- Password reset template is ready for email/WhatsApp sending or copying.

---

## 20. Implement “Forgot Password” as Admin-Handled Reset Request
Add a **Forgot Password** feature on the login page, but instead of directly emailing a reset link, the system should create a password reset request notification for admin.

### User Flow
1. User clicks **Forgot Password**.
2. User enters email or username.
3. System creates a `password_reset_request` notification for admin.
4. User sees message like:
   `Password reset request has been sent. Please wait while the administrator processes your request.`

### Admin Flow
1. Admin receives dashboard notification.
2. Admin opens notification.
3. Notification links to the specific user details page.
4. Admin can view useful user information:
   - user personal details
   - email
   - phone/WhatsApp
   - default communication channel
   - login attempt history if available
   - last password change date if available
   - previous reset status if available
5. Admin clicks **Reset Password**.
6. System generates a secure temporary password.
7. User account is flagged as `password_reset_required` or equivalent.
8. Admin can copy the generated password and send it using email or WhatsApp template.
9. On next login, user is forced to change password.

### Security Notes
- Store hashed temporary password only; never store plain password permanently.
- Show temporary password only immediately after generation if needed for admin copy.
- Log the reset action.
- Require permission to reset passwords.

### Suggested Permissions
- `users.resetPassword`
- `notifications.view`
- `notifications.manage`

### Acceptance Criteria
- Forgot password creates admin notification.
- User gets request-sent confirmation.
- Admin can process reset request from notification/user details.
- Temporary password is generated securely.
- User must change password after login.
- Reset action is logged.

---

## 21. Add Admin Reset Password Action from User List
In the user list table action menu, add **Reset Password** for users where admin has permission.

### Required Behavior
- Admin can reset a specific user password directly from user list/details page.
- The system generates a temporary password.
- The user is flagged to change password on next login.
- Admin can copy/send message using selected communication template/channel.

### Acceptance Criteria
- Reset Password action appears in user table three-dot menu.
- Permission check is enforced.
- Temporary password flow works.
- User is forced to change password on next login.

---

# Final Testing Checklist
After completing all phases, test:

1. Login page on desktop and mobile.
2. Forgot password request flow.
3. Admin notification bell/list/details.
4. Admin reset password from notification and from user list.
5. Forced password change after reset.
6. Dashboard permissions for admin, manager, staff, and customer/non-manager user.
7. Product list stock column display.
8. Product details page.
9. Product permanent delete vs soft delete/hide behavior.
10. Product color creation/editing and public filtering.
11. Price range filtering.
12. WYSIWYG description create/edit/render.
13. Inventory stock calculation.
14. Order blocking when stock is low/out of stock.
15. Low stock notification.
16. Slider transition animation.
17. Heart like/unlike animation.
18. Standard action menu across all admin tables.

---

# Important Delivery Requirement
When you finish each phase, briefly report:
- What files/components you changed.
- What behavior was added or fixed.
- How to test it.
- Any migration/seeding command needed.
- Any risk or follow-up recommendation.

Start with Phase 1 and continue sequentially until all phases are complete.

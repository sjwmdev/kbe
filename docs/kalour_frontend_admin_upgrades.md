# Kalour Beauty Empire: E-commerce Layout \& Dashboard Upgrades

## Overview

We need to drastically improve the frontend to mimic the layout and functionality of top-tier e-commerce platforms like Amazon. The design must be clean, without gradients, using a white background, and strictly professional. Additionally, the Admin Dashboard must be upgraded to a premium, scalable layout to manage all these new frontend features effortlessly.

Please execute the following tasks **ONE BY ONE**. Stop and wait for my approval after completing each task.

## Task 1: Navigation Bar (Header) Overhaul

* **Remove Categories:** Remove the category links ("Manukato", "Vipodozi", "Viatu") from the top navigation bar.
* **Add Static Pages:** Replace them with links to "About Us" and "Contact Us".
* **Styling:** Make the Navbar extremely clean, well-spaced, and attractive, ensuring the search bar and theme toggle are perfectly aligned.

## Task 2: Left Sidebar Navigation (Amazon Style)

* **Persistent Sidebar:** Create a left-hand vertical sidebar menu on the Home Page and Search Results page.
* **Filtering Options:** This sidebar should house the Categories (Perfumes, Cosmetics, Shoes) and placeholder sections for filtering by Price range, Color, and Size.
* **Layout Shift:** The main content (Slider and Product Grid) should sit to the right of this sidebar on desktop views.

## Task 3: Hero Slider Simplification

* **Pure Image Slider:** Redesign the slider to be a simple, clean image banner.
* **Remove Clutter:** Remove all text overlays, CTA buttons, badges, and gradient designs from the slider itself.
* **Controls:** Only keep minimal Previous/Next arrows and active dot indicators.
* **Functionality:** The slider image will act as a promotional poster. Make the entire image clickable. When clicked, it should route the user to a search/filter result page for that specific promotion (e.g., clicking a cosmetics poster filters the view to show all cosmetics). Use a high-quality placeholder image with a widescreen aspect ratio for now.

## Task 4: Product Cards \& Grid Redesign

* **Grid Layout:** Position the product grid immediately below the Hero Slider. Ensure it displays 3 cards per row on large screens.
* **Card Styling:** Remove all gradients. Use a solid white background with clear, dark text.
* **Image Fitting:** Product images must fit perfectly within their container. **Remove rounded corners** on the product images (sharp, standard e-commerce look). Ensure the image is fully visible without awkward cropping.
* **Typography:** Make the product name and price clear, readable, and appropriately sized (not too large, medium/small professional text).
* **Remove Old Sections:** Completely remove the "Bidhaa Zinazopendwa Zaidi" (Most Liked) section from the Home Page.

## Task 5: Product Details Page \& Related Products

* **Like Button Redesign:** Remove the massive full-width rounded "Like" button. Replace it with a clean, standard, well-placed Heart icon/button (e.g., near the price or title) that shows the like count.
* **Related Products Section:** Add a "Related Products" grid at the very bottom of the Product Details page. This should fetch products from the same category. Clicking a related product should open its respective details page.

## Task 6: Admin Dashboard Scalability \& Feature Management

* **Mimic Premium Design:** Upgrade the Admin Dashboard UI to match the clean, professional, and scalable design standard provided in my reference image.
* **Content Management:** Add capabilities for the admin to effortlessly manage frontend content:
* Manage static page content (About Us, Contact, Privacy).
* Manage Slider Posters (Upload widescreen images and set the category link/URL they point to).
* Manage global website settings.
* Ensure the Admin retains full CRUD capabilities for products with the new image cropping features previously discussed.


\## Task 7: Branding \& Smooth UI Polish (Lightweight)
\* \*\*Logo Integration:\*\* Replace the text "Kalour" in the Navbar and Admin Sidebar with our actual brand logo located at `D:\\Dev\\kbe\\img\\Logo.png`. Remove the word "Empire" entirely, so the brand displays as "\[Logo] Beauty". Ensure the logo renders in high quality (consider converting to SVG behavior or optimizing the PNG) and is perfectly visible in both Light and Dark modes.

\* \*\*Favicon:\*\* Generate and apply a high-quality `.ico` favicon derived from the logo for the website.

\* \*\*Smooth Theme Switcher:\*\* Refactor the Dark/Light mode toggle to transition smoothly (fade effect) without sudden, jarring flashes.



\## Task 8: Interactive Feedback Components - Modals \& Toasts (Lightweight)
\* \*\*Reusable Confirm Modal:\*\* Completely remove any native JavaScript `confirm()` dialogs across the Admin Dashboard. Implement a standardized, beautifully designed reusable "Confirm/Cancel" modal component for all delete actions.

\* \*\*Advanced Toast Notifications:\*\* Upgrade the current toast notifications. They should mimic the interactive, animated feel of `SweetAlert`. Use our brand colors (e.g., `#b80049` or `#8f003d`) for design consistency. Ensure they smoothly animate in, display loading states when processing, show success/error clearly, and smoothly animate out.



\## Task 9: Advanced Loading States \& Transitions (Medium)
\* \*\*Skeleton Loaders:\*\* Implement Skeleton loading screens for all product cards, image galleries, and data tables while network requests are pending.

\* \*\*Page Transitions:\*\* Add a smooth, minimal top-bar loader or elegant full-page transition loader for navigating between frontend pages and dashboard routes.

\* \*\*Upload Animations:\*\* Add smooth progress indicators/spinners during media or image uploads in the admin panel to provide real-time feedback.



\## Task 10: Admin Profile \& Custom Error Pages (Medium)
\* \*\*User Profile Management:\*\* Create a Profile section in the Admin Dashboard (accessible via a placeholder avatar on the sidebar). Allow the logged-in user to update their Name, Email, and Password securely.

\* \*\*Custom Error Pages:\*\* Implement highly reusable, beautifully designed error pages (403 Forbidden, 404 Not Found, 500 Internal Error, etc) across both the frontend and backend to gracefully handle unauthorized access or missing resources.



\## Task 11: Access Control List (ACL) - Roles \& Permissions (Heavy)
\* \*\*Role Management:\*\* Build a CRUD interface to manage Roles (e.g., SuperAdmin, Manager, Editor etc).

\* \*\*Permission Assignment:\*\* Create a clean, minimalist UI (no cluttered icons) using a slide-down/accordion layout to group permissions by module likes users, products, roles, media etc. Use simple checkboxes to attach or detach permissions to specific roles.

\* Ensure this data is securely synced with the Go backend via Clean Architecture endpoints.



\## Task 12: User Management \& RBAC Enforcement (Heavy)

\* \*\*User CRUD:\*\* Build a User Management page to Add, Edit, Delete, and toggle users (Active/Inactive). Assign roles to users here.

\* \*\*Secure Authentication:\*\* Change the login system to strictly use Email and Password (remove username login). Add robust error handling to prevent brute-force attacks.

\* \*\*Password Policies:\*\* On user creation, set a default password. If a user logs in with a default or admin-reset password, intercept the session and force them to change their password before accessing the dashboard featues (here can show only dashboard but disabled features only show alert message change password before continue or any user full message and can click the link and change after that change enable the hidden or blur pages or features).

\* \*\*UI/API Enforcement:\*\* Enforce Role-Based Access Control (RBAC). Hide sidebar links and action buttons if the user lacks permissions.

\* \*\*Data Isolation:\*\* Managers should only see and edit products they created. SuperAdmin sees all products. Add metadata columns to the product table (`created\_by`, `created\_at`, `updated\_at`). Ensure the product table handles large datasets with proper Pagination and responsiveness.



\## Task 13: Advanced Media \& Gallery Management (Heavy)

\* \*\*Media Library Page:\*\* Create a dedicated "Media" page in the admin dashboard. Allow organizing images into folders/categories with breadcrumb navigation.

\* \*\*Bulk Actions:\*\* Implement a grid gallery view. Add checkbox selection for images to allow bulk deletion, alongside a hover-to-delete option for individual files.

\* \*\*Product Integration:\*\* In the Product Creation form, allow the admin to either upload a new image from their computer OR click "Import from Media" to select an existing image from the Media folders.

\* \*\*Enhanced Cropper:\*\* Upgrade the image cropper tool. Ensure the cropping slider is ultra-smooth without delay. Add a `21:9` widescreen aspect ratio option. \*Optional: If feasible, integrate a basic background removal utility.\*



\## Task 14: System Audit Logs (Heavy)

\* \*\*Tracking:\*\* Implement an Audit Log system in the Go backend to track system performance, user logins, and critical actions (who did what, and when).

\* \*\*Log Management:\*\* Create a dashboard view for the Audit Logs. Ensure this page is STRICTLY accessible only to the SuperAdmin role. Allow the SuperAdmin to view and clear logs.


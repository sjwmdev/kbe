Kalour Beauty Empire E-Commerce Platform: Technical Implementation Plan (Shorter project name is kbe shorter for Kalour Beauty Empire) 
1. Project Overview & Context

This project involves building an elegant, highly performant e-commerce website for a business dealing in luxury cosmetics, signature perfumes, and shoes in Dar es Salaam, Tanzania. The business sources products from Zanzibar and aims to transition from an Instagram-only model to a professional web presence.
The business owner is non-technical, so the admin interface must be exceedingly simple, clean, and intuitive. The customer-facing site must prioritize visual luxury, mobile responsiveness, and direct integration with WhatsApp for sales conversions, accommodating the local consumer behavior where conversational commerce is preferred over immediate credit card checkout.
2. UI/UX & Brand Guidelines

    Color Scheme: Minimalist dual-tone luxury approach.

        Primary Background: Deep Black (#050505 or #000000) to emphasize premium quality and luxury.

        Accent Color: Vibrant Red/Pinkish-Red (e.g., #E63946) to highlight Call-To-Action (CTA) buttons, prices, and interactive elements.

    Typography: Use modern, highly readable sans-serif fonts (e.g., Inter, Poppins, or Montserrat). Implement large, bold text for product names, pricing, and main headings to ensure readability across all mobile devices.

    Product Display:

        High-quality image gallery for each product.

        Interactive image manipulation: Include Zoom on hover and Rotate/Swipe functionalities for multiple angles to build trust.

        A prominent Heart/Like button associated with each product displaying the total count of people who liked the product to create social proof.

    Contact/Checkout Flow (Phase 1):

        There is no traditional shopping cart. The primary CTA on every product detail page is a dynamically generated WhatsApp button.

        The button must redirect to: https://wa.me/<BUSINESS_NUMBER>?text=<DYNAMIC_URL_ENCODED_MESSAGE>

        The dynamic message should read (in Swahili): "Habari! Nimeipenda hii bidhaa [Product Name]. Je naweza pata punguzo au naweza ipata je?"

3. Technology Stack

    Frontend (Client UI & Admin Dashboard): React, Vite, Tailwind CSS, TypeScript.

    Backend (API): Go (Golang) following strict Clean Architecture principles.

    Database: PostgreSQL.

4. Backend Architecture (Go - Clean Architecture)

The backend must strictly adhere to Clean Architecture principles to ensure scalability and maintainability. Structure the code into the following directories:

    /cmd/api: Main application entry point, server initialization, and dependency injection wiring.

    /internal/domain: Core entities (User, Product, ProductImage, ProductLike) and interface definitions (Ports).

    /internal/usecase: Application business logic (CRUD operations for products, authenticating admin, handling likes).

    /internal/repository: PostgreSQL implementation of the data layer interfaces.

    /internal/delivery/http: REST API handlers, routing, and middleware for JWT authentication.

Required Endpoints (API V1):

    GET /api/v1/products: Fetch all active products (with primary image and like count).

    GET /api/v1/products/:id: Fetch product details (with full image gallery).

    POST /api/v1/products/:id/like: Increment the like count for a specific product.

    POST /api/v1/admin/login: Admin authentication returning a JWT.

    POST /api/v1/admin/products: Create a new product (Protected Route).

    PUT /api/v1/admin/products/:id: Update product details (Protected Route).

    DELETE /api/v1/admin/products/:id: Soft delete a product (Protected Route).

    POST /api/v1/admin/upload: Upload product images (Protected Route).

5. Admin Dashboard Requirements

    Secured via JWT token stored securely in HTTP-only cookies or local storage.

    A minimalist dashboard displaying all products in a structured table or grid format.

    Intuitive forms for creating and editing products (Fields: Name, Category [Perfume, Cosmetics, Shoes], Price, Description).

    Image upload handler capable of receiving multipart/form-data with automatic client-side or server-side resizing.

    Clear, distinct login and logout functionality with appropriate visual feedback.

6. Execution Instructions for Claude Code Agent

Hello Claude. You are acting as the Lead Full-Stack Technical Architect and Senior Developer for this project. Please read this entire document to fully understand the context, business constraints, and architectural requirements.

Execute the implementation iteratively using the following phases. CRITICAL INSTRUCTION: DO NOT proceed to the next phase until I explicitly review and approve the output of the current phase. Wait for my confirmation after each phase is completed.
Phase 1: Project Setup and Backend Initialization (Go & Postgres)

    Initialize a Go module (go mod init backend).

    Create the exact Clean Architecture folder structure (cmd, internal/domain, etc.).

    Define the domain entities (User, Product, ProductImage, ProductLike) and write the SQL migration scripts for PostgreSQL.

    Set up the database connection utility and basic CRUD repositories in /internal/repository.

    Pause and wait for my review.

Phase 2: Backend API, Authentication & Use Cases

    Implement the JWT authentication system and middleware in /internal/delivery/http.

    Build the Use Cases and HTTP handlers for the Admin product management operations.

    Build the public HTTP handlers for fetching products and handling the 'Like' system logic.

    Wire everything together in /cmd/api/main.go and ensure the API runs on a specified port.

    Pause and wait for my review.

Phase 3: Frontend Setup & Customer UI (React & Tailwind)

    Initialize a React+Vite+TypeScript project (frontend) and configure Tailwind CSS.

    Build the main layout and apply the dual-tone luxury color scheme (Black background, Red/Pink accent).

    Implement the Product Listing Page using large typography and attractive cards.

    Implement the Product Details Page featuring the image gallery (with zoom/rotate features), the social proof Like/Heart system, and the dynamic URL-encoded WhatsApp integration button.

    Pause and wait for my review.

Phase 4: Admin Dashboard Implementation

    Implement the secure admin login route and JWT state management using React Context or similar state manager.

    Build the clean, minimalist dashboard layout tailored for a non-technical user.

    Create the CRUD interfaces (forms and tables) for managing products and uploading multipart images.

    Finalize routing protection and access control.

    Provide instructions on how to run and test both frontend and backend concurrently.

Please acknowledge your complete understanding of this architectural plan and begin executing Phase 1 immediately.
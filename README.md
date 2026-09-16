# BazaarNile

AI-powered multi-vendor marketplace. Phases 1–5 are live: authentication, shopping, inventory-safe ordering with customer tracking, Seller Center analytics, an Admin Panel, and personalized product recommendations learned from customer browsing behavior.

## Stack

- React, TypeScript, Vite, Tailwind CSS, shadcn-style UI, TanStack Query, React Router, Motion
- Node.js, Express, TypeScript, Zod
- PostgreSQL, Prisma ORM
- JWT access tokens, rotating refresh tokens, bcrypt
- Gemini 3.6 Flash product and cart summaries

## Run locally

```bash
cp .env.example .env
npm install
npm run db:generate
npm run db:migrate
npm run db:seed
npm run dev
```

The storefront runs at `http://localhost:5173` and the API at `http://localhost:4000`.

## Phase roadmap

1. Core marketplace (complete)
2. Cart, wishlist, checkout, and orders (complete)
3. Seller Center, inventory, product CRUD, and analytics (complete)
4. Admin panel, order and user management, moderation, and marketplace analytics (complete)
5. AI recommendations (complete)
6. Conversational product assistant
7. Visual search
8. Multi-vendor expansion, notifications, coupons, and advanced analytics

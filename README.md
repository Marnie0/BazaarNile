# BazaarNile

AI-powered multi-vendor marketplace. Phases 1–8 are live: authentication, shopping, inventory-safe ordering, multi-vendor Seller Center, admin control, personalized recommendations, Gemini shopping tools, visual search, coupons, notifications, and advanced analytics.

## Stack

- React, TypeScript, Vite, Tailwind CSS, shadcn-style UI, TanStack Query, React Router, Motion
- Node.js, Express, TypeScript, Zod
- PostgreSQL, Prisma ORM
- JWT access tokens, rotating refresh tokens, bcrypt
- Gemini 3.6 Flash summaries and shopping assistant; Gemini 3.5 Flash-Lite visual search

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
6. Conversational product assistant (complete)
7. Visual search (complete)
8. Multi-vendor expansion, notifications, coupons, and advanced analytics (complete)

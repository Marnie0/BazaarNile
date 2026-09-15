# BazaarNile

AI-powered multi-vendor marketplace. This repository currently contains the Phase 1 foundation: authentication, catalog, categories, search, public profiles, and the PostgreSQL data model.

## Stack

- React, TypeScript, Vite, Tailwind CSS, shadcn-style UI, TanStack Query, React Router, Motion
- Node.js, Express, TypeScript, Zod
- PostgreSQL, Prisma ORM
- JWT access tokens, rotating refresh tokens, bcrypt

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

1. Core marketplace (current)
2. Cart, wishlist, checkout, and orders
3. Seller Center
4. Admin panel
5. AI recommendations
6. Conversational product assistant
7. Visual search
8. Multi-vendor expansion, notifications, coupons, and advanced analytics


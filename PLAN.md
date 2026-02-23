ARSHBOOST - PROJECT PLAN & ROADMAP

Project Overview

Arshboost is a high-performance, SEO-optimized, and minimalist in-game boosting service platform.

MVP (Minimum Viable Product)

Next.js 15 (PPR), Tailwind CSS, Shadcn UI, Supabase, Zustand, Iyzico (Payment infrastructure to be integrated last).

Performance (LCP < 1.2s), SEO (100 Score), Mobile-First UX.

Phase 1: Foundation & Environment
[x] Project Setup: Next.js 16.1.6, TypeScript (strict), ESLint — build ✓

[x] Styles & UI: Tailwind CSS v4 + Shadcn UI (new-york style) — Button, Input, Card, Badge, Separator, Avatar installed.

[x] Design Tokens: Black/White brand palette active via Shadcn CSS variables. Inter font via next/font/google (display: swap).

[x] Project Structure: src/app/, src/components/ui|shared|features/, src/lib/, src/hooks/, src/types/ — all created per GUIDELINES.md.

[x] Supabase Setup: @supabase/supabase-js + @supabase/ssr installed. Browser client (src/lib/supabase/client.ts), Server client (src/lib/supabase/server.ts), and proxy.ts (Next.js 16 auth middleware) configured. .env.local.example created.

Additional:
[x] src/types/index.ts — Strict TypeScript interfaces for Profile, Game, GameService, Order, ChatMessage, OrderFlowState.
[x] src/types/database.ts — Supabase Database generic type scaffold (to be replaced by CLI-generated types).
[x] src/lib/stores/order-flow.ts — Zustand store with persist middleware for single-page order flow (Phase 10 prep).

Phase 2: Database Schema & Logic
[ ] Schema Design: - profiles: User roles (Admin, Booster, Client, Support).

games_services: Games and associated services (Rank Boost, Win Boost, Duo Boost, Placement Matches, Unrated Matches).

orders: Order status, pricing, and metadata.

[ ] Price Calculator: Dynamic price calculation functions (Server-side logic).

[ ] SEO Infrastructure: Dynamic Metadata API and JSON-LD (Schema.org) structure.

Phase 3: Core Features & UX
[ ] Landing Page Section: High-conversion, SEO-compliant landing page entry. Generating UX/UI code strictly according to the provided design. Implementing the "single-page" experience allowing users to complete the entire order process without page refreshes.

[ ] Game Selection UI: Fluid and fast game/service selection interface.

[ ] Booking Step: Mobile-first form structure for gathering game information from the user.

[ ] Dashboards: - Client: Order tracking, live chat usage, ability to issue order commands (if a dispute is declared, support connects to view chat history; order cancellation, order completion) and access to live support.

Booster: Viewing new jobs, ability to request jobs, chat within the client-support-booster chain, sending photos to live chat, and updating order status.

Phase 4: Payments & Real-time
[ ] Iyzico Integration: Payment Intent and Webhook management.

[ ] Real-time Engine: Instant reflection of order status changes via Supabase Realtime.

[ ] Notifications: Email/system notifications for order confirmation, cancellation, dispute declaration, and completion.

Phase 5: Testing & Launch
[ ] Performance Audit: Vercel speed tests and Lighthouse optimization.

[ ] Security: Activation of Row Level Security (RLS) policies on Supabase.

[ ] Final Mobile Audit: Final testing of the entire flow (including checkout) on 375px width.

[ ] Deployment: Final production release.
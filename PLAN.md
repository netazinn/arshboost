ARSHBOOST - PROJECT PLAN & ROADMAP

Project Overview

Arshboost is a high-performance, SEO-optimized, and minimalist in-game boosting service platform.

MVP (Minimum Viable Product)

Next.js 15 (PPR), Tailwind CSS, Shadcn UI, Supabase, Zustand, Stripe (Payment infrastructure to be integrated last).

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
[x] Schema Design:
    - supabase/migrations/20260223000001_core_schema.sql — profiles (roles), games, games_services, orders, chat_messages. Enums: user_role, service_type, order_status. Auto-triggers for handle_new_user + set_updated_at. Indexes on client_id, booster_id, status.
    - supabase/migrations/20260223000002_rls_policies.sql — RLS enabled on all tables. Role-based policies: client (own), booster (job board + assigned), support (read-all + dispute write), admin (full).
    - supabase/seed.sql — Development seed: League of Legends, Valorant, TFT with all service types.

[x] Price Calculator: src/lib/price-calculator.ts — Server-side only. Handles rank_boost (per-tier multiplier), win_boost / placement_matches / unrated_matches (per-game rate), duo/priority/VPN/offline-mode surcharges. Strict types, no `any`. formatPrice() utility included.

[x] SEO Infrastructure:
    - src/lib/seo.ts — buildMetadata() helper for consistent Metadata objects across all pages.
    - src/components/shared/JsonLd.tsx — JsonLd RSC + builders: buildWebSiteSchema, buildOrganizationSchema, buildServiceSchema, buildFaqSchema.
    - layout.tsx — WebSite + Organization JSON-LD injected globally.

[x] Tests: src/lib/__tests__/price-calculator.test.ts — 16 Vitest tests (all pass). Covers all service types, all surcharges, stacking, edge cases, rounding.

Phase 3: Core Features & UX
[x] Landing Page Section: High-conversion, SEO-compliant landing page at localhost:3000. Single-page experience with game cards as entry point to the order flow.

[x] Game Selection UI: Game cards on landing page serve as the selection UI. Single-page approach — clicking a card scrolls into the order configurator inline.

[x] Booking Step: Valorant-only launch. ValorantRankBoost order configurator: rank selection, RR input, queue/options, price calculator, checkout → Supabase order creation. Immortal RR title generation handled.

[x] Dashboards (100% complete):
    [x] Client: Order list, order detail, live chat, login persistence (saved to DB), 3-state booster matching UX, bulk delete, Mark Completed tooltip, E2E data sync fixed (force-dynamic + booster join).
    [x] Booster: Job board, job detail + live chat, claim job, OrderActions (complete/dispute), sidebar rendering fixed ([object Object] bug resolved).
    [x] Real-time: Supabase Realtime subscriptions wired. Chat messages stream live (INSERT events on chat_messages). Order status changes (booster claim, complete, dispute) auto-refresh the client page via UPDATE events on orders. Optimistic send for text messages — message appears instantly, server action fires in background.

Phase 4: Payments & Real-time
[ ] Stripe Integration: Payment Intent and Webhook management.

[ ] Real-time Engine: Instant reflection of order status changes via Supabase Realtime.

[ ] Notifications: Email/system notifications for order confirmation, cancellation, dispute declaration, and completion.

Phase 5: Testing & Launch
[ ] Performance Audit: Vercel speed tests and Lighthouse optimization.

[ ] Security: Activation of Row Level Security (RLS) policies on Supabase.

[ ] Final Mobile Audit: Final testing of the entire flow (including checkout) on 375px width.

[ ] Deployment: Final production release.
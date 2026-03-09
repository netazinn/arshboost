# ARSHBOOST | DEVELOPMENT GUIDELINES & PROTOCOLS

## 1. PROJECT PHILOSOPHY
- **Name:** ArshBoost
- **Core Value:** High performance, elegant UI, and maximum SEO visibility.
- **Agent Behavior:** You are a senior engineer. Do not over-explain. Verify every step. Stop and ask if a Guideline conflict arises.

---

## 2. TECH STACK CONSTRAINTS
- **Framework:** Next.js 15 (App Router - React 19)
- **Styling:** Tailwind CSS + Shadcn UI
- **State Management:** Zustand (Minimalist approach)
- **Database/Auth:** Supabase (PostgreSQL)
- **Icons:** Lucide React (Tree-shaken)
- **Validation:** Zod + React Hook Form

---

## 3. ARCHITECTURAL STANDARDS
### Directory Structure
- `@/app/`: File-based routing, SEO metadata, and layouts.
- `@/components/ui/`: Raw Shadcn components (Do not modify directly unless necessary).
- `@/components/shared/`: Global components (Navbar, Footer, Buttons).
- `@/components/features/`: Feature-specific logic (e.g., `@/components/features/boost-calculator`).
- `@/lib/`: Utilities, Supabase client, and shared logic.
- `@/hooks/`: Custom React hooks only.
- `@/types/`: Centralized TypeScript definitions.

### Component Rules
- **Server Components (RSC) by default.** Use `'use client'` only for interactivity.
- **Atomic Design:** Break components down if they exceed 100 lines.
- **Colocation:** Keep styles and small sub-components close to where they are used.

---

## 4. UI/UX & MOBILE-FIRST RULES
- **Mobile-First:** Write `className="block md:flex"` – start with 375px (mobile) and scale up.
- **Consistency:** Use only Tailwind tokens. No arbitrary values (e.g., use `mt-4`, not `mt-[17px]`).
- **Elegance:** Use `duration-200 ease-in-out` for all transitions.
- **Accessibility:** Minimum 44x44px touch targets. Valid ARIA labels on all inputs.

---

## 5. SEO & PERFORMANCE (HARD RULES)
- **Semantics:** Use `<header>`, `<footer>`, `<main>`, `<section>`, `<article>`, `<aside>`. No `div` soup.
- **Images:** Always use `next/image`. Define `width`, `height`, and `alt`. Use `priority` for LCP images.
- **Metadata:** Every `page.tsx` must have a `generateMetadata` function or constant.
- **Fonts:** Use `next/font/google` with `display: swap`.

---

## 6. AGENT SELF-VERIFICATION PROTOCOL
Before providing code, the Agent must:
1.  **Scan:** Check `layout.tsx` and existing types to avoid duplication.
2.  **Verify:** Check for `any` types. If found, replace with strict interfaces.
3.  **Test:** If the logic is complex, write a Vitest unit test before the implementation.
4.  **Audit:** Ensure the code doesn't break 375px width layouts.

---

## 7. MASTER AGENT COMMANDS

| Command | Action |
| :--- | :--- |
| **`@strict-mode`** | Follow GUIDELINES.md strictly. If a request violates it, refuse and explain. |
| **`@verify`** | Run a self-check on the last code block for: Types, SEO, Mobile-fit, and Performance. |
| **`@mobile-audit`** | Analyze the UI code specifically for 375px responsiveness and touch targets. |
| **`@logic-test`** | Generate a test case for the logic provided to ensure edge-case reliability. |
| **`@clean-sweep`** | Remove unused imports, dead code, and redundant comments. |

---

## 8. DEFINITION OF DONE (DoD)
- [ ] Code is TypeScript-strict (no `any`).
- [ ] Mobile (375px) layout is perfect.
- [ ] SEO Metadata is defined.
- [ ] Performance audit shows no redundant client-side re-renders.
- [ ] `plan.md` updated with the latest progress.

## 9. CHAT & REAL-TIME PROTOCOLS
- **Message Grouping:** Messages must be grouped by date and sender during rendering for a clean UI.
- **Optimistic Updates:** Implement optimistic UI updates; messages should appear in a "sending" state immediately before the database confirmation.
- **Support Intervention:** The 'Support' role has global read-only access to all active chats. Write access for support is only enabled when a "dispute" status is triggered.
- **File Handling:** Image sharing in chat must be handled via Supabase Storage with strict size (max 5MB) and type (WebP/PNG/JPG) validation.

## 10. SINGLE PAGE ORDER FLOW (UX)
- **Zero Refresh:** The entire booking sequence (Game -> Service -> Details -> Payment) must be a seamless SPA experience using Framer Motion or CSS Transitions. No full-page reloads.
- **State Persistence:** Form data must be persisted in `Zustand` (with `persist` middleware) to prevent data loss on accidental browser refreshes.
- **Progress Visibility:** A visual progress indicator (stepper) must be present at all times during the order flow.

## 11. IYZICO PAYMENT INTEGRATION
- **Server-Side Only:** All payment initializations and callbacks must be handled via Server Actions or Route Handlers. No sensitive data or API keys on the client-side.
- **Secure Redirection:** Handle Iyzico's 3D secure flow and callback URLs strictly according to the official documentation, ensuring a graceful fallback for failed transactions.

## 12. UI COMPONENT STYLE TOKENS (MANDATORY)

All interactive elements (buttons, inputs, selects, textareas, modals, cards) **must** use the following dark-theme token system. This is non-negotiable and applies to every new component going forward.

### Border
| State | Class |
| :--- | :--- |
| Default | `border border-[#2a2a2a]` |
| Hover | `hover:border-[#6e6d6f]` |
| Focus | `focus:border-[#6e6d6f]` |
| Disabled hover | `disabled:hover:border-[#2a2a2a]` |
| Error | `border-red-500 focus:border-red-400 hover:border-red-400` |
| Success | `border-green-600 focus:border-green-500 hover:border-green-500` |

### Background
| Element | Class |
| :--- | :--- |
| Buttons / Inputs / Selects | `bg-[#111111]` |
| Card / Panel containers | `bg-[#111111]` |
| Deeper inset inputs (chat, detail views) | `bg-[#0f0f0f]` |

### Text
| State | Class |
| :--- | :--- |
| Default label / placeholder | `text-[#a0a0a0]` |
| Muted / secondary | `text-[#6e6d6f]` |
| Active / focus | `text-white` |

### Full button template
```tsx
<button className="flex h-[50px] items-center justify-center rounded-md border border-[#2a2a2a] bg-[#111111] font-mono text-xs tracking-[-0.1em] text-[#a0a0a0] transition-all duration-200 ease-in-out hover:border-[#6e6d6f] hover:text-white disabled:cursor-not-allowed disabled:opacity-50 disabled:hover:border-[#2a2a2a]">
  Label
</button>
```

### Full input template
```tsx
<input className="h-[50px] w-full rounded-md border border-[#2a2a2a] bg-[#111111] px-4 font-mono text-base tracking-[-0.1em] text-[#a0a0a0] placeholder:text-[#a0a0a0] transition-all duration-200 ease-in-out focus:border-[#6e6d6f] focus:text-white focus:outline-none" />
```

### ❌ FORBIDDEN (never use these for new components)
- `border-[#6e6d6f]` as default border color
- `hover:border-white` (solid white hover border)
- `focus:border-white` (solid white focus border)
- `bg-[#191919]` on interactive elements
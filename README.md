# Bowtie Risk Builder MVP

Next.js + TypeScript MVP for building Bowtie diagrams with guided structure, drag-and-drop editing, AI suggestion placeholders, Supabase auth/data, and Stripe subscription hooks.

## Implemented

- Supabase email/password auth with signup verification messaging.
- Three-tier account model support in settings and project limits:
  - `free`: 2 projects, BYOK
  - `pro`: unlimited, BYOK
  - `team`: unlimited, managed model placeholder
- Dashboard for creating/listing/opening projects.
- Public SaaS-style landing page (`/`) with:
  - hero + primary/secondary CTAs
  - problem/solution section
  - workflow steps
  - feature grid
  - trust/proof section
  - pricing + footer
  - explicit `Sign In` + `Sign Up` paths
- Project creation: `title + industry + top event + optional context`.
- Visual editor (React Flow) with:
  - 5-lane swimlane canvas (Threats, Preventive Barriers, Top Event, Mitigative Barriers, Consequences)
  - lane-locked node positioning (vertical movement allowed; nodes stay centered in lane)
  - block palette
  - pan/zoom
  - snap-to-grid
  - connect edges
  - context-aware quick-add (`+`) by node type
  - chain insertion logic for barriers:
    - `Threat -> Preventive Barrier -> Top Event`
    - `Top Event -> Mitigative Barrier -> Consequence`
    - repeated `Consequence + (left)` appends a serialized mitigative chain:
      - `Top Event -> MB1 -> MB2 -> ... -> Consequence`
    - mitigative swimlane expands horizontally to keep the chain in one line
  - escalation support flow:
    - barrier `+` creates escalation factor in the correct support side context
    - escalation factor `+` creates escalation factor control
    - support links rendered with distinct dashed styling
  - branch collapse/expand controls (mind-map style)
  - keyboard shortcuts:
    - `Ctrl/Cmd+C`, `Ctrl/Cmd+X`, `Ctrl/Cmd+V`
    - `Ctrl/Cmd+Z`, `Ctrl/Cmd+Shift+Z`, `Ctrl/Cmd+Y`
    - `Delete/Backspace` for selected nodes/edges
  - right inspector panel
  - AI action progress indicator ("AI is building suggestions") with bowtie-themed animation
  - autosave to Postgres via API
  - soft validation warnings
  - PNG export + JSON import/export
  - worksheet mode with structured 8-step bowtie procedure synced to Supabase
- Settings page:
  - encrypted server-side API key storage
  - explicit BYOK provider selection (auto/openai/openrouter/anthropic/gemini)
  - model selection placeholder for managed top-tier mode
- Stripe checkout session endpoint + webhook placeholder.
- Supabase SQL schema + RLS policies for:
  - `projects`
  - `nodes`
  - `edges`
  - `user_settings`

## Branding System

The app now uses a shared brand palette with CSS variables and reusable utility classes in `src/app/globals.css`.

### Palette

- Primary brand / main CTAs: `#325D88` (Slate blue)
- Header/nav/key text accents: `#1F2933` (Charcoal)
- Highlight/accent: `#D4A547` (Soft gold)
- Background base: `#F5F3F0` (Warm light grey)
- Panels/cards: `#E5E7EB` (Neutral light)
- Borders/UI chrome: `#9CA3AF` (Medium grey)
- Positive/status: `#4CAF50` (Soft green)
- Destructive/high risk: `#C7514A` (Muted red)

### Reusable classes

- `brand-page`: base app/marketing background + foreground
- `brand-card`: white surface + branded border
- `brand-panel`: neutral-light panel surface
- `brand-heading`: charcoal heading color
- `brand-text-muted`: muted body/supporting text
- `brand-btn-primary`: slate-blue primary CTA
- `brand-btn-secondary`: neutral secondary action
- `brand-accent-chip`: soft-gold accent badge/chip

### Usage guidance

- Use `brand-btn-primary` for primary conversion actions (Start Free Project, Sign Up, Subscribe).
- Use `brand-btn-secondary` for secondary actions (Sign In, View Example, Book Walkthrough).
- Use `brand-accent-chip` sparingly for key callouts only.
- Keep content surfaces on warm/neutral backgrounds to preserve scanability in worksheet and editor views.
- Preserve semantic bowtie node type colors for diagram readability (brand palette should not override hazard/control meaning).

## Auth Entry Paths

- `GET /login`: default login mode
- `GET /login?mode=signup`: opens auth form pre-set to signup mode

Landing CTAs now route users intentionally by intent:

- `Start Free Project` -> `/login?mode=signup`
- `Sign Up` -> `/login?mode=signup`
- `Sign In` -> `/login`

## Placeholder Areas (by design)

- Managed LLM mode for `$30` tier is scaffolded as a backend placeholder contract in `src/lib/ai/suggestions.ts`.
- Stripe webhook plan-sync logic is intentionally stubbed in `src/app/api/stripe/webhook/route.ts`.
- AI calls return deterministic fallback suggestions until provider integration is wired.

## Setup

1. Install dependencies:
```bash
npm install
```

2. Copy environment template and fill values:
```bash
cp .env.example .env.local
```

3. Run SQL in Supabase SQL editor:
- `supabase/schema.sql`

4. In Supabase Auth settings:
- enable email/password
- configure email confirmation flow
- set site URL / redirect URL

5. Run dev server:
```bash
npm run dev
```

## Recommended Next Steps

1. Add service-role secured model gateway for managed team plan inference and usage metering.
2. Add subscription status sync from Stripe webhook to `user_settings.plan_tier`.
3. Add role-based collaboration tables (`project_members`, invitations, permissions).
4. Add optional version snapshots (`project_snapshots`) for rollback/history.

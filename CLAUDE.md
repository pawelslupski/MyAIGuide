# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project Overview

MyAIGuide — an AI-powered SPA that turns travel notes/preferences into structured day-by-day itineraries. Built with Vue
3 + TypeScript frontend and Supabase backend.

## Commands

```bash
npm run dev              # Start Vite dev server (port 5173)
npm run build            # Type-check (vue-tsc) then production build
npm run lint             # ESLint with --max-warnings=0
npm run lint:fix         # ESLint auto-fix
npm run format           # Prettier format all files

# Supabase (separate terminals)
supabase start
supabase functions serve generate-travel-plan --no-verify-jwt --env-file supabase/.env.local
```

Pre-commit hooks (Husky + lint-staged) run ESLint and Prettier on staged `.ts` and `.vue` files.

## Tech Stack

- **Frontend:** Vue 3.5 (Composition API, `<script setup>`), Vite 7, TypeScript 5.9, Pinia 3, Vue Router 4
- **UI:** shadcn-vue 2 (Radix Vue), Tailwind CSS 3 (class-based dark mode), lucide-vue-next icons
- **Validation:** Zod 4
- **Backend:** Supabase (PostgreSQL v17, Auth, Edge Functions on Deno 2, RLS)
- **AI:** OpenRouter.ai (claude-4.6-sonnet) called from Edge Functions

## Architecture

**Path alias:** `@/` → `./src/`

**Key layers:**

- `src/stores/*.store.ts` — Pinia stores (Composition API style): plan, trip, profile, quota
- `src/lib/services/*.service.ts` — Business logic: generation, trip
- `src/composables/use*.ts` — Vue composables (useTheme)
- `src/lib/errors/` — Standardized error factory functions
- `src/lib/validation/` — Zod schemas for API response validation
- `src/types.ts` — Central type definitions (DTOs, Commands, domain types)
- `src/db/supabase.client.ts` — Supabase client init; `database.types.ts` is auto-generated (gitignored)

**Data flow:** View → Pinia Store → Service → Supabase Client / Edge Function → Database / OpenRouter API

**Edge Function:** `supabase/functions/generate-travel-plan/` — Deno-based serverless function that calls OpenRouter API
with strict JSON schema enforcement, response normalization, and CORS handling.

**Planning docs:** `.ai/` directory contains PRD, tech stack, DB plan, API plan, and UI architecture docs (mostly in
Polish).

### Key Design Decisions

- **Trip status is derived, not stored:** Computed from `note_body` and `plan_json` presence (CREATED → DRAFT →
  CONFIRMED). No separate status column.
- **Plan candidate pattern:** Generated plans are held in memory (`plan.store`) until the user explicitly saves. Unsaved
  candidates are lost on page refresh.
- **Optimistic updates:** Trip store applies changes immediately and rolls back on error.
- **DTO convention:** Database/JSON uses `snake_case`, TypeScript uses `camelCase`. `plan_json` (JSONB column) is
  explicitly cast to typed `PlanJson`.
- **Generation quota:** Rolling 24-hour window tracked in `plan_generations` table (10 per user).
- **Language detection:** Simple regex heuristic (Polish characters → 'pl', else → 'en') — plan language matches note
  language.

## Conventions

- **Files:** `PascalCase.vue` components, `feature.store.ts` stores, `feature.service.ts` services, `useFeature.ts`
  composables
- **Code:** `camelCase` variables/functions, `PascalCase` types/interfaces, `SCREAMING_SNAKE_CASE` constants, `_prefix`
  for unused params
- **Database:** `snake_case` for table/column names; DTOs use `snake_case` in JSON, `camelCase` in TypeScript
- **Formatting:** No semicolons, single quotes, 100 char width, no trailing commas (Prettier config)
- **Linting:** `no-explicit-any` is off (needed for Supabase/AI DTOs), `vue/multi-word-component-names` is off

## Environment Variables

Frontend `.env`: `SUPABASE_URL`, `SUPABASE_ANON_KEY`
Edge Functions `supabase/.env.local`: `OPENROUTER_API_KEY`

## Routes

- `/` — DemoView (public)
- `/trips/:id` — TripDetailView (requires auth, validates positive integer ID)
- `/:pathMatch(.*)*` — 404

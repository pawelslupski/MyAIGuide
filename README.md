# MyAIGuide

> AI-powered travel planner that turns your rough notes into structured, day-by-day itineraries.

[![Vue 3](https://img.shields.io/badge/Vue-3.5-4FC08D?logo=vue.js)](https://vuejs.org/)
[![TypeScript](https://img.shields.io/badge/TypeScript-5.9-3178C6?logo=typescript)](https://www.typescriptlang.org/)
[![Supabase](https://img.shields.io/badge/Supabase-Backend-3ECF8E?logo=supabase)](https://supabase.com/)
[![Vite](https://img.shields.io/badge/Vite-7-646CFF?logo=vite)](https://vitejs.dev/)
[![License: MIT](https://img.shields.io/badge/License-MIT-yellow.svg)](LICENSE)

## Table of Contents

- [Project Description](#project-description)
- [Tech Stack](#tech-stack)
- [Getting Started Locally](#getting-started-locally)
- [Available Scripts](#available-scripts)
- [Project Scope](#project-scope)
- [Project Status](#project-status)
- [License](#license)

---

## Project Description

MyAIGuide is a single-page web application that helps users plan trips with minimal effort. The core idea is simple:
**one note = one trip = one AI-generated plan**.

Users write informal travel notes (destinations, ideas, constraints) and the app uses an AI model to produce a
structured, day-by-day itinerary tailored to their preferences. Plans are organized by time of day
(Morning / Afternoon / Evening) and include location names, activity descriptions, and category tags.

Key capabilities:

- **Global travel profile** — configure once: travelling with children, pets, dietary preferences, mobility
  constraints, and default travel style (pace, trip type, budget).
- **Per-trip preferences** — override defaults with trip-specific details: destination, number of people, trip
  duration, travel style.
- **AI plan generation** — one click sends notes + preferences to an AI model and returns a structured itinerary.
  Language of the plan automatically matches the language of the note.
- **Plan candidate workflow** — generated plans are held in memory for review and editing before being explicitly
  saved to the database.
- **Generation quota** — 10 AI generations per user per rolling 24-hour window with a live counter.

---

## Tech Stack

| Layer                | Technology                                           |
| -------------------- | ---------------------------------------------------- |
| Framework            | Vue 3.5 (Composition API, `<script setup>`)          |
| Language             | TypeScript 5.9                                       |
| Build tool           | Vite 7                                               |
| State management     | Pinia 3                                              |
| Routing              | Vue Router 4                                         |
| UI components        | shadcn-vue 2 (Radix Vue / Reka UI)                   |
| Styling              | Tailwind CSS 3                                       |
| Icons                | lucide-vue-next                                      |
| Validation           | Zod 4                                                |
| Backend              | Supabase (PostgreSQL 17 + Auth + Row Level Security) |
| Serverless functions | Supabase Edge Functions (Deno 2)                     |
| AI integration       | OpenRouter.ai (claude-sonnet-4-6 by default)         |
| Code quality         | ESLint 9, Prettier 3, Husky + lint-staged            |
| CI/CD                | GitHub Actions                                       |
| Hosting              | DigitalOcean (Docker)                                |

---

## Getting Started Locally

### Prerequisites

- **Node.js** ≥ 20 and **npm** ≥ 10
- **Supabase CLI** — [installation guide](https://supabase.com/docs/guides/cli)
- **Docker** — required by Supabase CLI for local development
- An **OpenRouter.ai** API key

### 1. Clone the repository

```bash
git clone https://github.com/your-username/my-ai-guide.git
cd my-ai-guide
```

### 2. Install dependencies

```bash
npm install
```

### 3. Configure environment variables

Create a `.env` file in the project root:

```env
VITE_SUPABASE_URL=http://localhost:54321
VITE_SUPABASE_ANON_KEY=<your-local-supabase-anon-key>
```

Create `supabase/.env.local` for Edge Functions:

```env
OPENROUTER_API_KEY=<your-openrouter-api-key>
```

### 4. Start Supabase locally

```bash
supabase start
```

The Supabase CLI will print your local URL and anon key — copy these into your `.env` file.

Apply any pending database migrations:

```bash
supabase db reset
```

### 5. Start the Edge Function

In a separate terminal:

```bash
supabase functions serve generate-travel-plan --no-verify-jwt --env-file supabase/.env.local
```

### 6. Start the development server

```bash
npm run dev
```

The app will be available at **http://localhost:5173**.

---

## Available Scripts

| Script             | Description                                                |
| ------------------ | ---------------------------------------------------------- |
| `npm run dev`      | Start the Vite development server on port 5173             |
| `npm run build`    | Type-check with `vue-tsc`, then produce a production build |
| `npm run preview`  | Serve the production build locally for preview             |
| `npm run lint`     | Run ESLint with zero-warning policy                        |
| `npm run lint:fix` | Run ESLint and auto-fix all fixable issues                 |
| `npm run format`   | Format all files with Prettier                             |

> Pre-commit hooks (Husky + lint-staged) automatically run ESLint and Prettier on staged `.ts` and `.vue` files.

---

## Project Scope

### In scope (MVP)

- Email and password authentication (register, login, logout, password recovery)
- Secure per-user data isolation via Row Level Security
- Account deletion with full data removal
- Global travel profile with preference toggles and defaults
- Full CRUD for trips and notes (max 10,000 characters per note)
- Per-trip preference overrides (destination, number of people, trip duration, travel style)
- AI-powered plan generation with structured JSON output
- Plan candidate workflow: generate → review → edit → save
- Generation quota: 10 generations per user per rolling 24-hour window
- Automatic plan language detection matching the note language _only PL/EN for now_

### Out of scope (post-MVP)

- Sharing or collaboration on plans between users
- Detailed logistics planning (exact times, reservations, bookings)
- Multimedia support (photos, maps)
- Multiple plan versions for a single trip
- Automatic retry and response streaming from the AI model
- Native mobile applications

---

## Project Status

**MVP — active development.**

The project is in MVP phase. Core features (auth, trip management, AI generation, plan saving) are implemented and
functional. Further iterations will focus on UX refinements and expanding features based on user feedback.

---

## License

This project is licensed under the [MIT License](LICENSE).

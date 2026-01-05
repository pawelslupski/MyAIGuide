# MyAIGuide

AI-powered web app for quickly turning travel notes and preferences into structured trip plans.

![Node.js version](https://img.shields.io/badge/node-24.11.1-339933?logo=node.js&logoColor=white)
![Vue 3](https://img.shields.io/badge/vue-3.5-42b883?logo=vue.js&logoColor=white)
![Project status](https://img.shields.io/badge/status-in%20development-yellow)

## Table of contents

1. [Project name](#myaiguide)
2. [Project description](#project-description)
3. [Tech stack](#tech-stack)
4. [Getting started locally](#getting-started-locally)
5. [Available scripts](#available-scripts)
6. [Project scope](#project-scope)
7. [Project status](#project-status)
8. [License](#license)

## Project description

MyAIGuide is a single-page web application (SPA) that helps you turn messy travel ideas into concrete, day-by-day itineraries. Each note represents exactly one trip and produces one structured plan in JSON format that you can review, edit and save.

The app solves the problem of collecting links, screenshots and random notes from many sources by letting you:

- Store potential trips as simple text notes.
- Define a global travel profile (e.g. travelling with kids, dietary needs, mobility limitations, pets).
- Fine-tune preferences per trip (what you want to see, pace, trip type, budget).
- Generate AI-powered daily plans from a single note plus your preferences.
- Review and adjust the generated plan before saving it.

Generated plans include a structured breakdown by day and time of day (Morning / Afternoon / Evening) with fields such as location name, description and category tags. The language of the plan matches the language of the note (automatic language detection, no manual language switch in the MVP).

## Tech stack

### Frontend

- Vue 3.5 (Composition API, `<script setup>`).
- Vite 7 as the dev server and bundler.
- TypeScript 5 for static typing.
- Vue Router for client-side routing.
- Pinia for state management (e.g. in-memory candidate plans, generation counters).
- Tailwind CSS 3 for utility-first styling.
- shadcn-vue for accessible, reusable UI components.

### Backend & database

- Supabase as the backend platform:
  - PostgreSQL as the primary relational database.
  - Row Level Security (RLS) to isolate data per user account.
  - Supabase Auth for email+password signup, login and session management.
  - Supabase Edge Functions for secure server-side AI calls and other business logic.

### AI integration

- OpenRouter.ai as a unified API over multiple AI providers (OpenAI, Anthropic, Google, etc.).
- All AI calls are performed from Supabase Edge Functions so API keys stay on the server.
- Ability to experiment with different models and set cost limits per API key.

### Tooling & developer experience

- Node.js `24.11.1` (managed via `.nvmrc`).
- ESLint 9 with TypeScript and Vue support.
- Prettier 3 with the Tailwind CSS plugin.
- Husky and lint-staged for pre-commit linting and formatting.
- vue-tsc for strict TypeScript type-checking of Vue components.
- Vite preview server for testing production builds locally.

### CI/CD & hosting

- GitHub Actions for continuous integration and deployment pipelines.
- DigitalOcean for hosting the application (e.g. via container image or App Platform).

For more details, see:

- Product Requirements (PRD, Polish): `.ai/prd.md`
- Tech stack document (Polish): `.ai/tech-stack.md`

## Getting started locally

### Prerequisites

- Node.js `24.11.1` (recommended: use `nvm` and run `nvm use` in the project root).
- npm (or another Node package manager of your choice).

### Installation

1. Install dependencies: `npm install`.
2. (Optional) Enable Git hooks by running `npm run prepare` once, which configures Husky.

### Environment configuration

This project is designed to work with Supabase and OpenRouter.ai. Before running the full stack, you will need:

- A Supabase project (URL and anon/public key).
- An OpenRouter API key with reasonable spending limits.

Create an `.env` file in the project root and configure the environment variables expected by the app for Supabase and OpenRouter. Check the Supabase client and Edge Functions code (for example in `src/lib/supabase` and `supabase/functions`) for the exact variable names once those parts of the project are implemented.

### Running the app in development

Start the Vite dev server:

- `npm run dev`

Vite will print the local development URL (typically `http://localhost:5173`).

### Building for production

To create an optimized production build:

- `npm run build`

To preview the built app locally:

- `npm run preview`

## Available scripts

All scripts are defined in `package.json`.

- `npm run dev` – start the Vite development server.
- `npm run build` – run TypeScript type-checking via `vue-tsc -b` and then build the production bundle with Vite.
- `npm run preview` – serve the contents of the production build locally.
- `npm run lint` – run ESLint on the entire project and fail on any warnings.
- `npm run lint:fix` – run ESLint with automatic fixes where possible.
- `npm run format` – format the codebase with Prettier (including Markdown and CSS).
- `npm run prepare` – configure Husky Git hooks (automatically run by package managers that support `prepare`).

Linting and formatting are also wired into `lint-staged`, so on each commit:

- `*.{ts,vue}` files are linted with ESLint and formatted with Prettier.
- `*.{js,ts,vue,json,css,md}` files are formatted with Prettier.

## Project scope

### In scope (MVP)

The MVP of MyAIGuide focuses on individual trip planning:

- **User accounts and security**
  - Email+password registration and login.
  - Access to notes, profile and plans only after authentication.
  - Strong isolation of data between user accounts.
  - Deleting an account permanently removes all notes and plans.

- **Global user profile**
  - Four main switches:
    - Travelling with children.
    - Travelling with pets.
    - Mobility limitations.
    - Dietary preferences.
  - Default travel style preferences:
    - What? (e.g. Nature, Culture/Museums, Beach/Relax, City Break, Foodie).
    - How fast? (Slow/Chill, Balanced, Intensive).
    - Type of trip (Base camp vs. Road trip).
    - Budget level (€ / €€ / €€€).
  - A profile completeness indicator (e.g. banner showing “profile complete / incomplete”).

- **Notes & trips**
  - Each note represents one trip.
  - Full CRUD operations on notes/trips.
  - Dashboard listing all trips, sorted by last modified date (descending).
  - Trip detail view with separate panels for the Note and the Plan.

- **Per-trip preferences**
  - Each trip can override the global defaults for:
    - What? (multi-choice categories).
    - How fast? (single-choice).
    - Type of trip (single-choice).
    - Budget (single-choice).
  - Saved per-trip preferences are used for subsequent plan generations.

- **AI-generated plans**
  - Plans are generated from:
    - A single note describing the trip.
    - The global profile.
    - Per-trip preferences.
  - Output is a structured JSON-like plan containing:
    - Day.
    - TimeOfDay (Morning / Afternoon / Evening).
    - LocationName.
    - Description.
    - CategoryTag.
  - The language of the plan matches the language of the note (automatic detection).
  - Note length validation:
    - Minimum: 1,000 characters to enable “Generate plan”.
    - Maximum: 10,000 characters; the generate action is disabled when exceeded.
  - Daily generation limit:
    - 10 generations per user in a rolling 24-hour window.
    - Visible counter such as `X/10 in the last 24 hours`.
    - The generate button is disabled with a clear message once the limit is reached.

- **Plan review, editing and saving**
  - New plans are initially stored only in memory as temporary candidates.
  - Users can review and edit the candidate (e.g. descriptions, activities) before saving.
  - Saving persists the candidate to the database and binds it 1:1 to the note.
  - Regenerating a plan replaces the previously saved plan.
  - Unsaved candidates are lost when refreshing the page or closing the browser.

- **Error handling & edge cases**
  - Clear error messages and a manual “Try again” action for timeouts or API errors.
  - No automatic retry or streaming in the MVP.
  - After the daily generation limit is exceeded, the generate button remains disabled with an explanatory message.

### Out of scope (MVP)

The following features are explicitly out of scope for the first version:

- Sharing plans between users.
- Advanced logistics (bookings, precise timings, automatic route optimisation).
- Handling photos or other media.
- Keeping multiple versions of plans for a single note.
- Automatic retries and streaming responses from the AI model.
- Native mobile apps (MVP is a web SPA only).

## Project status

The project is in active early development:

- The product requirements and technical stack are defined.
- The frontend scaffold (Vue 3 + TypeScript + Vite) and tooling are set up.
- Core features such as authentication, trip management, profile handling and AI plan generation are being implemented iteratively.

Expect breaking changes and rapid iteration while the MVP is built.

## License

A specific open-source license has not been chosen yet.

Until an explicit `LICENSE` file is added to this repository, all rights are reserved by the repository owner. If you plan to use MyAIGuide in your own projects or have questions about licensing, please open an issue or contact the maintainer.

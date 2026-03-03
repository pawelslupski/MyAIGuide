# Supabase Edge Functions — MyAIGuide

> **Note:** The `api/` directory (`index.ts`) is a **legacy mock prototype** used during early development. It is not deployed in production. The active Edge Functions are the three named functions documented below.

---

## Active Edge Functions

All three functions require a valid Supabase session JWT in the `Authorization: Bearer <token>` header.
All error responses follow the shared `ErrorResponse` shape:

```json
{ "error": { "code": "ERROR_CODE", "message": "...", "details": {} } }
```

---

### `generate-plan` — POST /functions/v1/generate-plan

Generates a structured AI travel itinerary via OpenRouter.ai. Called after quota and ownership checks in the frontend store. Records the generation attempt in `plan_generations` regardless of success/failure.

**Request body:**
```json
{ "prompt": "...", "language": "en", "model": "anthropic/claude-sonnet-4-6" }
```

**Response (200):**
```json
{ "plan": { "days": [ ... ] }, "model_used": "anthropic/claude-sonnet-4-6" }
```

**Error codes:** `VALIDATION_ERROR` (400), `UNAUTHORIZED` (401), `QUOTA_EXCEEDED` (429), `AI_API_ERROR` / `INTERNAL_ERROR` (500)

**Environment variable required:** `OPENROUTER_API_KEY`

See [`generate-plan/README.md`](../generate-plan/README.md) for full field reference.

---

### `get-generation-quota` — GET /functions/v1/get-generation-quota

Returns the authenticated user's AI generation usage for the rolling 24-hour window. Only `success` and `api_error` rows count toward the quota; `validation_error` rows are excluded.

**Response (200):**
```json
{ "used": 3, "limit": 10, "remaining": 7, "reset_at": "2026-03-04T10:00:00Z" }
```

**Error codes:** `UNAUTHORIZED` (401), `INTERNAL_ERROR` (500)

No additional environment variables required (uses `SUPABASE_URL` + `SUPABASE_ANON_KEY`, auto-set by CLI).

---

### `delete-account` — DELETE /functions/v1/delete-account

Permanently deletes the authenticated user's account via the Supabase Admin API (`auth.admin.deleteUser`). Cascades to `profiles`, `trips`, and `plan_generations` via database foreign-key constraints.

**Request body:**
```json
{ "confirmation": "DELETE MY ACCOUNT" }
```

**Response (200):**
```json
{ "message": "Account successfully deleted" }
```

**Error codes:** `UNAUTHORIZED` (401), `VALIDATION_ERROR` (400 — wrong confirmation string), `INTERNAL_ERROR` (500)

**Environment variable required:** `SUPABASE_SERVICE_ROLE_KEY` (auto-set by CLI; never expose to the browser).

---

## Running Locally

```bash
# Serve all functions at once (Supabase CLI ≥ 1.200)
supabase functions serve --no-verify-jwt --env-file supabase/.env.local

# Or serve individually
supabase functions serve generate-plan --no-verify-jwt --env-file supabase/.env.local
supabase functions serve get-generation-quota --no-verify-jwt --env-file supabase/.env.local
supabase functions serve delete-account --no-verify-jwt --env-file supabase/.env.local
```

Base URL when running locally: `http://localhost:54321/functions/v1/`

### Required `supabase/.env.local`

```env
OPENROUTER_API_KEY=sk-or-v1-xxxxx
```

`SUPABASE_URL`, `SUPABASE_ANON_KEY`, and `SUPABASE_SERVICE_ROLE_KEY` are injected automatically by the Supabase CLI.

---

## Deployment

```bash
supabase functions deploy generate-plan
supabase functions deploy get-generation-quota
supabase functions deploy delete-account

# Set production secret
supabase secrets set OPENROUTER_API_KEY=sk-or-v1-xxxxx
```


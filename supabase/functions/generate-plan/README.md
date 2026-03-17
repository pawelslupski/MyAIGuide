# generate-plan — Supabase Edge Function

Generates a structured AI travel itinerary via OpenRouter.ai and records the attempt in `plan_generations`.

- **Route:** `POST /functions/v1/generate-plan`
- **Runtime:** Deno (Supabase Edge Functions)
- **Model:** `anthropic/claude-sonnet-4-6` (hardcoded, not overridable by the client)
- **Timeout:** 145 seconds
- **Feature flag:** returns `503 SERVICE_UNAVAILABLE` when `plan-generation` flag is disabled

---

## Request

```
POST /functions/v1/generate-plan
Authorization: Bearer <supabase_session_token>
Content-Type: application/json
```

```json
{
  "tripId": 42,
  "prompt": "Plan a 3-day trip to Kraków...",
  "language": "en",
  "numDays": 3
}
```

### Fields

| Field      | Type     | Required | Constraints                              |
|------------|----------|----------|------------------------------------------|
| `tripId`   | `number` | yes      | Positive integer                         |
| `prompt`   | `string` | yes      | 50 – 15 000 characters                   |
| `language` | `string` | yes      | 2–10 letter locale code (e.g. `en`, `pl`) |
| `numDays`  | `number` | no       | Number of trip days (defaults to 7); used to scale `max_tokens` |

---

## Response

### 200 OK

```json
{
  "plan": {
    "days": [
      {
        "day": 1,
        "activities": [
          {
            "timeOfDay": "morning",
            "locationName": "Wawel Castle",
            "description": "Visit the historic royal castle overlooking the Vistula river.",
            "categoryTag": "culture_museums"
          }
        ]
      }
    ]
  },
  "model_used": "anthropic/claude-sonnet-4-6"
}
```

`categoryTag` is one of: `nature` · `culture_museums` · `beach_relax` · `city_break` · `foodie`
`timeOfDay` is one of: `morning` · `afternoon` · `evening`

---

## Error codes

| Code | Status | Description |
|------|--------|-------------|
| `METHOD_NOT_ALLOWED` | 405 | Non-POST request |
| `SERVICE_UNAVAILABLE` | 503 | `plan-generation` feature flag disabled |
| `UNAUTHORIZED` | 401 | Missing or invalid session JWT |
| `QUOTA_EXCEEDED` | 429 | User has used all 10 generations in the 24-hour window |
| `VALIDATION_ERROR` | 400 | Invalid or missing `tripId`, `prompt`, or `language` |
| `AUTHENTICATION_ERROR` | 401 | OpenRouter API key rejected |
| `RATE_LIMIT_ERROR` | 429 | OpenRouter rate limit hit; `details.retry_after` (seconds) included |
| `TIMEOUT_ERROR` | 504 | OpenRouter did not respond within the timeout; longer trips (more days) take more time |
| `SERVICE_UNAVAILABLE` | 503 | OpenRouter network/server error |
| `AI_API_ERROR` | 502 | OpenRouter returned an invalid or unparseable response |
| `INTERNAL_ERROR` | 500 | Unexpected server error |

All error responses follow the project-wide shape:

```json
{ "error": { "code": "ERROR_CODE", "message": "...", "details": {} } }
```

---

## Quota enforcement

Quota is enforced **server-side** — the client cannot bypass it.

- Limit: **10 generations per user**. The 24-hour cooldown starts at the moment of the 10th attempt; after it expires **all 10 slots** are restored at once (fixed-batch model, not a rolling window).
- Counted statuses: `success`, `api_error` (including user-aborted generations recorded by the client).
- Excluded: `validation_error` (destination missing, note too long — caught before the AI call).
- Every invocation that reaches the OpenRouter call is recorded in `plan_generations` regardless of outcome.

---

## AI model configuration

| Parameter     | Value  |
|---------------|--------|
| `model`       | `anthropic/claude-sonnet-4-6` |
| `temperature` | `0.7`  |
| `max_tokens`  | `4000–16000` (dynamic: `clamp(numDays × 1100 + 2000, 4000, 16000)`) |
| `top_p`       | `0.9`  |
| `response_format` | `json_schema` (strict) |

The system prompt enforces the exact `PlanJson` schema and requires ≥ 90% of activities to match any requested category constraints. Extra fields in the AI response are stripped before returning.

> **Generation time:** A 3-day trip takes ~30 seconds; a 10–14 day trip may take up to 2–3 minutes. The function timeout is set to 145 seconds (just below the Supabase infrastructure limit of ~150 s).

---

## Environment variables

| Variable | Where set | Description |
|----------|-----------|-------------|
| `OPENROUTER_API_KEY` | `supabase/.env.local` / Supabase secrets | OpenRouter API key |
| `SUPABASE_URL` | Auto-injected by CLI | Supabase project URL |
| `SUPABASE_ANON_KEY` | Auto-injected by CLI | Supabase anon key |

```bash
# Local development
echo "OPENROUTER_API_KEY=sk-or-v1-xxxxx" >> supabase/.env.local

# Production
supabase secrets set OPENROUTER_API_KEY=sk-or-v1-xxxxx
```

---

## Running locally

```bash
supabase functions serve generate-plan --no-verify-jwt --env-file supabase/.env.local
```

```bash
curl -X POST http://localhost:54321/functions/v1/generate-plan \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer <anon_key>" \
  -d '{
    "tripId": 1,
    "prompt": "Plan a 3-day trip to Kraków, Poland. I love history and local food.",
    "language": "en"
  }'
```

## Deployment

```bash
supabase functions deploy generate-plan
```

## Files

| File | Description |
|------|-------------|
| `index.ts` | Main handler — auth, quota, validation, OpenRouter call, DB recording |
| `openrouter.types.ts` | TypeScript types for OpenRouter request/response and internal DTOs |
| `README.md` | This file |

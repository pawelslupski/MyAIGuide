# API Edge Function

REST API endpoints for MyAIGuide application.

## Available Endpoints

### GET /api/trips/:id

Retrieves detailed information about a specific trip.

**URL:** `GET /functions/v1/api/trips/:id`

**Path Parameters:**
- `id` (required): Trip identifier (positive integer)

**Response (200 OK):**
```json
{
  "id": 1,
  "user_id": "uuid-string",
  "title": "Summer in Croatia",
  "note_body": "Planning a 10-day trip...",
  "what": ["culture_museums", "beach_relax", "foodie"],
  "speed": "balance",
  "type": "roadtrip",
  "budget": "moderate",
  "plan_json": null,
  "plan_language": null,
  "status": "DRAFT",
  "created_at": "2024-01-10T09:00:00Z",
  "updated_at": "2024-01-22T16:30:00Z"
}
```

**Error Responses:**
- `400` - Invalid trip ID (not a positive integer)
- `404` - Trip not found
- `500` - Internal server error

### POST /api/generations

Generates AI travel plan (mock mode).

**URL:** `POST /functions/v1/api/generations`

**Request Body:**
```json
{
  "tripId": 1,
  "userId": "user-uuid"
}
```

## Running Locally

### Start the Edge Function

```bash
# With mock mode (no database required)
MOCK_MODE=true supabase functions serve api --no-verify-jwt

# With real database
supabase functions serve api --no-verify-jwt
```

The API will be available at: `http://localhost:54321/functions/v1/api`

### Environment Variables

- `MOCK_MODE` - Set to `true` to use mock data instead of real database (default: `false`)
- `SUPABASE_URL` - Supabase project URL (auto-set by Supabase CLI)
- `SUPABASE_SERVICE_ROLE_KEY` - Service role key for database access (auto-set by Supabase CLI)

## Testing

### Testy jednostkowe – Deno test runner

Testy Edge Function pisane są w natywnym środowisku Deno i uruchamiane komendą:

```bash
deno test --allow-env --allow-net supabase/functions/api/
```

Pokrycie testów jednostkowych:
- Routing endpointów (`/api/trips/:id`, `/api/generations`)
- Obsługa błędów: `400` (nieprawidłowe ID), `404` (nie znaleziono), `500` (błąd wewnętrzny)
- CORS preflight (`OPTIONS`)

### Testy E2E – Playwright (manualne curl / integracja)

Pełne przepływy przez API testowane są w ramach testów E2E Playwright z użyciem route interception:

```typescript
// Mock endpointu generacji w testach E2E
await page.route('**/functions/v1/api/generations', route =>
  route.fulfill({ status: 200, json: mockGenerationResponse })
)
```

Manualne wywołania do weryfikacji podczas developmentu:

```bash
# GET /api/trips/:id
curl http://localhost:54321/functions/v1/api/trips/1

# POST /api/generations
curl -X POST http://localhost:54321/functions/v1/api/generations \
  -H "Content-Type: application/json" \
  -d '{"tripId": 1, "userId": "00000000-0000-0000-0000-000000000001"}'
```

## Mock Mode vs Real Database

### Mock Mode (`MOCK_MODE=true`)
- Returns hardcoded data
- No database connection required
- Useful for frontend development
- Always returns status 200 for valid trip IDs

### Real Database Mode (`MOCK_MODE=false`)
- Queries actual Supabase database
- Requires running Supabase locally or connection to remote instance
- Returns real trip data
- Enforces data validation

## MVP Notes

**Authentication:** Currently disabled for MVP. All requests use a default user ID.

**Future:** Add proper authentication by extracting user from JWT token in Authorization header.

## Error Handling

All errors follow the standard ErrorResponse format:

```json
{
  "error": {
    "code": "ERROR_CODE",
    "message": "Human-readable error message",
    "details": {
      "additional": "context"
    }
  }
}
```

## Development

The Edge Function is written in TypeScript for Deno runtime.

**Key files:**
- `index.ts` - Main router and handlers
- `README.md` - This file

**Dependencies:**
- `@supabase/supabase-js` - Supabase client for database access


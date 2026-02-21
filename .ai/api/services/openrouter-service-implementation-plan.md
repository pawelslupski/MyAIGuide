# OpenRouter Service Implementation Plan

## 1. Service Description

The OpenRouter service is a TypeScript module designed to interact with the OpenRouter.ai API for LLM-based chat completions. This service is implemented as a **Supabase Edge Function** (Deno runtime) to keep API keys secure on the server side.

**Purpose:**

- Provide a secure, server-side interface to OpenRouter.ai API
- Generate structured travel plans using various AI models (GPT-4, Claude, etc.)
- Support JSON schema-based structured outputs for consistent response format
- Handle errors, timeouts, and rate limiting gracefully
- Enable flexible model selection without vendor lock-in

**Location:** `supabase/functions/generate-travel-plan/index.ts`

**Runtime:** Deno (Supabase Edge Functions)

**Key Features:**

- Structured outputs using JSON schema (`response_format`) with `additionalProperties: false` at all levels
- Configurable model selection (default: `anthropic/claude-3.5-sonnet`)
- Timeout handling (60 seconds for complex plan generation)
- Comprehensive error handling with user-friendly messages
- Request/response logging for debugging
- CORS support for frontend integration

---

## 2. Implementation Status

The following improvements have been applied to the initial design:

### 2.1 Strict JSON Schema (`supabase/functions/generate-travel-plan/index.ts`)

`additionalProperties: false` is set at all levels of the schema (root object, day object, activity object).

**Impact:** AI returns only the fields the frontend needs (`timeOfDay`, `locationName`, `description`, `categoryTag`) — no extra fields, consistent rendering.

### 2.2 Enhanced System Prompt

System prompt instructs the model to:

- Write **exhaustive descriptions** (2-3 sentences minimum per activity)
- Order activities by **geographic proximity** to minimize travel time
- Include specific details about what to see, do, and why it is worth visiting
- **Not** add fields beyond those declared in the schema

### 2.3 Improved User Prompt (`src/lib/services/generation.service.ts`)

A "critical requirements" block is appended to the user prompt:

- Generate **exactly `num_days` day entries** if duration is specified — no more, no fewer
- Order activities by geographic proximity
- Minimize travel time and distance
- Avoid zigzagging between distant locations
- Provide exhaustive descriptions with specific details

The **Preferences block** now includes two new fields:

- `Duration: N days` (or "not specified" if `num_days` is null)
- `Group size: N people` (or "not specified" if `num_people` is null)

### 2.4 OpenRouter Integration (`src/lib/services/generation.service.ts`)

`callAIService` calls the Supabase Edge Function:

- Builds a complete prompt from `noteBody`, `userProfile`, and `tripPreferences`
- Calls `supabaseClient.functions.invoke('generate-travel-plan', ...)`
- Proper error handling and response validation

### 2.5 Updated Type Definitions (`src/types.ts`)

`AIPlanParams` (formerly `MockPlanParams`) requires:

- `noteBody: string` — the trip notes content
- `userProfile` — `{ hasKids, hasPets, hasMobilityIssues, hasDietaryPreferences }`

### 2.6 Plan Store Integration (`src/stores/plan.store.ts`)

`generatePlan` fetches the user profile from the profile store and passes all required data (`noteBody`, `userProfile`, `tripPreferences`) to `callAIService`.

### 2.7 Environment Configuration (`.env.example`)

- `OPENROUTER_API_KEY` stored in Supabase secrets (`supabase/.env.local` for local dev)

---

## 3. Constructor Description

Edge Functions in Supabase don't use traditional constructors. Configuration is handled through:

1. **Environment Variables** (stored in Supabase secrets):
   - `OPENROUTER_API_KEY` — API key for OpenRouter.ai authentication

2. **Constants** (defined at module level):

   ```typescript
   const OPENROUTER_API_URL = 'https://openrouter.ai/api/v1/chat/completions'
   const DEFAULT_MODEL = 'anthropic/claude-3.5-sonnet'
   const REQUEST_TIMEOUT_MS = 60000 // 60 seconds
   const DEFAULT_TEMPERATURE = 0.7
   const DEFAULT_MAX_TOKENS = 4000
   ```

3. **CORS Headers** (for frontend communication):
   ```typescript
   const corsHeaders = {
     'Access-Control-Allow-Origin': '*',
     'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type'
   }
   ```

**No initialization required** — the Edge Function is stateless and processes each request independently.

---

## 4. Public Methods and Fields

### 4.1 Main Request Handler

**Function:** `Deno.serve(async (req: Request) => Response)`

**Request Format:**

```typescript
POST /functions/v1/generate-travel-plan
Content-Type: application/json

{
  "prompt": string,           // Required: user travel notes + preferences
  "language": string,          // Required: detected language code ("en", "pl", …)
  "model": string | undefined  // Optional: defaults to DEFAULT_MODEL
}
```

**Response Format (Success — 200):**

```typescript
{
  "plan": PlanJson,      // Structured plan matching JSON schema
  "model_used": string   // Actual model that processed the request
}
```

**Response Format (Error — 4xx/5xx):**

```typescript
{
  "error": {
    "code": string,      // e.g. "VALIDATION_ERROR", "AI_API_ERROR"
    "message": string,   // User-friendly error message
    "details"?: object   // Optional additional context
  }
}
```

**Process Flow:**

1. Handle CORS preflight (OPTIONS request)
2. Validate request method (must be POST)
3. Parse and validate request body
4. Build OpenRouter API request with JSON schema
5. Call OpenRouter API with timeout
6. Parse and validate response
7. Return structured plan or error response

---

## 5. Private Methods and Fields

### 5.1 Input Validation

**Function:** `validateInput(body: unknown): { prompt: string; language: string; model?: string }`

**Validation Rules:**

1. `prompt` — required, string, 50–15 000 characters
2. `language` — required, string, matches `/^[a-z]{2,10}$/i`
3. `model` — optional, non-empty string if provided

```typescript
function validateInput(body: unknown): ValidatedInput {
  if (!body || typeof body !== 'object') {
    throw new Error('Request body must be a JSON object')
  }

  const { prompt, language, model } = body as any

  if (!prompt || typeof prompt !== 'string') {
    throw new Error('Field "prompt" is required and must be a string')
  }
  if (prompt.trim().length < 50) {
    throw new Error('Field "prompt" must be at least 50 characters')
  }
  if (prompt.length > 15000) {
    throw new Error('Field "prompt" must not exceed 15000 characters')
  }

  if (!language || typeof language !== 'string') {
    throw new Error('Field "language" is required and must be a string')
  }
  if (!/^[a-z]{2,10}$/i.test(language)) {
    throw new Error('Field "language" must be a valid language code (e.g., "en", "pl")')
  }

  if (model !== undefined && (typeof model !== 'string' || model.trim().length === 0)) {
    throw new Error('Field "model" must be a non-empty string if provided')
  }

  return { prompt: prompt.trim(), language: language.toLowerCase(), model }
}
```

---

### 5.2 JSON Schema Builder

**Function:** `buildPlanJsonSchema(): object`

Builds the schema enforcing `additionalProperties: false` at every level:

```typescript
function buildPlanJsonSchema(): object {
  return {
    type: 'object',
    properties: {
      days: {
        type: 'array',
        items: {
          type: 'object',
          properties: {
            day: { type: 'number', description: 'Day number (1, 2, 3, …)' },
            activities: {
              type: 'array',
              items: {
                type: 'object',
                properties: {
                  timeOfDay: { type: 'string', description: 'morning / afternoon / evening' },
                  locationName: { type: 'string', description: 'Name of the location or venue' },
                  description: {
                    type: 'string',
                    description: 'Detailed description (2-3 sentences minimum)'
                  },
                  categoryTag: {
                    type: 'string',
                    enum: ['nature', 'culture_museums', 'beach_relax', 'city_break', 'foodie']
                  }
                },
                required: ['timeOfDay', 'locationName', 'description', 'categoryTag'],
                additionalProperties: false
              },
              minItems: 1
            }
          },
          required: ['day', 'activities'],
          additionalProperties: false
        },
        minItems: 1
      }
    },
    required: ['days'],
    additionalProperties: false
  }
}
```

---

### 5.3 OpenRouter Request Builder

**Function:** `buildOpenRouterRequest(prompt: string, language: string, model: string): object`

```typescript
function buildOpenRouterRequest(prompt: string, language: string, model: string): object {
  const systemMessage = {
    role: 'system',
    content: `You are an expert travel planner. Generate detailed, personalized travel plans.

IMPORTANT INSTRUCTIONS:
- Always respond in ${language} language
- Return a structured JSON object matching the schema exactly
- DO NOT include any additional fields beyond those specified in the schema
- Activities MUST be ordered logically based on geographic proximity
- Group nearby locations together and create efficient routes
- Each activity description must be EXHAUSTIVE and detailed (at least 2-3 sentences)
- Include specific details about what to see, do, and why it is worth visiting`
  }

  const userMessage = { role: 'user', content: prompt }

  const responseFormat = {
    type: 'json_schema',
    json_schema: {
      name: 'travel_plan',
      strict: true,
      schema: buildPlanJsonSchema()
    }
  }

  return {
    model,
    messages: [systemMessage, userMessage],
    response_format: responseFormat,
    temperature: DEFAULT_TEMPERATURE,
    max_tokens: DEFAULT_MAX_TOKENS,
    top_p: 0.9
  }
}
```

---

### 5.4 OpenRouter API Call

**Function:** `callOpenRouterAPI(requestBody: object): Promise<any>`

```typescript
async function callOpenRouterAPI(requestBody: object): Promise<any> {
  const apiKey = Deno.env.get('OPENROUTER_API_KEY')
  if (!apiKey) throw new Error('OPENROUTER_API_KEY environment variable is not set')

  const controller = new AbortController()
  const timeoutId = setTimeout(() => {
    controller.abort()
    console.warn(`[WARN] Request timeout after ${REQUEST_TIMEOUT_MS}ms`)
  }, REQUEST_TIMEOUT_MS)

  try {
    const startTime = Date.now()
    const response = await fetch(OPENROUTER_API_URL, {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${apiKey}`,
        'Content-Type': 'application/json',
        'HTTP-Referer': 'https://myaiguide.app',
        'X-Title': 'MyAIGuide'
      },
      body: JSON.stringify(requestBody),
      signal: controller.signal
    })

    clearTimeout(timeoutId)
    console.log(
      `[INFO] OpenRouter responded in ${Date.now() - startTime}ms — status ${response.status}`
    )

    if (!response.ok) {
      const errorText = await response.text()
      if (response.status === 401) throw new Error('AUTHENTICATION_ERROR: Invalid API key')
      if (response.status === 429) {
        const retryAfter = response.headers.get('Retry-After') || '60'
        throw new Error(`RATE_LIMIT_ERROR: Retry after ${retryAfter}s`)
      }
      if (response.status >= 500)
        throw new Error(`SERVICE_UNAVAILABLE: OpenRouter server error (${response.status})`)
      throw new Error(`OpenRouter API error (${response.status}): ${errorText}`)
    }

    return await response.json()
  } catch (error) {
    clearTimeout(timeoutId)
    if (error.name === 'AbortError')
      throw new Error('TIMEOUT_ERROR: Request exceeded 60 second timeout')
    if (error instanceof TypeError && error.message.includes('fetch')) {
      throw new Error('SERVICE_UNAVAILABLE: Network error connecting to OpenRouter')
    }
    throw error
  }
}
```

---

### 5.5 Response Parser

**Function:** `parseOpenRouterResponse(response: any): { plan: PlanJson; model_used: string }`

```typescript
function parseOpenRouterResponse(response: any): { plan: PlanJson; model_used: string } {
  if (!response || typeof response !== 'object') {
    throw new Error('Invalid response from OpenRouter: not an object')
  }
  if (!response.choices?.length) {
    throw new Error('Invalid response from OpenRouter: missing or empty choices array')
  }

  const firstChoice = response.choices[0]
  if (!firstChoice.message || typeof firstChoice.message.content !== 'string') {
    throw new Error('Invalid response from OpenRouter: missing message content')
  }

  let planData: any
  try {
    planData = JSON.parse(firstChoice.message.content)
  } catch (error) {
    throw new Error(`AI_API_ERROR: Invalid JSON in response — ${error.message}`)
  }

  if (!planData.days || !Array.isArray(planData.days) || planData.days.length === 0) {
    throw new Error('AI_API_ERROR: Response missing required "days" array')
  }

  if (response.usage) {
    console.log(
      `[INFO] Tokens — prompt: ${response.usage.prompt_tokens}, completion: ${response.usage.completion_tokens}, total: ${response.usage.total_tokens}`
    )
  }

  return { plan: planData as PlanJson, model_used: response.model || 'unknown' }
}
```

---

### 5.6 Error Response Builder

**Function:** `createErrorResponse(statusCode, code, message, details?): Response`

```typescript
function createErrorResponse(
  statusCode: number,
  code: string,
  message: string,
  details?: object
): Response {
  return new Response(JSON.stringify({ error: { code, message, ...(details && { details }) } }), {
    status: statusCode,
    headers: { ...corsHeaders, 'Content-Type': 'application/json' }
  })
}
```

---

## 6. Error Handling

### Error Categories

| Category       | HTTP | Code                   | Trigger                                    |
| -------------- | ---- | ---------------------- | ------------------------------------------ |
| Validation     | 400  | `VALIDATION_ERROR`     | Missing/invalid fields, JSON parse failure |
| Authentication | 401  | `AUTHENTICATION_ERROR` | Missing/invalid API key                    |
| Rate Limiting  | 429  | `RATE_LIMIT_ERROR`     | OpenRouter quota exceeded                  |
| Timeout        | 504  | `TIMEOUT_ERROR`        | >60 s response time                        |
| AI API         | 500  | `AI_API_ERROR`         | OpenRouter 5xx, bad JSON, schema mismatch  |
| Unavailable    | 503  | `SERVICE_UNAVAILABLE`  | Network failure                            |

### Error Handling Flow

```
Request Received
    ↓
[1] Validate Method          → 405 if not POST
    ↓
[2] Parse Request Body       → 400 VALIDATION_ERROR on bad JSON
    ↓
[3] Validate Input Fields    → 400 VALIDATION_ERROR
    ↓
[4] Build OpenRouter Request
    ↓
[5] Call OpenRouter API (60s timeout)
    ├─ Timeout               → 504 TIMEOUT_ERROR
    ├─ Network Error         → 503 SERVICE_UNAVAILABLE
    ├─ 401                   → 401 AUTHENTICATION_ERROR
    ├─ 429                   → 429 RATE_LIMIT_ERROR
    ├─ 5xx                   → 503 SERVICE_UNAVAILABLE
    └─ 200                   → Continue
    ↓
[6] Parse & Validate Response
    ├─ Invalid structure     → 500 AI_API_ERROR
    └─ Valid                 → Continue
    ↓
[7] Return 200 with plan
```

### Logging Strategy

```typescript
console.log(`[INFO] Plan generated — model: ${model_used}, tokens: ${total_tokens}`)
console.warn(`[WARN] Rate limit hit — retry after: ${retry_after}s`)
console.error(`[ERROR] OpenRouter error: ${error.message}`)
```

---

## 7. Security Considerations

- **API key** stored exclusively in Supabase secrets, never in client-side code or logs
- **Input validation** enforces length limits (50–15 000 chars) to prevent abuse
- **CORS** — current `*` origin is fine for local dev; production should restrict to the app domain:
  ```typescript
  'Access-Control-Allow-Origin': 'https://myaiguide.app'
  ```
- **Error messages** are sanitized — internal details are logged, not returned to the client
- **Response validation** rejects AI output that does not match the expected schema

---

## 8. Integration with Frontend

### generation.service.ts

```typescript
export async function callAIService(params: AIPlanParams): Promise<AIServiceResponse> {
  const prompt = buildAIPrompt(params.noteBody, params.userProfile, params.tripPreferences)

  const { data, error } = await supabaseClient.functions.invoke('generate-travel-plan', {
    body: { prompt, language: params.language, model: 'anthropic/claude-3.5-sonnet' }
  })

  if (error) throw new Error(`AI service error: ${error.message}`)
  if (!data?.plan) throw new Error('Invalid response from AI service: missing plan data')

  return { plan: data.plan, model_used: data.model_used }
}
```

### Environment Variables

| Variable             | Location              | Notes                 |
| -------------------- | --------------------- | --------------------- |
| `OPENROUTER_API_KEY` | `supabase/.env.local` | Required for AI calls |

---

## 9. Expected Response Format

```json
{
  "days": [
    {
      "day": 1,
      "activities": [
        {
          "timeOfDay": "morning",
          "locationName": "Old Town Square",
          "description": "Start your day in the heart of Krakow's historic center, a UNESCO World Heritage site. Explore the largest medieval town square in Europe, featuring the iconic Cloth Hall and St. Mary's Basilica with its famous wooden altarpiece. Perfect for families, with street performers and local vendors creating a vibrant atmosphere.",
          "categoryTag": "culture_museums"
        }
      ]
    }
  ]
}
```

---

## 10. Local Development & Testing

### Prerequisites

```bash
# 1. Set OpenRouter API key
supabase secrets set OPENROUTER_API_KEY=sk-or-v1-xxxxx

# For local dev only — create supabase/.env.local
echo "OPENROUTER_API_KEY=sk-or-v1-xxxxx" > supabase/.env.local
```

### Running Locally

```bash
supabase start
supabase functions serve generate-travel-plan --no-verify-jwt --env-file supabase/.env.local
npm run dev
```

### Manual Test

```bash
curl -X POST http://localhost:54321/functions/v1/generate-travel-plan \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer YOUR_ANON_KEY" \
  -d '{
    "prompt": "Plan a 3-day trip to Krakow, Poland. I love history, museums, and local food. Traveling with kids. Budget: moderate.",
    "language": "en",
    "model": "anthropic/claude-3.5-sonnet"
  }'
```

### Test Checklist

- [ ] Valid travel prompt → structured plan returned
- [ ] Missing `prompt` field → 400 VALIDATION_ERROR
- [ ] Prompt < 50 chars → 400 VALIDATION_ERROR
- [ ] Invalid language code → 400 VALIDATION_ERROR
- [ ] Invalid API key → 401 AUTHENTICATION_ERROR
- [ ] Plan generated in English and Polish
- [ ] Activities contain 2-3 sentence descriptions
- [ ] Activities ordered by geographic proximity
- [ ] No extra fields in response beyond schema
- [ ] CORS headers present on all responses
- [ ] Token usage logged in Edge Function console

---

## 11. Monitoring and Optimization

### Metrics to Track

- Average response time / P95 latency / timeout rate
- Requests per day, token usage per request, cost per request
- Error rate by type, rate limit hits, validation failures

### Cost Optimization

- Use cheaper models for simple requests; reserve expensive models for complex plans
- Optimize prompt length and `max_tokens` setting
- Consider response caching for identical or near-identical prompts (future enhancement)

---

## 12. Future Enhancements

- **Streaming responses** — show plan generation progress in real-time
- **Exponential backoff** — automatic retry with fallback model on transient errors
- **Response caching** — cache generated plans for similar prompts
- **Model selection** — allow users to choose the AI model or select automatically by complexity
- **A/B testing** — compare prompt variations and measure user satisfaction
- **Circuit breaker** — degrade gracefully when OpenRouter is repeatedly unavailable
- **Restrict CORS origin** — replace `*` with production domain

---

## Summary

The OpenRouter Supabase Edge Function provides a secure, server-side AI integration that:

- Calls OpenRouter API with strict JSON schema enforcement (no extra fields)
- Generates exhaustive, geographically ordered activity descriptions
- Handles errors gracefully across six categories with standardized responses
- Enforces a 60-second timeout and validates all inputs before making API calls
- Integrates seamlessly with the Vue frontend via `generation.service.ts`

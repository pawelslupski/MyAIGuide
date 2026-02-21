# Generate Travel Plan - Supabase Edge Function

This Edge Function calls the OpenRouter.ai API to generate structured travel plans using various AI models (GPT-4, Claude, etc.).

## Overview

- **Route**: `POST /functions/v1/generate-travel-plan`
- **Runtime**: Deno (Supabase Edge Functions)
- **Purpose**: Securely call OpenRouter API from server-side with structured JSON outputs

## Request Format

```json
POST /functions/v1/generate-travel-plan
Content-Type: application/json

{
  "prompt": "Plan a 3-day trip to Krakow...",
  "language": "en",
  "model": "anthropic/claude-3.5-sonnet"  // Optional
}
```

### Request Parameters

- **prompt** (required): User's travel notes and preferences
  - Type: `string`
  - Min length: 50 characters
  - Max length: 15,000 characters

- **language** (required): Language code for the response
  - Type: `string`
  - Format: 2-10 letter code (e.g., "en", "pl", "es")
  - Pattern: `/^[a-z]{2,10}$/i`

- **model** (optional): OpenRouter model identifier
  - Type: `string`
  - Default: `anthropic/claude-3.5-sonnet`
  - Examples: `openai/gpt-4`, `anthropic/claude-3-opus`

## Response Format

### Success Response (200 OK)

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
            "description": "Visit the historic royal castle",
            "categoryTag": "culture_museums"
          }
        ]
      }
    ]
  },
  "model_used": "anthropic/claude-3.5-sonnet"
}
```

### Error Response (4xx/5xx)

```json
{
  "error": {
    "code": "VALIDATION_ERROR",
    "message": "Field \"prompt\" must be at least 50 characters",
    "details": {
      "field": "prompt"
    }
  }
}
```

## Error Codes

| Code | Status | Description |
|------|--------|-------------|
| `VALIDATION_ERROR` | 400 | Invalid request parameters |
| `AUTHENTICATION_ERROR` | 401 | Invalid OpenRouter API key |
| `RATE_LIMIT_ERROR` | 429 | Rate limit exceeded |
| `INTERNAL_ERROR` | 500 | Unexpected server error |
| `AI_API_ERROR` | 500 | AI service returned invalid response |
| `SERVICE_UNAVAILABLE` | 503 | OpenRouter API unavailable |
| `TIMEOUT_ERROR` | 504 | Request exceeded 60 second timeout |

## Environment Variables

Set the following secret in Supabase:

```bash
# Production
supabase secrets set OPENROUTER_API_KEY=sk-or-v1-xxxxx

# Local development
echo "OPENROUTER_API_KEY=sk-or-v1-xxxxx" > supabase/.env.local
```

## Configuration

- **Timeout**: 60 seconds
- **Default Model**: `anthropic/claude-3.5-sonnet`
- **Temperature**: 0.7
- **Max Tokens**: 4000
- **Top P**: 0.9

## Deployment

```bash
# Deploy to Supabase
supabase functions deploy generate-travel-plan

# View logs
supabase functions logs generate-travel-plan --tail
```

## Testing

```bash
# Test locally
curl -X POST http://localhost:54321/functions/v1/generate-travel-plan \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer YOUR_ANON_KEY" \
  -d '{
    "prompt": "Plan a 3-day trip to Krakow, Poland. I love history and local food.",
    "language": "en"
  }'
```

## Files

- `index.ts` - Main Edge Function implementation
- `openrouter.types.ts` - TypeScript type definitions for OpenRouter API
- `README.md` - This documentation file

## Security

- API keys are stored securely in Supabase secrets
- Never exposed to client-side code
- CORS configured for frontend access
- Input validation prevents injection attacks
- Rate limiting handled at application level

## Features

✅ Structured JSON outputs using JSON schema  
✅ Flexible model selection  
✅ Comprehensive error handling  
✅ Timeout protection (60s)  
✅ Token usage logging  
✅ Multi-language support  
✅ Detailed validation


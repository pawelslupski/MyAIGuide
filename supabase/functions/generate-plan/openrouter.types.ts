/**
 * OpenRouter API message format
 */
export interface OpenRouterMessage {
  role: 'system' | 'user' | 'assistant'
  content: string
}

/**
 * JSON Schema configuration for structured outputs
 */
export interface OpenRouterJsonSchema {
  type: 'json_schema'
  json_schema: {
    name: string
    strict: boolean
    schema: object
  }
}

/**
 * OpenRouter API request body
 */
export interface OpenRouterRequest {
  model: string
  messages: OpenRouterMessage[]
  response_format?: OpenRouterJsonSchema
  temperature?: number
  max_tokens?: number
  top_p?: number
}

/**
 * Token usage information from OpenRouter response
 */
export interface OpenRouterUsage {
  prompt_tokens: number
  completion_tokens: number
  total_tokens: number
}

/**
 * Choice object in OpenRouter response
 */
export interface OpenRouterChoice {
  message: {
    role: 'assistant'
    content: string
  }
  finish_reason: string
}

/**
 * OpenRouter API response body
 */
export interface OpenRouterResponse {
  id: string
  model: string
  choices: OpenRouterChoice[]
  usage?: OpenRouterUsage
}

/**
 * Plan JSON structure (matches frontend PlanJson type)
 */
export interface PlanJson {
  days: Array<{
    day: number
    activities: Array<{
      timeOfDay: string
      locationName: string
      description: string
      categoryTag: string
    }>
  }>
}

/**
 * Validated input from request body
 */
export interface ValidatedInput {
  prompt: string
  language: string
}

/**
 * Parsed response ready to return to client
 */
export interface ParsedResponse {
  plan: PlanJson
  model_used: string
}


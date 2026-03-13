import { describe, it, expect, vi } from 'vitest'
import { detectLanguage, buildAIPrompt, validatePlanResponse } from './generation.service'

// Override global setup mock – service imports supabaseClient, not supabase
vi.mock('@/db/supabase.client', () => ({ supabaseClient: {} }))

// ─── Factories ────────────────────────────────────────────────────────────────

const makeProfile = (overrides: Record<string, unknown> = {}) => ({
  hasKids: false,
  hasPets: false,
  hasMobilityIssues: false,
  hasDietaryPreferences: false,
  ...overrides
})

const makePrefs = (overrides: Record<string, unknown> = {}) => ({
  what: [] as string[],
  speed: null as string | null,
  type: null as string | null,
  budget: null as string | null,
  num_days: null as number | null,
  num_people: null as number | null,
  ...overrides
})

// ─── detectLanguage ───────────────────────────────────────────────────────────

describe('detectLanguage', () => {
  it('LANG-01: returns "en" for an empty string', () => {
    expect(detectLanguage('')).toBe('en')
  })

  it('LANG-02: returns "en" for digits and special characters only', () => {
    expect(detectLanguage('1234 !@#$%^&*()')).toBe('en')
  })

  it('LANG-03: returns "pl" when text contains Polish characters', () => {
    expect(detectLanguage('Warszawa – miasto nad Wisłą, pełne śladów historii')).toBe('pl')
  })

  it('LANG-04: returns "en" for plain English text without Polish characters', () => {
    expect(detectLanguage('The quick brown fox jumps over the lazy dog')).toBe('en')
  })

  it('LANG-05: returns "en" when Polish character appears only after position 1000 (truncation)', () => {
    const text = 'a'.repeat(1000) + 'ą trailing polish'
    expect(detectLanguage(text)).toBe('en')
  })
})

// ─── buildAIPrompt ────────────────────────────────────────────────────────────

describe('buildAIPrompt', () => {
  it('PROMPT-01: includes traveler flags when hasKids and hasPets are true', () => {
    const prompt = buildAIPrompt('note', makeProfile({ hasKids: true, hasPets: true }), makePrefs())
    expect(prompt).toContain('traveling with kids')
    expect(prompt).toContain('traveling with pets')
  })

  it('PROMPT-02: shows "No special requirements" when no profile flags are set', () => {
    const prompt = buildAIPrompt('note', makeProfile(), makePrefs())
    expect(prompt).toContain('No special requirements')
  })

  it('PROMPT-03: includes speed value from trip preferences (e.g. from merged profile default)', () => {
    const prompt = buildAIPrompt('note', makeProfile(), makePrefs({ speed: 'slow_chill' }))
    expect(prompt).toContain('slow_chill')
  })

  it('PROMPT-04: includes ≥90% constraint and hard category rule for selected "what" categories', () => {
    const prompt = buildAIPrompt(
      'note',
      makeProfile(),
      makePrefs({ what: ['beach_relax', 'foodie'] })
    )
    expect(prompt).toContain('≥90%')
    expect(prompt).toContain('HARD CATEGORY RULE')
    expect(prompt).toContain('beach_relax')
    expect(prompt).toContain('foodie')
  })

  it('PROMPT-05: includes "EXACTLY 5" when num_days is 5', () => {
    const prompt = buildAIPrompt('note', makeProfile(), makePrefs({ num_days: 5 }))
    expect(prompt).toContain('EXACTLY 5')
  })

  it('PROMPT-06: shows "No notes provided" for an empty note_body', () => {
    const prompt = buildAIPrompt('', makeProfile(), makePrefs())
    expect(prompt).toContain('No notes provided')
  })

  it('PROMPT-07: shows "not specified" in Destination section when destination is undefined', () => {
    const prompt = buildAIPrompt('note', makeProfile(), makePrefs(), undefined)
    expect(prompt).toMatch(/Destination:\s*not specified/)
  })

  it('PROMPT-08: includes "has dietary preferences" when hasDietaryPreferences is true', () => {
    const prompt = buildAIPrompt('note', makeProfile({ hasDietaryPreferences: true }), makePrefs())
    expect(prompt).toContain('has dietary preferences')
  })
})

// ─── validatePlanResponse ─────────────────────────────────────────────────────

describe('validatePlanResponse', () => {
  const validResponse = {
    plan: {
      days: [
        {
          day: 1,
          activities: [
            {
              timeOfDay: 'morning',
              locationName: 'Wawel Castle',
              description: 'Historic royal castle overlooking the Vistula river in Kraków.',
              categoryTag: 'culture_museums'
            }
          ]
        }
      ]
    },
    model_used: 'gpt-4o'
  }

  it('returns a valid PlanJson for a correct AI response', () => {
    const result = validatePlanResponse(validResponse)
    expect(result.days).toHaveLength(1)
    expect(result.days[0]!.activities[0]!.locationName).toBe('Wawel Castle')
  })

  it('throws when the "days" array is empty (ZOD-05)', () => {
    expect(() => validatePlanResponse({ plan: { days: [] }, model_used: 'gpt-4o' })).toThrow()
  })

  it('throws when an activity has an invalid categoryTag (ZOD-04)', () => {
    const invalid = structuredClone(validResponse)

    ;(invalid.plan.days[0]!.activities[0]! as any).categoryTag = 'invalid_tag'
    expect(() => validatePlanResponse(invalid)).toThrow()
  })

  it('throws when an activity is missing the required timeOfDay field (ZOD-04)', () => {
    const invalid = structuredClone(validResponse)

    delete (invalid.plan.days[0]!.activities[0]! as any).timeOfDay
    expect(() => validatePlanResponse(invalid)).toThrow()
  })
})

import { describe, it, expect } from 'vitest'
import { ZodError } from 'zod'
import { validateCreateTripCommand, validateUpdateTripCommand } from './trip.schemas'

// ─── Helpers ──────────────────────────────────────────────────────────────────

/** Minimum valid command – only required field. */
const minValid = () => ({ title: 'Weekend in Paris' })

/** Fully populated valid command. */
const fullValid = () => ({
  title: 'Weekend in Paris',
  destination: 'Paris',
  num_days: 3,
  num_people: 2,
  what: ['culture_museums', 'foodie'],
  speed: 'intensive',
  type: 'base',
  budget: 'luxury',
  note_body: 'Focus on the Louvre and hidden bistros.'
})

function firstIssueOf(data: unknown) {
  try {
    validateCreateTripCommand(data)
    throw new Error('Expected ZodError but none was thrown')
  } catch (err) {
    expect(err).toBeInstanceOf(ZodError)
    return (err as ZodError).issues[0]!
  }
}

// ─── Happy paths ──────────────────────────────────────────────────────────────

describe('validateCreateTripCommand – valid inputs', () => {
  it('CTRIP-01: accepts a command with only title', () => {
    const result = validateCreateTripCommand(minValid())
    expect(result.title).toBe('Weekend in Paris')
  })

  it('CTRIP-02: accepts a fully populated command', () => {
    const result = validateCreateTripCommand(fullValid())
    expect(result).toMatchObject(fullValid())
  })

  it('CTRIP-03: accepts null for nullable optional fields', () => {
    const result = validateCreateTripCommand({
      title: 'Trip',
      destination: null,
      num_days: null,
      num_people: null,
      speed: null,
      type: null,
      budget: null,
      note_body: null
    })
    expect(result.destination).toBeNull()
    expect(result.num_days).toBeNull()
  })

  it('CTRIP-04: accepts title of exactly 255 characters', () => {
    const result = validateCreateTripCommand({ title: 'a'.repeat(255) })
    expect(result.title).toHaveLength(255)
  })

  it('CTRIP-05: accepts num_days at boundary values 1 and 30', () => {
    expect(validateCreateTripCommand({ title: 'T', num_days: 1 }).num_days).toBe(1)
    expect(validateCreateTripCommand({ title: 'T', num_days: 30 }).num_days).toBe(30)
  })

  it('CTRIP-06: accepts num_people at boundary values 1 and 20', () => {
    expect(validateCreateTripCommand({ title: 'T', num_people: 1 }).num_people).toBe(1)
    expect(validateCreateTripCommand({ title: 'T', num_people: 20 }).num_people).toBe(20)
  })
})

// ─── title validation ─────────────────────────────────────────────────────────

describe('validateCreateTripCommand – title', () => {
  it('CTRIP-07: rejects missing title', () => {
    const issue = firstIssueOf({})
    expect(issue.path).toContain('title')
  })

  it('CTRIP-08: rejects empty string title', () => {
    const issue = firstIssueOf({ title: '' })
    expect(issue.path).toContain('title')
    expect(issue.message).toMatch(/required/i)
  })

  it('CTRIP-09: rejects title longer than 255 characters', () => {
    const issue = firstIssueOf({ title: 'a'.repeat(256) })
    expect(issue.path).toContain('title')
  })
})

// ─── destination validation ───────────────────────────────────────────────────

describe('validateCreateTripCommand – destination', () => {
  it('CTRIP-10: rejects destination longer than 50 characters', () => {
    const issue = firstIssueOf({ title: 'T', destination: 'x'.repeat(51) })
    expect(issue.path).toContain('destination')
  })

  it('CTRIP-11: accepts destination of exactly 50 characters', () => {
    const result = validateCreateTripCommand({ title: 'T', destination: 'x'.repeat(50) })
    expect(result.destination).toHaveLength(50)
  })
})

// ─── num_days / num_people ────────────────────────────────────────────────────

describe('validateCreateTripCommand – num_days', () => {
  it('CTRIP-12: rejects num_days of 0 (below minimum)', () => {
    const issue = firstIssueOf({ title: 'T', num_days: 0 })
    expect(issue.path).toContain('num_days')
  })

  it('CTRIP-13: rejects num_days of 31 (above maximum)', () => {
    const issue = firstIssueOf({ title: 'T', num_days: 31 })
    expect(issue.path).toContain('num_days')
  })

  it('CTRIP-14: rejects non-integer num_days', () => {
    const issue = firstIssueOf({ title: 'T', num_days: 2.5 })
    expect(issue.path).toContain('num_days')
  })
})

describe('validateCreateTripCommand – num_people', () => {
  it('CTRIP-15: rejects num_people of 0 (below minimum)', () => {
    const issue = firstIssueOf({ title: 'T', num_people: 0 })
    expect(issue.path).toContain('num_people')
  })

  it('CTRIP-16: rejects num_people of 21 (above maximum)', () => {
    const issue = firstIssueOf({ title: 'T', num_people: 21 })
    expect(issue.path).toContain('num_people')
  })
})

// ─── preference enum validation ───────────────────────────────────────────────

describe('validateCreateTripCommand – speed', () => {
  it('CTRIP-17: rejects invalid speed value', () => {
    const issue = firstIssueOf({ title: 'T', speed: 'turbo' })
    expect(issue.path).toContain('speed')
  })

  it('CTRIP-18: accepts all valid speed values', () => {
    for (const speed of ['slow_chill', 'balance', 'intensive'] as const) {
      expect(() => validateCreateTripCommand({ title: 'T', speed })).not.toThrow()
    }
  })
})

describe('validateCreateTripCommand – type', () => {
  it('CTRIP-19: rejects invalid type value', () => {
    const issue = firstIssueOf({ title: 'T', type: 'luxury_cruise' })
    expect(issue.path).toContain('type')
  })

  it('CTRIP-20: accepts all valid type values', () => {
    for (const type of ['base', 'base_with_trips', 'roadtrip'] as const) {
      expect(() => validateCreateTripCommand({ title: 'T', type })).not.toThrow()
    }
  })
})

describe('validateCreateTripCommand – budget', () => {
  it('CTRIP-21: rejects invalid budget value', () => {
    const issue = firstIssueOf({ title: 'T', budget: 'expensive' })
    expect(issue.path).toContain('budget')
  })

  it('CTRIP-22: accepts all valid budget values', () => {
    for (const budget of ['budget', 'moderate', 'luxury'] as const) {
      expect(() => validateCreateTripCommand({ title: 'T', budget })).not.toThrow()
    }
  })
})

describe('validateCreateTripCommand – what', () => {
  it('CTRIP-23: rejects invalid what value', () => {
    const issue = firstIssueOf({ title: 'T', what: ['culture_museums', 'skydiving'] })
    expect(issue.path[0]).toBe('what')
  })

  it('CTRIP-24: accepts all valid what values', () => {
    const result = validateCreateTripCommand({
      title: 'T',
      what: ['nature', 'culture_museums', 'beach_relax', 'city_break', 'foodie']
    })
    expect(result.what).toHaveLength(5)
  })

  it('CTRIP-25: accepts empty what array', () => {
    const result = validateCreateTripCommand({ title: 'T', what: [] })
    expect(result.what).toEqual([])
  })
})

// ─── note_body validation ─────────────────────────────────────────────────────

describe('validateCreateTripCommand – note_body', () => {
  it('CTRIP-26: rejects note_body longer than 10 000 characters', () => {
    const issue = firstIssueOf({ title: 'T', note_body: 'x'.repeat(10001) })
    expect(issue.path).toContain('note_body')
  })

  it('CTRIP-27: accepts note_body of exactly 10 000 characters', () => {
    const result = validateCreateTripCommand({ title: 'T', note_body: 'x'.repeat(10000) })
    expect(result.note_body).toHaveLength(10000)
  })
})

// ─── validateUpdateTripCommand ────────────────────────────────────────────────

function firstUpdateIssueOf(data: unknown) {
  try {
    validateUpdateTripCommand(data)
  } catch (err) {
    expect(err).toBeInstanceOf(ZodError)
    return (err as ZodError).issues[0]!
  }
  throw new Error('Expected ZodError but none was thrown')
}

describe('validateUpdateTripCommand – valid inputs', () => {
  it('UTRIP-01: accepts an empty object (all fields optional)', () => {
    expect(() => validateUpdateTripCommand({})).not.toThrow()
  })

  it('UTRIP-02: accepts a fully populated update payload', () => {
    const result = validateUpdateTripCommand({
      title: 'Updated Paris Trip',
      destination: 'Paris',
      num_days: 5,
      num_people: 2,
      what: ['culture_museums', 'foodie'],
      speed: 'balance',
      type: 'base',
      budget: 'moderate',
      note_body: 'Visit the Louvre.'
    })
    expect(result.title).toBe('Updated Paris Trip')
    expect(result.num_days).toBe(5)
  })

  it('UTRIP-03: accepts null for nullable optional fields', () => {
    const result = validateUpdateTripCommand({
      destination: null,
      num_days: null,
      num_people: null,
      speed: null,
      type: null,
      budget: null,
      note_body: null
    })
    expect(result.destination).toBeNull()
    expect(result.num_days).toBeNull()
  })
})

describe('validateUpdateTripCommand – title', () => {
  it('UTRIP-04: rejects empty string title', () => {
    const issue = firstUpdateIssueOf({ title: '' })
    expect(issue.path).toContain('title')
    expect(issue.message).toMatch(/cannot be empty/i)
  })

  it('UTRIP-05: rejects title longer than 255 characters', () => {
    const issue = firstUpdateIssueOf({ title: 'a'.repeat(256) })
    expect(issue.path).toContain('title')
  })

  it('UTRIP-06: accepts title of exactly 255 characters', () => {
    expect(() => validateUpdateTripCommand({ title: 'a'.repeat(255) })).not.toThrow()
  })
})

describe('validateUpdateTripCommand – numeric fields', () => {
  it('UTRIP-07: rejects num_days below minimum (0)', () => {
    const issue = firstUpdateIssueOf({ num_days: 0 })
    expect(issue.path).toContain('num_days')
  })

  it('UTRIP-08: rejects num_days above maximum (31)', () => {
    const issue = firstUpdateIssueOf({ num_days: 31 })
    expect(issue.path).toContain('num_days')
  })

  it('UTRIP-09: rejects num_people above maximum (21)', () => {
    const issue = firstUpdateIssueOf({ num_people: 21 })
    expect(issue.path).toContain('num_people')
  })
})

describe('validateUpdateTripCommand – enums', () => {
  it('UTRIP-10: rejects invalid speed value', () => {
    const issue = firstUpdateIssueOf({ speed: 'turbo' })
    expect(issue.path).toContain('speed')
  })

  it('UTRIP-11: rejects invalid type value', () => {
    const issue = firstUpdateIssueOf({ type: 'luxury_cruise' })
    expect(issue.path).toContain('type')
  })

  it('UTRIP-12: rejects invalid budget value', () => {
    const issue = firstUpdateIssueOf({ budget: 'expensive' })
    expect(issue.path).toContain('budget')
  })

  it('UTRIP-13: rejects invalid what value', () => {
    const issue = firstUpdateIssueOf({ what: ['skydiving'] })
    expect(issue.path[0]).toBe('what')
  })
})

describe('validateUpdateTripCommand – note_body', () => {
  it('UTRIP-14: rejects note_body longer than 10 000 characters', () => {
    const issue = firstUpdateIssueOf({ note_body: 'x'.repeat(10001) })
    expect(issue.path).toContain('note_body')
  })
})

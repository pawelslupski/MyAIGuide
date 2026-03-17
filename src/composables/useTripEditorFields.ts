import { ref, computed, watch, onMounted } from 'vue'
import type {
  TripDTO,
  TripPreferencesDto,
  WhatPreference,
  SpeedPreference,
  TypePreference,
  BudgetPreference
} from '@/types'

export interface TripEditorFields {
  destination: string | null
  note_body: string | null
  what: WhatPreference[]
  speed: SpeedPreference | null
  type: TypePreference | null
  budget: BudgetPreference | null
  num_days: number | null
  num_people: number | null
}

export const MAX_NOTE_LENGTH = 10000
export const WARN_NOTE_LENGTH = 9000

export function useTripEditorFields(
  getTripProp: () => TripDTO,
  getDefaultsProp: () => TripPreferencesDto | undefined,
  onFieldsChange: (fields: TripEditorFields) => void
) {
  const trip = getTripProp()
  const defaults = getDefaultsProp()

  const localDestination = ref(trip.destination ?? '')
  const localNote = ref(trip.note_body ?? '')
  const localWhat = ref<WhatPreference[]>(
    ((trip.what?.length ? trip.what : defaults?.what) ?? []) as WhatPreference[]
  )
  const localSpeed = ref<SpeedPreference | null>(
    (trip.speed ?? defaults?.speed ?? null) as SpeedPreference | null
  )
  const localType = ref<TypePreference | null>(
    (trip.type ?? defaults?.type ?? null) as TypePreference | null
  )
  const localBudget = ref<BudgetPreference | null>(
    (trip.budget ?? defaults?.budget ?? null) as BudgetPreference | null
  )
  const localNumDays = ref<number | null>(trip.num_days ?? null)
  const localNumPeople = ref<number | null>(trip.num_people ?? null)

  // ── Note character count ───────────────────────────────────────────────────

  const noteLength = computed(() => localNote.value.length)

  const noteColorClass = computed(() => {
    if (noteLength.value > MAX_NOTE_LENGTH) return 'text-destructive'
    if (noteLength.value > WARN_NOTE_LENGTH) return 'text-amber-600 dark:text-amber-400'
    return 'text-muted-foreground'
  })

  const noteValidationMessage = computed(() => {
    if (noteLength.value > MAX_NOTE_LENGTH)
      return `Maximum ${MAX_NOTE_LENGTH.toLocaleString()} characters exceeded`
    if (noteLength.value > WARN_NOTE_LENGTH) return 'Approaching character limit'
    return null
  })

  // ── Emit helpers ───────────────────────────────────────────────────────────

  function emitFields() {
    onFieldsChange({
      destination: localDestination.value.trim() || null,
      note_body: localNote.value.trim() || null,
      what: localWhat.value,
      speed: localSpeed.value,
      type: localType.value,
      budget: localBudget.value,
      num_days: localNumDays.value,
      num_people: localNumPeople.value
    })
  }

  // Emit whenever any local value changes (destination and note excluded — saved on blur only)
  watch([localWhat, localSpeed, localType, localBudget, localNumDays, localNumPeople], emitFields)

  function handleDestinationBlur() {
    emitFields()
  }

  function handleNoteBlur() {
    emitFields()
  }

  // Emit initial state on mount so pendingFields reflects profile-prepopulated values
  onMounted(emitFields)

  // ── Profile defaults sync (when prop arrives after mount) ──────────────────

  watch(getDefaultsProp, (newDefaults) => {
    if (!newDefaults) return
    const t = getTripProp()
    if (!t.what?.length) localWhat.value = [...(newDefaults.what ?? [])] as WhatPreference[]
    if (!t.speed) localSpeed.value = (newDefaults.speed ?? null) as SpeedPreference | null
    if (!t.type) localType.value = (newDefaults.type ?? null) as TypePreference | null
    if (!t.budget) localBudget.value = (newDefaults.budget ?? null) as BudgetPreference | null
  })

  // ── Trip prop sync (after external save) ──────────────────────────────────

  watch(getTripProp, (newTrip) => {
    const d = getDefaultsProp()

    const newDest = newTrip.destination ?? ''
    if (localDestination.value !== newDest) localDestination.value = newDest

    const newNote = newTrip.note_body ?? ''
    if (localNote.value !== newNote) localNote.value = newNote

    const newWhat = ((newTrip.what?.length ? newTrip.what : d?.what) ?? []) as WhatPreference[]
    if (JSON.stringify(localWhat.value) !== JSON.stringify(newWhat)) localWhat.value = newWhat

    const newSpeed = (newTrip.speed ?? d?.speed ?? null) as SpeedPreference | null
    if (localSpeed.value !== newSpeed) localSpeed.value = newSpeed

    const newType = (newTrip.type ?? d?.type ?? null) as TypePreference | null
    if (localType.value !== newType) localType.value = newType

    const newBudget = (newTrip.budget ?? d?.budget ?? null) as BudgetPreference | null
    if (localBudget.value !== newBudget) localBudget.value = newBudget

    const newNumDays = newTrip.num_days ?? null
    if (localNumDays.value !== newNumDays) localNumDays.value = newNumDays

    const newNumPeople = newTrip.num_people ?? null
    if (localNumPeople.value !== newNumPeople) localNumPeople.value = newNumPeople
  })

  // ── Toggle / select helpers ────────────────────────────────────────────────

  function toggleWhat(value: WhatPreference) {
    const index = localWhat.value.indexOf(value)
    if (index > -1) {
      localWhat.value = localWhat.value.filter((v) => v !== value)
    } else {
      localWhat.value = [...localWhat.value, value]
    }
  }

  function isInherited(field: 'speed' | 'type' | 'budget'): boolean {
    const d = getDefaultsProp()
    if (!d) return false
    const profileValue = d[field]
    if (!profileValue) return false
    const localValue =
      field === 'speed' ? localSpeed.value : field === 'type' ? localType.value : localBudget.value
    return localValue === profileValue
  }

  const isWhatInherited = computed(() => {
    const profileWhat = getDefaultsProp()?.what
    if (!profileWhat?.length) return false
    if (localWhat.value.length !== profileWhat.length) return false
    const sorted = (arr: WhatPreference[]) => [...arr].sort().join(',')
    return sorted(localWhat.value) === sorted(profileWhat)
  })

  // ── Number input coercion ─────────────────────────────────────────────────

  function coerceNum(val: string | number | undefined): number | null {
    if (val === '' || val == null) return null
    const n = Number(val)
    return Number.isNaN(n) ? null : n
  }

  function handleNumDaysInput(val: string | number | undefined) {
    localNumDays.value = coerceNum(val)
  }

  function handleNumPeopleInput(val: string | number | undefined) {
    localNumPeople.value = coerceNum(val)
  }

  // ── num_days validation ────────────────────────────────────────────────────

  const NUM_DAYS_MIN = 1
  const NUM_DAYS_MAX = 14

  const numDaysTouched = ref(false)

  const numDaysError = computed(() => {
    if (!numDaysTouched.value) return false
    const v = localNumDays.value
    if (v === null) return false
    return v < NUM_DAYS_MIN || v > NUM_DAYS_MAX
  })

  function handleNumDaysBlur() {
    numDaysTouched.value = true
  }

  // ── num_people validation ──────────────────────────────────────────────────

  const NUM_PEOPLE_MIN = 1
  const NUM_PEOPLE_MAX = 30

  const numPeopleTouched = ref(false)

  const numPeopleError = computed(() => {
    if (!numPeopleTouched.value) return false
    const v = localNumPeople.value
    if (v === null) return false
    return v < NUM_PEOPLE_MIN || v > NUM_PEOPLE_MAX
  })

  function handleNumPeopleBlur() {
    numPeopleTouched.value = true
  }

  return {
    localDestination,
    localNote,
    localWhat,
    localSpeed,
    localType,
    localBudget,
    localNumDays,
    localNumPeople,
    noteLength,
    noteValidationMessage,
    noteValidationClass: noteColorClass,
    noteCounterClass: noteColorClass,
    MAX_NOTE_LENGTH,
    NUM_DAYS_MIN,
    NUM_DAYS_MAX,
    NUM_PEOPLE_MIN,
    NUM_PEOPLE_MAX,
    toggleWhat,
    isInherited,
    isWhatInherited,
    handleNumDaysInput,
    handleNumDaysBlur,
    handleNumPeopleInput,
    handleNumPeopleBlur,
    handleDestinationBlur,
    handleNoteBlur,
    numDaysError,
    numPeopleError
  }
}

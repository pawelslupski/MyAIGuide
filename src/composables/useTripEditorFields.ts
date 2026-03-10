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

  // Emit whenever any local value changes
  watch(
    [
      localDestination,
      localNote,
      localWhat,
      localSpeed,
      localType,
      localBudget,
      localNumDays,
      localNumPeople
    ],
    emitFields,
    { deep: true }
  )

  // Emit initial state on mount so pendingFields reflects profile-prepopulated values
  onMounted(emitFields)

  // ── Profile defaults sync (when prop arrives after mount) ──────────────────

  watch(
    getDefaultsProp,
    (newDefaults) => {
      if (!newDefaults) return
      const t = getTripProp()
      if (!t.what?.length) localWhat.value = [...(newDefaults.what ?? [])] as WhatPreference[]
      if (!t.speed) localSpeed.value = (newDefaults.speed ?? null) as SpeedPreference | null
      if (!t.type) localType.value = (newDefaults.type ?? null) as TypePreference | null
      if (!t.budget) localBudget.value = (newDefaults.budget ?? null) as BudgetPreference | null
    },
    { deep: true }
  )

  // ── Trip prop sync (after external save) ──────────────────────────────────

  watch(
    getTripProp,
    (newTrip) => {
      const d = getDefaultsProp()
      localDestination.value = newTrip.destination ?? ''
      localNote.value = newTrip.note_body ?? ''
      localWhat.value = ((newTrip.what?.length ? newTrip.what : d?.what) ?? []) as WhatPreference[]
      localSpeed.value = (newTrip.speed ?? d?.speed ?? null) as SpeedPreference | null
      localType.value = (newTrip.type ?? d?.type ?? null) as TypePreference | null
      localBudget.value = (newTrip.budget ?? d?.budget ?? null) as BudgetPreference | null
      localNumDays.value = newTrip.num_days ?? null
      localNumPeople.value = newTrip.num_people ?? null
    },
    { deep: true }
  )

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
    toggleWhat,
    isInherited,
    isWhatInherited,
    handleNumDaysInput,
    handleNumPeopleInput
  }
}

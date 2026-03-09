<script setup lang="ts">
import { Input } from '@/components/ui/input'
import { Badge } from '@/components/ui/badge'
import type { TripStatus } from '@/types'

interface Props {
  title: string
  status: TripStatus
  updatedAt: string
  isSaving?: boolean
}

const props = defineProps<Props>()

const emit = defineEmits<{
  'update:title': [newTitle: string]
}>()

function statusClass(status: TripStatus): string {
  if (status === 'CONFIRMED') return 'bg-primary/10 text-primary border-primary/30'
  if (status === 'DRAFT') return 'bg-primary/10 text-primary border-primary/30'
  return ''
}

function formatRelativeTime(isoDate: string): string {
  const date = new Date(isoDate)
  const now = new Date()
  const diffMs = now.getTime() - date.getTime()
  const diffSeconds = Math.floor(diffMs / 1000)
  if (diffSeconds < 60) return 'just now'
  const diffMinutes = Math.floor(diffSeconds / 60)
  if (diffMinutes < 60) return `${diffMinutes}m ago`
  const diffHours = Math.floor(diffMinutes / 60)
  if (diffHours < 24) return `${diffHours}h ago`
  const diffDays = Math.floor(diffHours / 24)
  return `${diffDays}d ago`
}
</script>

<template>
  <div class="rounded-lg border bg-card p-4">
    <div class="flex items-center justify-between gap-4">
      <div class="flex min-w-0 flex-1 items-center gap-3">
        <Input
          data-testid="trip-title-input"
          :model-value="title"
          class="flex-1 text-xl font-bold"
          placeholder="Enter trip title"
          @update:model-value="emit('update:title', String($event))"
        />
        <Badge data-testid="trip-status-badge" variant="outline" :class="statusClass(status)">{{
          status
        }}</Badge>
      </div>
      <div class="flex shrink-0 items-center gap-3 text-xs text-muted-foreground">
        <span v-if="isSaving" data-testid="trip-saving-indicator">Saving…</span>
        <span>Updated {{ formatRelativeTime(updatedAt) }}</span>
        <slot name="actions" />
      </div>
    </div>
  </div>
</template>

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
  if (status === 'CONFIRMED')
    return 'bg-green-100 text-green-700 border-green-200 dark:bg-green-900/30 dark:text-green-400'
  if (status === 'DRAFT')
    return 'bg-amber-100 text-amber-700 border-amber-200 dark:bg-amber-900/30 dark:text-amber-400'
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
          :value="title"
          class="flex-1 text-xl font-bold"
          placeholder="Enter trip title"
          @input="emit('update:title', ($event.target as HTMLInputElement).value)"
        />
        <Badge variant="outline" :class="statusClass(status)">{{ status }}</Badge>
      </div>
      <div class="flex shrink-0 items-center gap-3 text-xs text-muted-foreground">
        <span v-if="isSaving">Saving…</span>
        <span>Updated {{ formatRelativeTime(updatedAt) }}</span>
        <slot name="actions" />
      </div>
    </div>
  </div>
</template>

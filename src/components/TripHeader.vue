<script setup lang="ts">
import { useI18n } from 'vue-i18n'
import { RouterLink } from 'vue-router'
import { CircleArrowLeft } from 'lucide-vue-next'
import { Input } from '@/components/ui/input'
import { Badge } from '@/components/ui/badge'
import type { TripStatus } from '@/types'

interface Props {
  title: string
  status: TripStatus
  updatedAt: string
  isSaving?: boolean
  isGenerating?: boolean
}

const props = defineProps<Props>()

const emit = defineEmits<{
  'update:title': [newTitle: string]
}>()

const { t } = useI18n()

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
  if (diffSeconds < 60) return t('relativeTime.justNow')
  const diffMinutes = Math.floor(diffSeconds / 60)
  if (diffMinutes < 60) return t('relativeTime.minutesAgo', { n: diffMinutes })
  const diffHours = Math.floor(diffMinutes / 60)
  if (diffHours < 24) return t('relativeTime.hoursAgo', { n: diffHours })
  const diffDays = Math.floor(diffHours / 24)
  return t('relativeTime.daysAgoShort', { n: diffDays })
}
</script>

<template>
  <div class="space-y-3">
    <div class="flex items-center rounded-lg border bg-card px-4 py-3">
      <RouterLink
        to="/"
        class="inline-flex items-center gap-2 text-base font-medium text-primary transition-colors hover:text-primary/70"
      >
        <CircleArrowLeft class="h-5 w-5" />
        {{ t('tripHeader.backToDashboard') }}
      </RouterLink>
    </div>

    <div class="rounded-lg border bg-card p-4">
      <div class="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between sm:gap-4">
        <div class="flex min-w-0 flex-1 items-center gap-3">
          <Input
            data-testid="trip-title-input"
            :model-value="title"
            :disabled="props.isGenerating"
            class="flex-1 text-2xl font-bold sm:text-xl"
            :placeholder="t('tripHeader.titlePlaceholder')"
            @update:model-value="emit('update:title', String($event))"
          />
          <Badge data-testid="trip-status-badge" variant="outline" :class="statusClass(status)">
            {{ t(`tripCard.status.${status}`) }}
          </Badge>
        </div>
        <div class="flex shrink-0 items-center gap-3 text-xs text-muted-foreground">
          <span v-if="isSaving" data-testid="trip-saving-indicator">{{
            t('tripHeader.saving')
          }}</span>
          <span>{{ t('tripHeader.updatedAt', { time: formatRelativeTime(updatedAt) }) }}</span>
          <slot name="actions" />
        </div>
      </div>
    </div>
  </div>
</template>

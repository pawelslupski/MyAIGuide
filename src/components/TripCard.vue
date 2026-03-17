<script setup lang="ts">
import { computed } from 'vue'
import { useRouter } from 'vue-router'
import { useI18n } from 'vue-i18n'
import { Trash2 } from 'lucide-vue-next'
import { Card, CardHeader, CardTitle, CardContent } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import type { DashboardTripViewModel, TripStatus } from '@/types'

const props = defineProps<{
  trip: DashboardTripViewModel
}>()

const emit = defineEmits<{
  delete: [id: number]
}>()

const router = useRouter()
const { t, locale } = useI18n()

function navigateToTrip() {
  router.push({ name: 'trip-detail', params: { id: props.trip.id } })
}

function onDeleteClick(event: MouseEvent) {
  event.stopPropagation()
  emit('delete', props.trip.id)
}

interface BadgeConfig {
  variant: 'secondary' | 'default' | 'destructive' | 'outline'
  class?: string
}

const STATUS_BADGE_STYLE: Record<TripStatus, BadgeConfig> = {
  CREATED: { variant: 'secondary' },
  DRAFT: { variant: 'outline', class: 'bg-primary/20 text-primary border-transparent' },
  CONFIRMED: { variant: 'default' }
}

const badgeConfig = computed(() => STATUS_BADGE_STYLE[props.trip.status])
const badgeLabel = computed(() => t(`tripCard.status.${props.trip.status}`))

const relativeDate = computed(() => {
  const date = new Date(props.trip.updatedAt)
  const now = new Date()
  const diffMs = now.getTime() - date.getTime()
  const diffDays = Math.floor(diffMs / (1000 * 60 * 60 * 24))

  if (diffDays === 0) return t('relativeTime.today')
  if (diffDays === 1) return t('relativeTime.yesterday')
  if (diffDays < 7) return t('relativeTime.daysAgo', { n: diffDays })
  if (diffDays < 30) {
    const weeks = Math.floor(diffDays / 7)
    return t(weeks === 1 ? 'relativeTime.weekAgo' : 'relativeTime.weeksAgo', { n: weeks })
  }
  return date.toLocaleDateString(locale.value === 'pl' ? 'pl-PL' : 'en-US', {
    year: 'numeric',
    month: 'short',
    day: 'numeric'
  })
})
</script>

<template>
  <Card
    class="relative cursor-pointer transition-shadow hover:shadow-md"
    data-testid="trip-card"
    :data-trip-id="trip.id"
    @click="navigateToTrip"
  >
    <CardHeader class="pb-2">
      <div class="flex items-start justify-between gap-2">
        <CardTitle
          data-testid="trip-card-title"
          class="line-clamp-2 text-lg leading-snug sm:text-base"
          >{{ trip.title }}</CardTitle
        >
        <Button
          variant="ghost"
          size="icon"
          class="h-7 w-7 shrink-0 text-muted-foreground hover:text-destructive"
          :aria-label="t('tripCard.deleteAriaLabel')"
          data-testid="trip-card-delete-btn"
          @click="onDeleteClick"
        >
          <Trash2 class="h-4 w-4" />
        </Button>
      </div>
      <Badge
        data-testid="trip-card-status"
        :variant="badgeConfig.variant"
        :class="badgeConfig.class"
      >
        {{ badgeLabel }}
      </Badge>
    </CardHeader>

    <CardContent class="pt-0">
      <p v-if="trip.notePreview" class="text-sm text-muted-foreground">
        {{ trip.notePreview }}
      </p>
      <p v-else class="text-sm italic text-muted-foreground">{{ t('tripCard.noNotes') }}</p>
      <p class="mt-3 text-xs text-muted-foreground">
        {{ t('tripCard.updatedAt', { date: relativeDate }) }}
      </p>
    </CardContent>
  </Card>
</template>

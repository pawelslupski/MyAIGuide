<script setup lang="ts">
import { computed } from 'vue'
import { useRouter } from 'vue-router'
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
  label: string
}

const STATUS_BADGE: Record<TripStatus, BadgeConfig> = {
  CREATED: { variant: 'secondary', label: 'New' },
  DRAFT: {
    variant: 'outline',
    class: 'bg-primary/20 text-primary border-transparent',
    label: 'In Progress'
  },
  CONFIRMED: {
    variant: 'default',
    label: 'Planned'
  }
}

const badgeConfig = computed(() => STATUS_BADGE[props.trip.status])

const relativeDate = computed(() => {
  const date = new Date(props.trip.updatedAt)
  const now = new Date()
  const diffMs = now.getTime() - date.getTime()
  const diffDays = Math.floor(diffMs / (1000 * 60 * 60 * 24))

  if (diffDays === 0) return 'Today'
  if (diffDays === 1) return 'Yesterday'
  if (diffDays < 7) return `${diffDays} days ago`
  if (diffDays < 30) return `${Math.floor(diffDays / 7)} week${diffDays >= 14 ? 's' : ''} ago`
  return date.toLocaleDateString(undefined, { year: 'numeric', month: 'short', day: 'numeric' })
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
        <CardTitle data-testid="trip-card-title" class="line-clamp-2 text-base leading-snug">{{
          trip.title
        }}</CardTitle>
        <Button
          variant="ghost"
          size="icon"
          class="h-7 w-7 shrink-0 text-muted-foreground hover:text-destructive"
          aria-label="Delete trip"
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
        {{ badgeConfig.label }}
      </Badge>
    </CardHeader>

    <CardContent class="pt-0">
      <p v-if="trip.notePreview" class="line-clamp-3 text-sm text-muted-foreground">
        {{ trip.notePreview }}
      </p>
      <p v-else class="text-sm italic text-muted-foreground">No notes yet</p>
      <p class="mt-3 text-xs text-muted-foreground">Updated {{ relativeDate }}</p>
    </CardContent>
  </Card>
</template>

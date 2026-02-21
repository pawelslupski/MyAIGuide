<script setup lang="ts">
import { Button } from '@/components/ui/button'
import type { PaginationDTO } from '@/types'

defineProps<{
  pagination: PaginationDTO
  isLoading: boolean
}>()

const emit = defineEmits<{
  'page-change': [page: number]
}>()
</script>

<template>
  <div class="mt-6 flex items-center justify-center gap-4">
    <Button
      variant="outline"
      :disabled="pagination.current_page === 1 || isLoading"
      @click="emit('page-change', pagination.current_page - 1)"
    >
      Previous
    </Button>

    <span class="text-sm text-muted-foreground">
      Page {{ pagination.current_page }} of {{ pagination.total_pages }}
    </span>

    <Button
      variant="outline"
      :disabled="pagination.current_page === pagination.total_pages || isLoading"
      @click="emit('page-change', pagination.current_page + 1)"
    >
      Next
    </Button>
  </div>
</template>

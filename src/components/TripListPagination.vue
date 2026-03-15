<script setup lang="ts">
import { useI18n } from 'vue-i18n'
import { Button } from '@/components/ui/button'
import type { PaginationDTO } from '@/types'

defineProps<{
  pagination: PaginationDTO
  isLoading: boolean
}>()

const emit = defineEmits<{
  'page-change': [page: number]
}>()

const { t } = useI18n()
</script>

<template>
  <div class="mt-6 flex items-center justify-center gap-4">
    <Button
      variant="outline"
      :disabled="pagination.current_page === 1 || isLoading"
      @click="emit('page-change', pagination.current_page - 1)"
    >
      {{ t('pagination.previous') }}
    </Button>

    <span class="text-sm text-muted-foreground">
      {{
        t('pagination.pageOf', { current: pagination.current_page, total: pagination.total_pages })
      }}
    </span>

    <Button
      variant="outline"
      :disabled="pagination.current_page === pagination.total_pages || isLoading"
      @click="emit('page-change', pagination.current_page + 1)"
    >
      {{ t('pagination.next') }}
    </Button>
  </div>
</template>

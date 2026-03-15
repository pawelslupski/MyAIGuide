<script setup lang="ts">
import { useRouter } from 'vue-router'
import { useI18n } from 'vue-i18n'
import { Button } from '@/components/ui/button'

const router = useRouter()
const { t } = useI18n()

function goHome() {
  router.push('/')
}
</script>

<template>
  <div class="flex min-h-screen items-center justify-center">
    <div class="text-center">
      <h1 class="mb-4 text-4xl font-bold">{{ t('errors.maintenance.title') }}</h1>
      <p class="mb-6 text-lg text-muted-foreground">{{ t('errors.maintenance.message') }}</p>
      <Button @click="goHome">{{ t('errors.maintenance.goHome') }}</Button>
    </div>
  </div>
</template>

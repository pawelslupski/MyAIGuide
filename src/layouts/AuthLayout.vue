<script setup lang="ts">
import { useI18n } from 'vue-i18n'
import ThemeToggle from '@/components/ThemeToggle.vue'
import LanguageSwitcher from '@/components/LanguageSwitcher.vue'
import { Card } from '@/components/ui/card'

const { t } = useI18n()
</script>

<template>
  <div class="relative flex min-h-screen items-center justify-center bg-background p-4">
    <div class="absolute right-4 top-4 flex items-center gap-1">
      <LanguageSwitcher />
      <ThemeToggle />
    </div>

    <div class="w-full max-w-sm">
      <div class="mb-8 text-center">
        <h1 class="text-2xl font-bold">{{ t('brand.name') }}</h1>
        <p class="mt-1 text-muted-foreground">{{ t('brand.tagline') }}</p>
      </div>

      <Card>
        <slot />
      </Card>
    </div>
  </div>
</template>

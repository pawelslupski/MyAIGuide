<script setup lang="ts">
import ThemeToggle from '@/components/ThemeToggle.vue'
import { Card } from '@/components/ui/card'
</script>

<template>
  <div class="relative flex min-h-screen items-center justify-center bg-background p-4">
    <div class="absolute right-4 top-4">
      <ThemeToggle />
    </div>

    <div class="w-full max-w-sm">
      <div class="mb-8 text-center">
        <h1 class="text-2xl font-bold">MyAIGuide</h1>
        <p class="mt-1 text-muted-foreground">AI-powered trip planning</p>
      </div>

      <Card>
        <slot />
      </Card>
    </div>
  </div>
</template>

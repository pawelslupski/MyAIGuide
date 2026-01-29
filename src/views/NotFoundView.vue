<script setup lang="ts">
import { useRouter } from 'vue-router'
import { Button } from '@/components/ui/button'

const router = useRouter()

function goHome() {
  router.push('/')
}
</script>

<template>
  <div class="flex min-h-screen items-center justify-center">
    <div class="text-center">
      <h1 class="mb-4 text-4xl font-bold">404</h1>
      <p class="mb-6 text-lg text-muted-foreground">Page not found</p>
      <Button @click="goHome">Go Home</Button>
    </div>
  </div>
</template>

<script setup lang="ts">
import { onMounted } from 'vue'
import { Toaster } from '@/components/ui/toast'
import { useTheme } from '@/composables/useTheme'

// Initialize theme on app mount
const { initTheme } = useTheme()

onMounted(() => {
  initTheme()
})
</script>

<template>
  <div>
    <RouterView />
    <Toaster />
  </div>
</template>

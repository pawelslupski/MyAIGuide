<script setup lang="ts">
import { onMounted } from 'vue'
import { Toaster } from '@/components/ui/toast'
import { useTheme } from '@/composables/useTheme'
import { useAuthStore } from '@/stores/auth.store'

const { initTheme } = useTheme()

// Initialize auth synchronously so the router guard can observe isLoading
const authStore = useAuthStore()
authStore.initialize()

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

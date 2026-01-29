<script setup lang="ts">
import { Moon, Sun } from 'lucide-vue-next'
import { Button } from '@/components/ui/button'
import { useTheme } from '@/composables/useTheme'

const { resolvedTheme, toggleTheme } = useTheme()
</script>

<template>
  <Button
    variant="ghost"
    size="icon"
    :aria-label="resolvedTheme === 'dark' ? 'Switch to light mode' : 'Switch to dark mode'"
    title="Toggle theme"
    @click="toggleTheme"
  >
    <Sun v-if="resolvedTheme === 'dark'" class="h-5 w-5 transition-all" />
    <Moon v-else class="h-5 w-5 transition-all" />
  </Button>
</template>

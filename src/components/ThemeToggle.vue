<script setup lang="ts">
import { useI18n } from 'vue-i18n'
import { Moon, Sun } from 'lucide-vue-next'
import { Button } from '@/components/ui/button'
import { useTheme } from '@/composables/useTheme'

const { resolvedTheme, toggleTheme } = useTheme()
const { t } = useI18n()
</script>

<template>
  <Button
    variant="ghost"
    size="icon"
    :aria-label="resolvedTheme === 'dark' ? t('theme.switchToLight') : t('theme.switchToDark')"
    @click="toggleTheme"
  >
    <Sun v-if="resolvedTheme === 'dark'" class="h-5 w-5 transition-all" />
    <Moon v-else class="h-5 w-5 transition-all" />
  </Button>
</template>

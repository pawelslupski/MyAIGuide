<script setup lang="ts">
import { RouterLink, useRouter } from 'vue-router'
import { LogOut } from 'lucide-vue-next'
import { useI18n } from 'vue-i18n'
import ThemeToggle from '@/components/ThemeToggle.vue'
import LanguageSwitcher from '@/components/LanguageSwitcher.vue'
import { Button } from '@/components/ui/button'
import { useAuthStore } from '@/stores/auth.store'
import { isFeatureEnabled } from '@/lib/features/flags'

const router = useRouter()
const authStore = useAuthStore()
const { t } = useI18n()

const isAuthEnabled = isFeatureEnabled('auth')

async function handleLogout() {
  await authStore.logout()
  router.push('/login')
}
</script>

<template>
  <div class="min-h-screen bg-background">
    <header class="sticky top-0 z-40 border-b bg-background/95 backdrop-blur">
      <div class="container flex h-14 items-center justify-between px-4">
        <RouterLink to="/" class="text-lg font-bold">{{ t('brand.name') }}</RouterLink>

        <div class="flex items-center gap-2">
          <LanguageSwitcher />
          <ThemeToggle />

          <div v-if="isAuthEnabled" class="flex items-center gap-1">
            <span class="text-sm text-muted-foreground">{{ authStore.userEmail }}</span>
            <Button
              variant="ghost"
              size="sm"
              class="gap-1 text-muted-foreground"
              @click="handleLogout"
            >
              <LogOut class="h-4 w-4" />
              <span>{{ t('nav.logOut') }}</span>
            </Button>
          </div>
        </div>
      </div>
    </header>

    <main class="container px-4 py-6">
      <slot />
    </main>
  </div>
</template>

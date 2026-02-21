<script setup lang="ts">
import { ref, reactive } from 'vue'
import { RouterLink, useRoute, useRouter } from 'vue-router'
import { Loader2 } from 'lucide-vue-next'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Alert, AlertDescription } from '@/components/ui/alert'
import { CardContent, CardFooter, CardHeader, CardTitle } from '@/components/ui/card'
import { loginSchema } from '@/lib/validation/auth.schemas'
import AuthLayout from '@/layouts/AuthLayout.vue'
import { useAuthStore } from '@/stores/auth.store'

const route = useRoute()
const router = useRouter()
const authStore = useAuthStore()

const form = reactive({
  email: '',
  password: ''
})

const fieldErrors = reactive<{ email?: string; password?: string }>({})
const errorMessage = ref<string | null>(null)
const isLoading = ref(false)

async function handleSubmit() {
  errorMessage.value = null
  fieldErrors.email = undefined
  fieldErrors.password = undefined

  const result = loginSchema.safeParse(form)
  if (!result.success) {
    for (const issue of result.error.issues) {
      const field = issue.path[0] as keyof typeof fieldErrors
      fieldErrors[field] = issue.message
    }
    return
  }

  isLoading.value = true
  try {
    await authStore.login(form.email, form.password)
    await router.push((route.query.redirect as string) ?? '/')
  } catch (err: any) {
    errorMessage.value = mapAuthError(err)
  } finally {
    isLoading.value = false
  }
}

function mapAuthError(err: any): string {
  const msg = err?.message?.toLowerCase() ?? ''
  if (msg.includes('invalid') || msg.includes('credentials')) {
    return 'Invalid email or password. Please try again.'
  }
  if (msg.includes('rate') || msg.includes('too many')) {
    return 'Too many login attempts. Please wait a moment and try again.'
  }
  if (msg.includes('network') || msg.includes('fetch')) {
    return 'Unable to connect. Please check your internet connection.'
  }
  return 'An error occurred. Please try again.'
}
</script>

<template>
  <AuthLayout>
    <CardHeader>
      <CardTitle class="text-xl">Log in</CardTitle>
    </CardHeader>

    <CardContent>
      <form class="space-y-4" novalidate @submit.prevent="handleSubmit">
        <div class="space-y-1.5">
          <Label for="email">Email</Label>
          <Input
            id="email"
            v-model="form.email"
            type="email"
            autocomplete="email"
            placeholder="you@example.com"
            :class="fieldErrors.email ? 'border-destructive focus-visible:ring-destructive' : ''"
          />
          <p v-if="fieldErrors.email" class="text-xs text-destructive">{{ fieldErrors.email }}</p>
        </div>

        <div class="space-y-1.5">
          <Label for="password">Password</Label>
          <Input
            id="password"
            v-model="form.password"
            type="password"
            autocomplete="current-password"
            placeholder="••••••••"
            :class="fieldErrors.password ? 'border-destructive focus-visible:ring-destructive' : ''"
          />
          <p v-if="fieldErrors.password" class="text-xs text-destructive">
            {{ fieldErrors.password }}
          </p>
        </div>

        <Alert v-if="errorMessage" variant="destructive">
          <AlertDescription>{{ errorMessage }}</AlertDescription>
        </Alert>

        <Button type="submit" class="w-full" :disabled="isLoading">
          <Loader2 v-if="isLoading" class="mr-2 h-4 w-4 animate-spin" />
          {{ isLoading ? 'Logging in...' : 'Log in' }}
        </Button>
      </form>

      <div class="mt-4 text-center text-sm">
        <RouterLink
          to="/forgot-password"
          class="text-muted-foreground underline-offset-4 hover:underline"
        >
          Forgot password?
        </RouterLink>
      </div>
    </CardContent>

    <CardFooter class="justify-center border-t pt-4">
      <p class="text-sm text-muted-foreground">
        Don't have an account?
        <RouterLink
          to="/register"
          class="font-medium text-foreground underline-offset-4 hover:underline"
        >
          Register
        </RouterLink>
      </p>
    </CardFooter>
  </AuthLayout>
</template>

<script setup lang="ts">
import { ref, reactive } from 'vue'
import { RouterLink, useRouter } from 'vue-router'
import { Loader2 } from 'lucide-vue-next'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Alert, AlertDescription } from '@/components/ui/alert'
import { CardContent, CardFooter, CardHeader, CardTitle } from '@/components/ui/card'
import { registerSchema } from '@/lib/validation/auth.schemas'
import AuthLayout from '@/layouts/AuthLayout.vue'
import { useAuthStore } from '@/stores/auth.store'

const router = useRouter()
const authStore = useAuthStore()

const form = reactive({
  email: '',
  password: '',
  confirmPassword: ''
})

const fieldErrors = reactive<{ email?: string; password?: string; confirmPassword?: string }>({})
const errorMessage = ref<string | null>(null)
const isLoading = ref(false)

async function handleSubmit() {
  errorMessage.value = null
  fieldErrors.email = undefined
  fieldErrors.password = undefined
  fieldErrors.confirmPassword = undefined

  const result = registerSchema.safeParse(form)
  if (!result.success) {
    for (const issue of result.error.issues) {
      const field = issue.path[0] as keyof typeof fieldErrors
      if (!fieldErrors[field]) {
        fieldErrors[field] = issue.message
      }
    }
    return
  }

  isLoading.value = true
  try {
    await authStore.register(form.email, form.password)
    await router.push('/')
  } catch (err: any) {
    errorMessage.value = mapRegisterError(err)
  } finally {
    isLoading.value = false
  }
}

function mapRegisterError(err: any): string {
  const msg = err?.message?.toLowerCase() ?? ''
  if (msg.includes('already') || msg.includes('exists')) {
    return 'An account with this email already exists.'
  }
  if (msg.includes('password') && msg.includes('weak')) {
    return 'Password must be at least 6 characters.'
  }
  return 'Could not create account. Please try again.'
}
</script>

<template>
  <AuthLayout>
    <CardHeader>
      <CardTitle class="text-xl">Create account</CardTitle>
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
            autocomplete="new-password"
            placeholder="••••••••"
            :class="fieldErrors.password ? 'border-destructive focus-visible:ring-destructive' : ''"
          />
          <p v-if="fieldErrors.password" class="text-xs text-destructive">
            {{ fieldErrors.password }}
          </p>
        </div>

        <div class="space-y-1.5">
          <Label for="confirm-password">Confirm password</Label>
          <Input
            id="confirm-password"
            v-model="form.confirmPassword"
            type="password"
            autocomplete="new-password"
            placeholder="••••••••"
            :class="
              fieldErrors.confirmPassword ? 'border-destructive focus-visible:ring-destructive' : ''
            "
          />
          <p v-if="fieldErrors.confirmPassword" class="text-xs text-destructive">
            {{ fieldErrors.confirmPassword }}
          </p>
        </div>

        <Alert v-if="errorMessage" variant="destructive">
          <AlertDescription>{{ errorMessage }}</AlertDescription>
        </Alert>

        <Button type="submit" class="w-full" :disabled="isLoading">
          <Loader2 v-if="isLoading" class="mr-2 h-4 w-4 animate-spin" />
          {{ isLoading ? 'Creating account...' : 'Create account' }}
        </Button>
      </form>
    </CardContent>

    <CardFooter class="justify-center border-t pt-4">
      <p class="text-sm text-muted-foreground">
        Already have an account?
        <RouterLink
          to="/login"
          class="font-medium text-foreground underline-offset-4 hover:underline"
        >
          Log in
        </RouterLink>
      </p>
    </CardFooter>
  </AuthLayout>
</template>

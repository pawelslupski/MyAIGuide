<script setup lang="ts">
import { ref, reactive } from 'vue'
import { RouterLink } from 'vue-router'
import { Loader2, MailCheck } from 'lucide-vue-next'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Alert, AlertDescription } from '@/components/ui/alert'
import {
  CardContent,
  CardFooter,
  CardHeader,
  CardTitle,
  CardDescription
} from '@/components/ui/card'
import { forgotPasswordSchema } from '@/lib/validation/auth.schemas'
import AuthLayout from '@/layouts/AuthLayout.vue'

// TODO: import { useAuthStore } from '@/stores/auth.store'
// const authStore = useAuthStore()

const form = reactive({ email: '' })
const fieldErrors = reactive<{ email?: string }>({})
const errorMessage = ref<string | null>(null)
const isLoading = ref(false)
const submitted = ref(false)

async function handleSubmit() {
  errorMessage.value = null
  fieldErrors.email = undefined

  const result = forgotPasswordSchema.safeParse(form)
  if (!result.success) {
    fieldErrors.email = result.error.issues[0]?.message
    return
  }

  isLoading.value = true
  try {
    // TODO: await authStore.resetPassword(form.email)
    submitted.value = true
  } catch (_err: any) {
    // Always show success (security best practice — do not reveal if email exists)
    submitted.value = true
  } finally {
    isLoading.value = false
  }
}
</script>

<template>
  <AuthLayout>
    <CardHeader>
      <CardTitle class="text-xl">Reset your password</CardTitle>
      <CardDescription>
        Enter your email address and we'll send you a link to reset your password.
      </CardDescription>
    </CardHeader>

    <CardContent>
      <!-- Success state -->
      <div v-if="submitted" class="flex flex-col items-center gap-4 py-4 text-center">
        <MailCheck class="h-12 w-12 text-muted-foreground" />
        <p class="text-sm text-muted-foreground">
          If an account with that email exists, we've sent a password reset link. Check your inbox.
        </p>
        <RouterLink to="/login">
          <Button variant="outline" class="w-full">Back to login</Button>
        </RouterLink>
      </div>

      <!-- Form state -->
      <form v-else class="space-y-4" novalidate @submit.prevent="handleSubmit">
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

        <Alert v-if="errorMessage" variant="destructive">
          <AlertDescription>{{ errorMessage }}</AlertDescription>
        </Alert>

        <Button type="submit" class="w-full" :disabled="isLoading">
          <Loader2 v-if="isLoading" class="mr-2 h-4 w-4 animate-spin" />
          {{ isLoading ? 'Sending...' : 'Send reset link' }}
        </Button>
      </form>
    </CardContent>

    <CardFooter v-if="!submitted" class="justify-center border-t pt-4">
      <RouterLink
        to="/login"
        class="text-sm text-muted-foreground underline-offset-4 hover:underline"
      >
        Back to login
      </RouterLink>
    </CardFooter>
  </AuthLayout>
</template>

<script setup lang="ts">
import { ref, reactive } from 'vue'
import { RouterLink } from 'vue-router'
import { Loader2, ShieldCheck } from 'lucide-vue-next'
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
import { resetPasswordSchema } from '@/lib/validation/auth.schemas'
import AuthLayout from '@/layouts/AuthLayout.vue'

// TODO: import { useAuthStore } from '@/stores/auth.store'
// const authStore = useAuthStore()
// Note: user arrives via Supabase recovery email link; token is handled by onAuthStateChange

const form = reactive({
  password: '',
  confirmPassword: ''
})

const fieldErrors = reactive<{ password?: string; confirmPassword?: string }>({})
const errorMessage = ref<string | null>(null)
const isLoading = ref(false)
const success = ref(false)

async function handleSubmit() {
  errorMessage.value = null
  fieldErrors.password = undefined
  fieldErrors.confirmPassword = undefined

  const result = resetPasswordSchema.safeParse(form)
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
    // TODO: await authStore.updatePassword(form.password)
    success.value = true
  } catch (err: any) {
    errorMessage.value = mapResetError(err)
  } finally {
    isLoading.value = false
  }
}

function mapResetError(err: any): string {
  const msg = err?.message?.toLowerCase() ?? ''
  if (msg.includes('expired') || msg.includes('invalid') || msg.includes('token')) {
    return 'This reset link has expired or is invalid. Please request a new one.'
  }
  return 'Could not update password. Please try again.'
}
</script>

<template>
  <AuthLayout>
    <CardHeader>
      <CardTitle class="text-xl">Set new password</CardTitle>
      <CardDescription v-if="!success">
        Choose a strong password for your account.
      </CardDescription>
    </CardHeader>

    <CardContent>
      <!-- Success state -->
      <div v-if="success" class="flex flex-col items-center gap-4 py-4 text-center">
        <ShieldCheck class="h-12 w-12 text-muted-foreground" />
        <p class="text-sm text-muted-foreground">Your password has been updated successfully.</p>
        <RouterLink to="/login" class="w-full">
          <Button class="w-full">Go to login</Button>
        </RouterLink>
      </div>

      <!-- Form state -->
      <form v-else class="space-y-4" novalidate @submit.prevent="handleSubmit">
        <div class="space-y-1.5">
          <Label for="password">New password</Label>
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
          <Label for="confirm-password">Confirm new password</Label>
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
          {{ isLoading ? 'Updating...' : 'Update password' }}
        </Button>
      </form>
    </CardContent>

    <CardFooter v-if="!success" class="justify-center border-t pt-4">
      <RouterLink
        to="/forgot-password"
        class="text-sm text-muted-foreground underline-offset-4 hover:underline"
      >
        Request a new reset link
      </RouterLink>
    </CardFooter>
  </AuthLayout>
</template>

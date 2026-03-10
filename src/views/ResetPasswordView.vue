<script setup lang="ts">
import { ref } from 'vue'
import { RouterLink } from 'vue-router'
import { useForm } from 'vee-validate'
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
import { toTypedSchema } from '@/lib/validation/zod-adapter'
import AuthLayout from '@/layouts/AuthLayout.vue'
import { useAuthStore } from '@/stores/auth.store'

const authStore = useAuthStore()
// Note: user arrives via Supabase recovery email link; token is handled by onAuthStateChange

const { handleSubmit, errors, isSubmitting, defineField } = useForm({
  validationSchema: toTypedSchema(resetPasswordSchema)
})

const [password, passwordAttrs] = defineField('password')
const [confirmPassword, confirmPasswordAttrs] = defineField('confirmPassword')

const serverError = ref<string | null>(null)
const success = ref(false)

const onSubmit = handleSubmit(async (values) => {
  serverError.value = null
  try {
    await authStore.updatePassword(values.password)
    success.value = true
  } catch (err: any) {
    const msg = err?.message?.toLowerCase() ?? ''
    if (msg.includes('expired') || msg.includes('invalid') || msg.includes('token')) {
      serverError.value = 'This reset link has expired or is invalid. Please request a new one.'
    } else {
      serverError.value = 'Could not update password. Please try again.'
    }
  }
})
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
      <form v-else class="space-y-4" novalidate @submit.prevent="onSubmit">
        <div class="space-y-1.5">
          <Label for="password">New password</Label>
          <Input
            id="password"
            v-model="password"
            v-bind="passwordAttrs"
            type="password"
            autocomplete="new-password"
            placeholder="••••••••"
            :class="errors.password ? 'border-destructive focus-visible:ring-destructive' : ''"
          />
          <p v-if="errors.password" class="text-xs text-destructive">{{ errors.password }}</p>
        </div>

        <div class="space-y-1.5">
          <Label for="confirm-password">Confirm new password</Label>
          <Input
            id="confirm-password"
            v-model="confirmPassword"
            v-bind="confirmPasswordAttrs"
            type="password"
            autocomplete="new-password"
            placeholder="••••••••"
            :class="
              errors.confirmPassword ? 'border-destructive focus-visible:ring-destructive' : ''
            "
          />
          <p v-if="errors.confirmPassword" class="text-xs text-destructive">
            {{ errors.confirmPassword }}
          </p>
        </div>

        <Alert v-if="serverError" variant="destructive">
          <AlertDescription>{{ serverError }}</AlertDescription>
        </Alert>

        <Button type="submit" class="w-full" :disabled="isSubmitting">
          <Loader2 v-if="isSubmitting" class="mr-2 h-4 w-4 animate-spin" />
          {{ isSubmitting ? 'Updating...' : 'Update password' }}
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

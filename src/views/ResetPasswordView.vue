<script setup lang="ts">
import { ref, onMounted } from 'vue'
import { RouterLink, useRouter } from 'vue-router'
import { useForm } from 'vee-validate'
import { useI18n } from 'vue-i18n'
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
import { isFeatureEnabled } from '@/lib/features/flags'

const router = useRouter()
const authStore = useAuthStore()
const { t } = useI18n()
// Note: user arrives via Supabase recovery email link; token is handled by onAuthStateChange

onMounted(() => {
  if (!isFeatureEnabled('auth')) {
    router.replace('/')
  }
})

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
      serverError.value = t('auth.errors.expiredLink')
    } else {
      serverError.value = t('auth.errors.passwordUpdateFailed')
    }
  }
})
</script>

<template>
  <AuthLayout>
    <CardHeader>
      <CardTitle class="text-xl">{{ t('auth.resetPassword.title') }}</CardTitle>
      <CardDescription v-if="!success">{{ t('auth.resetPassword.description') }}</CardDescription>
    </CardHeader>

    <CardContent>
      <!-- Success state -->
      <div v-if="success" class="flex flex-col items-center gap-4 py-4 text-center">
        <ShieldCheck class="h-12 w-12 text-muted-foreground" />
        <p class="text-sm text-muted-foreground">{{ t('auth.resetPassword.successMessage') }}</p>
        <RouterLink to="/login" class="w-full">
          <Button class="w-full">{{ t('auth.resetPassword.goToLogin') }}</Button>
        </RouterLink>
      </div>

      <!-- Form state -->
      <form v-else class="space-y-4" novalidate @submit.prevent="onSubmit">
        <div class="space-y-1.5">
          <Label for="password">{{ t('auth.newPasswordLabel') }}</Label>
          <Input
            id="password"
            v-model="password"
            v-bind="passwordAttrs"
            type="password"
            autocomplete="new-password"
            placeholder="••••••••"
            :class="errors.password ? 'border-destructive focus-visible:ring-destructive' : ''"
          />
          <p v-if="errors.password" class="text-xs text-destructive">{{ t(errors.password) }}</p>
        </div>

        <div class="space-y-1.5">
          <Label for="confirm-password">{{ t('auth.confirmNewPasswordLabel') }}</Label>
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
            {{ t(errors.confirmPassword) }}
          </p>
        </div>

        <Alert v-if="serverError" variant="destructive">
          <AlertDescription>{{ serverError }}</AlertDescription>
        </Alert>

        <Button type="submit" class="w-full" :disabled="isSubmitting">
          <Loader2 v-if="isSubmitting" class="mr-2 h-4 w-4 animate-spin" />
          {{ isSubmitting ? t('auth.resetPassword.submitting') : t('auth.resetPassword.submit') }}
        </Button>
      </form>
    </CardContent>

    <CardFooter v-if="!success" class="justify-center border-t pt-4">
      <RouterLink
        to="/forgot-password"
        class="text-sm text-muted-foreground underline-offset-4 hover:underline"
      >
        {{ t('auth.resetPassword.requestNewLink') }}
      </RouterLink>
    </CardFooter>
  </AuthLayout>
</template>

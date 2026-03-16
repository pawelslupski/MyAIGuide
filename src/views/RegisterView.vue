<script setup lang="ts">
import { ref, onMounted } from 'vue'
import { RouterLink, useRouter } from 'vue-router'
import { useForm } from 'vee-validate'
import { useI18n } from 'vue-i18n'
import { Loader2 } from 'lucide-vue-next'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Alert, AlertDescription } from '@/components/ui/alert'
import { CardContent, CardFooter, CardHeader, CardTitle } from '@/components/ui/card'
import { registerSchema } from '@/lib/validation/auth.schemas'
import { toTypedSchema } from '@/lib/validation/zod-adapter'
import AuthLayout from '@/layouts/AuthLayout.vue'
import { useAuthStore } from '@/stores/auth.store'
import { isFeatureEnabled } from '@/lib/features/flags'

const router = useRouter()
const authStore = useAuthStore()
const { t } = useI18n()

onMounted(() => {
  if (!isFeatureEnabled('auth')) {
    router.replace('/')
  }
})

const { handleSubmit, errors, isSubmitting, defineField, setErrors } = useForm({
  validationSchema: toTypedSchema(registerSchema)
})

const [email, emailAttrs] = defineField('email')
const [password, passwordAttrs] = defineField('password')
const [confirmPassword, confirmPasswordAttrs] = defineField('confirmPassword')

const serverError = ref<string | null>(null)

const onSubmit = handleSubmit(async (values) => {
  serverError.value = null
  try {
    await authStore.register(values.email, values.password)
    await router.push('/')
  } catch (err: any) {
    const msg = err?.message?.toLowerCase() ?? ''
    if (msg.includes('already') || msg.includes('exists')) {
      setErrors({ email: t('auth.errors.emailExists') })
    } else if (msg.includes('password') && msg.includes('weak')) {
      setErrors({ password: t('auth.errors.weakPassword') })
    } else {
      serverError.value = t('auth.errors.accountCreationFailed')
    }
  }
})
</script>

<template>
  <AuthLayout>
    <CardHeader>
      <CardTitle class="text-xl">{{ t('auth.register.title') }}</CardTitle>
    </CardHeader>

    <CardContent>
      <form class="space-y-4" novalidate @submit.prevent="onSubmit">
        <div class="space-y-1.5">
          <Label for="email">{{ t('auth.emailLabel') }}</Label>
          <Input
            id="email"
            v-model="email"
            v-bind="emailAttrs"
            type="email"
            autocomplete="email"
            :placeholder="t('auth.emailPlaceholder')"
            :class="errors.email ? 'border-destructive focus-visible:ring-destructive' : ''"
          />
          <p v-if="errors.email" class="text-xs text-destructive">{{ t(errors.email) }}</p>
        </div>

        <div class="space-y-1.5">
          <Label for="password">{{ t('auth.passwordLabel') }}</Label>
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
          <Label for="confirm-password">{{ t('auth.confirmPasswordLabel') }}</Label>
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
          {{ isSubmitting ? t('auth.register.submitting') : t('auth.register.submit') }}
        </Button>
      </form>
    </CardContent>

    <CardFooter class="justify-center border-t pt-4">
      <p class="text-sm text-muted-foreground">
        {{ t('auth.register.hasAccount') }}
        <RouterLink
          to="/login"
          class="font-medium text-foreground underline-offset-4 hover:underline"
        >
          {{ t('auth.register.logIn') }}
        </RouterLink>
      </p>
    </CardFooter>
  </AuthLayout>
</template>

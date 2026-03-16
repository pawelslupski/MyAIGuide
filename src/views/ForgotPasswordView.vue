<script setup lang="ts">
import { ref } from 'vue'
import { RouterLink } from 'vue-router'
import { useForm } from 'vee-validate'
import { useI18n } from 'vue-i18n'
import { Loader2, MailCheck } from 'lucide-vue-next'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import {
  CardContent,
  CardFooter,
  CardHeader,
  CardTitle,
  CardDescription
} from '@/components/ui/card'
import { forgotPasswordSchema } from '@/lib/validation/auth.schemas'
import { toTypedSchema } from '@/lib/validation/zod-adapter'
import AuthLayout from '@/layouts/AuthLayout.vue'
import { useAuthStore } from '@/stores/auth.store'

const authStore = useAuthStore()
const { t } = useI18n()

const { handleSubmit, errors, isSubmitting, defineField } = useForm({
  validationSchema: toTypedSchema(forgotPasswordSchema)
})

const [email, emailAttrs] = defineField('email')
const submitted = ref(false)

const onSubmit = handleSubmit(async (values) => {
  try {
    await authStore.resetPassword(values.email)
  } catch {
    // Always show success — security best practice (do not reveal if email exists)
  } finally {
    submitted.value = true
  }
})
</script>

<template>
  <AuthLayout>
    <CardHeader>
      <CardTitle class="text-xl">{{ t('auth.forgotPassword.title') }}</CardTitle>
      <CardDescription>{{ t('auth.forgotPassword.description') }}</CardDescription>
    </CardHeader>

    <CardContent>
      <!-- Success state -->
      <div v-if="submitted" class="flex flex-col items-center gap-4 py-4 text-center">
        <MailCheck class="h-12 w-12 text-muted-foreground" />
        <p class="text-sm text-muted-foreground">
          {{ t('auth.forgotPassword.successMessage') }}
        </p>
        <RouterLink to="/login">
          <Button variant="outline" class="w-full">{{
            t('auth.forgotPassword.backToLogin')
          }}</Button>
        </RouterLink>
      </div>

      <!-- Form state -->
      <form v-else class="space-y-4" novalidate @submit.prevent="onSubmit">
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

        <Button type="submit" class="w-full" :disabled="isSubmitting">
          <Loader2 v-if="isSubmitting" class="mr-2 h-4 w-4 animate-spin" />
          {{ isSubmitting ? t('auth.forgotPassword.submitting') : t('auth.forgotPassword.submit') }}
        </Button>
      </form>
    </CardContent>

    <CardFooter v-if="!submitted" class="justify-center border-t pt-4">
      <RouterLink
        to="/login"
        class="text-sm text-muted-foreground underline-offset-4 hover:underline"
      >
        {{ t('auth.forgotPassword.backToLogin') }}
      </RouterLink>
    </CardFooter>
  </AuthLayout>
</template>

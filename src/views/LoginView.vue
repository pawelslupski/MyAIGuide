<script setup lang="ts">
import { ref } from 'vue'
import { RouterLink, useRoute, useRouter } from 'vue-router'
import { useForm } from 'vee-validate'
import { Loader2 } from 'lucide-vue-next'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Alert, AlertDescription } from '@/components/ui/alert'
import { CardContent, CardFooter, CardHeader, CardTitle } from '@/components/ui/card'
import { loginSchema } from '@/lib/validation/auth.schemas'
import { toTypedSchema } from '@/lib/validation/zod-adapter'
import AuthLayout from '@/layouts/AuthLayout.vue'
import { useAuthStore } from '@/stores/auth.store'

const route = useRoute()
const router = useRouter()
const authStore = useAuthStore()

const { handleSubmit, errors, isSubmitting, defineField } = useForm({
  validationSchema: toTypedSchema(loginSchema)
})

const [email, emailAttrs] = defineField('email')
const [password, passwordAttrs] = defineField('password')

const serverError = ref<string | null>(null)

const onSubmit = handleSubmit(async (values) => {
  serverError.value = null
  try {
    await authStore.login(values.email, values.password)
    await router.push((route.query.redirect as string) ?? '/')
  } catch (err: any) {
    const msg = err?.message?.toLowerCase() ?? ''
    if (msg.includes('invalid') || msg.includes('credentials')) {
      serverError.value = 'Invalid email or password. Please try again.'
    } else if (msg.includes('rate') || msg.includes('too many')) {
      serverError.value = 'Too many login attempts. Please wait a moment and try again.'
    } else if (msg.includes('network') || msg.includes('fetch')) {
      serverError.value = 'Unable to connect. Please check your internet connection.'
    } else {
      serverError.value = 'An error occurred. Please try again.'
    }
  }
})
</script>

<template>
  <AuthLayout>
    <CardHeader>
      <CardTitle class="text-xl">Log in</CardTitle>
    </CardHeader>

    <CardContent>
      <form class="space-y-4" novalidate @submit.prevent="onSubmit">
        <div class="space-y-1.5">
          <Label for="email">Email</Label>
          <Input
            id="email"
            v-model="email"
            v-bind="emailAttrs"
            type="email"
            autocomplete="email"
            placeholder="you@example.com"
            :class="errors.email ? 'border-destructive focus-visible:ring-destructive' : ''"
          />
          <p v-if="errors.email" class="text-xs text-destructive">{{ errors.email }}</p>
        </div>

        <div class="space-y-1.5">
          <Label for="password">Password</Label>
          <Input
            id="password"
            v-model="password"
            v-bind="passwordAttrs"
            type="password"
            autocomplete="current-password"
            placeholder="••••••••"
            :class="errors.password ? 'border-destructive focus-visible:ring-destructive' : ''"
          />
          <p v-if="errors.password" class="text-xs text-destructive">{{ errors.password }}</p>
        </div>

        <Alert v-if="serverError" variant="destructive">
          <AlertDescription>{{ serverError }}</AlertDescription>
        </Alert>

        <Button type="submit" class="w-full" :disabled="isSubmitting">
          <Loader2 v-if="isSubmitting" class="mr-2 h-4 w-4 animate-spin" />
          {{ isSubmitting ? 'Logging in...' : 'Log in' }}
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

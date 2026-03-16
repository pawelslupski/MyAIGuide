import { z } from 'zod'

const coerceStr = (val: unknown) => (val == null ? '' : val)

const emailField = z.preprocess(
  coerceStr,
  z.string().min(1, 'auth.validation.emailRequired').email('auth.validation.emailInvalid')
)

const passwordField = z.preprocess(
  coerceStr,
  z.string().min(1, 'auth.validation.passwordRequired').min(6, 'auth.validation.passwordTooShort')
)

const confirmPasswordField = z.preprocess(
  coerceStr,
  z.string().min(1, 'auth.validation.confirmPasswordRequired')
)

export const loginSchema = z.object({
  email: emailField,
  password: passwordField
})

export const registerSchema = z
  .object({
    email: emailField,
    password: passwordField,
    confirmPassword: confirmPasswordField
  })
  .refine((data) => data.password === data.confirmPassword, {
    message: 'auth.validation.passwordsMismatch',
    path: ['confirmPassword']
  })

export const forgotPasswordSchema = z.object({
  email: emailField
})

export const resetPasswordSchema = z
  .object({
    password: passwordField,
    confirmPassword: confirmPasswordField
  })
  .refine((data) => data.password === data.confirmPassword, {
    message: 'auth.validation.passwordsMismatch',
    path: ['confirmPassword']
  })

export type LoginFormData = z.infer<typeof loginSchema>
export type RegisterFormData = z.infer<typeof registerSchema>
export type ForgotPasswordFormData = z.infer<typeof forgotPasswordSchema>
export type ResetPasswordFormData = z.infer<typeof resetPasswordSchema>

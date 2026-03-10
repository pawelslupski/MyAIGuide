/**
 * Minimal Zod 4 → VeeValidate TypedSchema adapter.
 *
 * The official @vee-validate/zod package only supports Zod 3.
 * This adapter bridges Zod 4's safeParse API to VeeValidate 4's TypedSchema contract.
 */
import type { ZodType } from 'zod'
import type { TypedSchema } from 'vee-validate'

export function toTypedSchema<T>(schema: ZodType<T>): TypedSchema {
  const vvSchema: TypedSchema = {
    __type: 'VVTypedSchema',
    async parse(value: unknown) {
      const result = schema.safeParse(value)
      if (result.success) {
        return { value: result.data as T, errors: [] }
      }
      return {
        errors: result.error.issues.map((issue) => ({
          path: issue.path.length > 0 ? issue.path.map(String).join('.') : undefined,
          errors: [issue.message] // VeeValidate 4 expects errors: string[], not message: string
        }))
      }
    }
  }
  return vvSchema
}

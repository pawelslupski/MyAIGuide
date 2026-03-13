export type FeatureName = 'auth' | 'plan-generation'
export type EnvName = 'local' | 'integration' | 'prod'

type FeatureConfig = Record<FeatureName, Record<EnvName, boolean>>

const featureFlags: FeatureConfig = {
  auth: {
    local: true,
    integration: true,
    prod: true
  },
  'plan-generation': {
    local: true,
    integration: true,
    prod: true
  }
}

function resolveEnv(): EnvName {
  // Vite/browser context — VITE_ENV_NAME injected at build time via import.meta.env
  const viteEnv = (import.meta as any).env?.VITE_ENV_NAME
  if (viteEnv === 'local' || viteEnv === 'integration' || viteEnv === 'prod') {
    return viteEnv
  }
  // Deno context — Supabase Edge Functions read ENV_NAME from the process environment
  const denoGlobal = (globalThis as any).Deno
  if (denoGlobal) {
    const denoEnv = denoGlobal.env.get('ENV_NAME')
    if (denoEnv === 'local' || denoEnv === 'integration' || denoEnv === 'prod') {
      return denoEnv as EnvName
    }
  }
  return 'local'
}

// Resolved once at module load — never re-evaluated during the lifetime of the process
const ENV: EnvName = resolveEnv()
console.log(`[FeatureFlags] Environment resolved: ${ENV}`)

export function isFeatureEnabled(feature: FeatureName): boolean {
  const result = featureFlags[feature][ENV]
  console.log(`[FeatureFlags] isFeatureEnabled('${feature}') → ${result} (env: ${ENV})`)
  return result
}

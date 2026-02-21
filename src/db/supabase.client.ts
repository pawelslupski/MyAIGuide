import { createClient } from '@supabase/supabase-js'
import type { Database } from '../db/database.types'

export const supabaseClient = createClient<Database>(
  import.meta.env.VITE_SUPABASE_URL,
  import.meta.env.VITE_SUPABASE_ANON_KEY,
  {
    auth: {
      persistSession: true, // store session in localStorage; restored via getSession() on reload
      autoRefreshToken: true, // silently refresh JWT before expiry (jwt_expiry = 3600 in config.toml)
      detectSessionInUrl: true // parse #access_token from URL hash — required for PASSWORD_RECOVERY event on /reset-password
    }
  }
)

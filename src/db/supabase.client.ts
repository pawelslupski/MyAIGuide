import { createClient } from '@supabase/supabase-js'

import type { Database } from '../db/database.types'

const supabaseUrl = import.meta.env.SUPABASE_URL
const supabaseAnonKey = import.meta.env.SUPABASE_ANON_KEY

export const supabaseClient = createClient<Database>(supabaseUrl, supabaseAnonKey)

/**
 * Default user ID for development/testing
 * Used when authentication is disabled
 */
export const DEFAULT_USER_ID = '00000000-0000-0000-0000-000000000000'

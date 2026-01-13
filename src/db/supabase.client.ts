import { createClient } from '@supabase/supabase-js'

import type { Database } from '../db/database.types'

const supabaseUrl = import.meta.env.VITE_SUPABASE_URL
const supabaseKey = import.meta.env.VITE_SUPABASE_KEY

export const supabaseClient = createClient<Database>(supabaseUrl, supabaseKey)

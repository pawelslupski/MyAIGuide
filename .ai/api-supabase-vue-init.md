---
description:
globs:
alwaysApply: false
---

# Supabase Vue 3 Initialization

This document provides a reproducible guide to create the necessary file structure for integrating Supabase with your
Vue 3 project.

## Prerequisites

- Your project should use Vue 3.5, Vite 7, TypeScript 5, and Tailwind CSS 3.
- Install the `@supabase/supabase-js` package.
- Ensure that `/supabase/config.toml` exists
- Ensure that a file `/src/db/database.types.ts` exists and contains the correct type definitions for your database.

IMPORTANT: Check prerequisites before performing actions below. If they're not met, stop and ask the user for the fix.

## File Structure and Setup

### 1. Supabase Client Initialization

Create the file `/src/db/supabase.client.ts` with the following content:

```ts
import { createClient } from '@supabase/supabase-js'

import type { Database } from '../db/database.types.ts'

const supabaseUrl = import.meta.env.VITE_SUPABASE_URL
const supabaseKey = import.meta.env.VITE_SUPABASE_KEY

export const supabaseClient = createClient<Database>(supabaseUrl, supabaseKey)
```

This file initializes the Supabase client using the environment variables `VITE_SUPABASE_URL` and `VITE_SUPABASE_KEY`.

### 2. TypeScript Environment Definitions

Create the file `src/vite-env.d.ts` with the following content:

```ts
/// <reference types="vite/client" />

interface ImportMetaEnv {
  readonly VITE_SUPABASE_URL: string
  readonly VITE_SUPABASE_KEY: string
}

interface ImportMeta {
  readonly env: ImportMetaEnv
}
```

This file ensures proper TypeScript typing for Vite environment variables.

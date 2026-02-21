import { ref } from 'vue'

/**
 * Theme mode type
 */
export type ThemeMode = 'light' | 'dark' | 'system'

/**
 * Resolved theme (actual theme applied to DOM)
 */
export type ResolvedTheme = 'light' | 'dark'

/**
 * Local storage key for theme preference
 */
const THEME_STORAGE_KEY = 'myaiguide-theme'

/**
 * Current theme mode (user preference)
 */
const themeMode = ref<ThemeMode>('system')

/**
 * Resolved theme (actual theme applied)
 */
const resolvedTheme = ref<ResolvedTheme>('light')

/**
 * Check if system prefers dark mode
 */
function getSystemTheme(): ResolvedTheme {
  if (typeof window === 'undefined') return 'light'
  return window.matchMedia('(prefers-color-scheme: dark)').matches ? 'dark' : 'light'
}

/**
 * Apply theme to DOM
 */
function applyTheme(theme: ResolvedTheme): void {
  const root = document.documentElement

  if (theme === 'dark') {
    root.classList.add('dark')
  } else {
    root.classList.remove('dark')
  }

  resolvedTheme.value = theme
}

/**
 * Resolve theme mode to actual theme
 */
function resolveTheme(mode: ThemeMode): ResolvedTheme {
  if (mode === 'system') {
    return getSystemTheme()
  }
  return mode
}

/**
 * Load theme from localStorage
 */
function loadTheme(): ThemeMode {
  if (typeof window === 'undefined') return 'system'

  const stored = localStorage.getItem(THEME_STORAGE_KEY)
  if (stored === 'light' || stored === 'dark' || stored === 'system') {
    return stored
  }

  return 'system'
}

/**
 * Save theme to localStorage
 */
function saveTheme(mode: ThemeMode): void {
  if (typeof window === 'undefined') return
  localStorage.setItem(THEME_STORAGE_KEY, mode)
}

/**
 * Composable for theme management
 *
 * Features:
 * - Toggle between light/dark/system modes
 * - Persist preference in localStorage
 * - Listen to system theme changes
 * - Apply theme to DOM automatically
 *
 * @example
 * ```vue
 * <script setup lang="ts">
 * import { useTheme } from '@/composables/useTheme'
 *
 * const { themeMode, resolvedTheme, setTheme, toggleTheme } = useTheme()
 * </script>
 * ```
 */
export function useTheme() {
  /**
   * Set theme mode
   */
  function setTheme(mode: ThemeMode): void {
    themeMode.value = mode
    saveTheme(mode)
    const resolved = resolveTheme(mode)
    applyTheme(resolved)
  }

  /**
   * Toggle between light and dark (ignores system)
   */
  function toggleTheme(): void {
    const newMode = resolvedTheme.value === 'dark' ? 'light' : 'dark'
    setTheme(newMode)
  }

  /**
   * Initialize theme on mount
   */
  function initTheme(): void {
    const mode = loadTheme()
    themeMode.value = mode
    const resolved = resolveTheme(mode)
    applyTheme(resolved)

    // Listen to system theme changes
    if (typeof window !== 'undefined') {
      const mediaQuery = window.matchMedia('(prefers-color-scheme: dark)')
      const handleChange = () => {
        if (themeMode.value === 'system') {
          const resolved = getSystemTheme()
          applyTheme(resolved)
        }
      }

      mediaQuery.addEventListener('change', handleChange)

      // Cleanup on unmount (handled by Vue automatically)
      // @ts-expect-error Vue watch cleanup return type mismatch
      return () => mediaQuery.removeEventListener('change', handleChange)
    }
  }

  return {
    themeMode,
    resolvedTheme,
    setTheme,
    toggleTheme,
    initTheme
  }
}

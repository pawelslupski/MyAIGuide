import { createRouter, createWebHistory } from 'vue-router'

declare module 'vue-router' {
  interface RouteMeta {
    requiresAuth?: boolean
    guestOnly?: boolean
  }
}

const routes = [
  {
    path: '/login',
    name: 'login',
    component: () => import('@/views/LoginView.vue'),
    meta: { requiresAuth: false, guestOnly: true }
  },
  {
    path: '/register',
    name: 'register',
    component: () => import('@/views/RegisterView.vue'),
    meta: { requiresAuth: false, guestOnly: true }
  },
  {
    path: '/forgot-password',
    name: 'forgot-password',
    component: () => import('@/views/ForgotPasswordView.vue'),
    meta: { requiresAuth: false, guestOnly: true }
  },
  {
    path: '/reset-password',
    name: 'reset-password',
    component: () => import('@/views/ResetPasswordView.vue'),
    meta: { requiresAuth: false }
  },
  {
    path: '/',
    name: 'dashboard',
    component: () => import('@/views/DashboardView.vue'),
    meta: { requiresAuth: true }
  },
  {
    path: '/trips/:id',
    name: 'trip-detail',
    component: () => import('@/views/TripView.vue'),
    meta: { requiresAuth: true },
    beforeEnter: (to: any) => {
      const tripId = parseInt(to.params.id as string, 10)
      if (isNaN(tripId) || tripId <= 0) {
        return { name: 'not-found' }
      }
    }
  },
  {
    path: '/:pathMatch(.*)*',
    name: 'not-found',
    component: () => import('@/views/NotFoundView.vue')
  }
]

const router = createRouter({
  history: createWebHistory(),
  routes,
  scrollBehavior(_to, _from, savedPosition) {
    if (savedPosition) {
      return savedPosition
    }
    return { top: 0 }
  }
})

router.beforeEach(async (to) => {
  const { watch } = await import('vue')
  const { useAuthStore } = await import('@/stores/auth.store')
  const authStore = useAuthStore()

  // Wait for initial session check to complete before making auth decisions.
  // Without this, page refresh always redirects to /login (session not yet restored).
  if (authStore.isLoading) {
    await new Promise<void>((resolve) => {
      const unwatch = watch(
        () => authStore.isLoading,
        (loading) => {
          if (!loading) {
            unwatch()
            resolve()
          }
        },
        { immediate: true }
      )
    })
  }

  if (to.meta.requiresAuth && !authStore.isAuthenticated) {
    return { name: 'login', query: { redirect: to.fullPath } }
  }

  if (to.meta.guestOnly && authStore.isAuthenticated) {
    return { name: 'dashboard' }
  }
})

export default router

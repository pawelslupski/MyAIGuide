import { createRouter, createWebHistory } from 'vue-router'

/**
 * Vue Router Configuration
 * Defines application routes with lazy loading and meta fields
 */

const routes = [
  {
    path: '/',
    name: 'home',
    component: () => import('@/views/DemoView.vue')
  },
  {
    path: '/trips/:id',
    name: 'trip-detail',
    component: () => import('@/views/TripDetailView.vue'),
    meta: {
      requiresAuth: true,
      title: 'Trip Details'
    },
    beforeEnter: (to: any) => {
      // Validate trip ID format (must be positive integer)
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
    } else {
      return { top: 0 }
    }
  }
})

export default router

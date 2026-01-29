<script setup lang="ts">
import { useRouter } from 'vue-router'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'

const router = useRouter()

function goToTrip(id: number) {
  router.push(`/trips/${id}`)
}
</script>

<template>
  <div class="container mx-auto px-4 py-8">
    <div class="mx-auto max-w-2xl space-y-6">
      <div class="space-y-2 text-center">
        <h1 class="text-4xl font-bold">MyAIGuide Demo</h1>
        <p class="text-muted-foreground">Frontend implementation in progress</p>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Current Implementation Status</CardTitle>
          <CardDescription>Phase 1 Complete - Core Structure</CardDescription>
        </CardHeader>
        <CardContent class="space-y-4">
          <div>
            <h3 class="mb-2 font-semibold">✅ Completed:</h3>
            <ul class="list-inside list-disc space-y-1 text-sm text-muted-foreground">
              <li>Vue Router configuration with lazy loading</li>
              <li>Pinia stores (trip, plan, profile, quota)</li>
              <li>shadcn-vue UI components installed</li>
              <li>TripDetailView container with responsive layout</li>
              <li>TypeScript compilation passing</li>
            </ul>
          </div>

          <div>
            <h3 class="mb-2 font-semibold">🚧 Next Steps:</h3>
            <ul class="list-inside list-disc space-y-1 text-sm text-muted-foreground">
              <li>TripEditor component (title, note, preferences)</li>
              <li>PlanPanel component (generate, save, display)</li>
              <li>Supabase integration and authentication</li>
            </ul>
          </div>

          <div class="border-t pt-4">
            <h3 class="mb-3 font-semibold">Test Navigation:</h3>
            <div class="flex gap-2">
              <Button variant="outline" @click="goToTrip(1)">
                View Trip #1 (will show error - no backend)
              </Button>
              <Button variant="outline" @click="router.push('/invalid')"> Test 404 Page </Button>
            </div>
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Architecture Overview</CardTitle>
        </CardHeader>
        <CardContent class="space-y-2 text-sm">
          <div class="grid grid-cols-2 gap-4">
            <div>
              <p class="font-semibold">Frontend:</p>
              <ul class="list-inside list-disc text-muted-foreground">
                <li>Vue 3.5 + TypeScript</li>
                <li>Vite 7</li>
                <li>Tailwind CSS 3</li>
                <li>shadcn-vue</li>
              </ul>
            </div>
            <div>
              <p class="font-semibold">State & Routing:</p>
              <ul class="list-inside list-disc text-muted-foreground">
                <li>Pinia stores</li>
                <li>Vue Router 4</li>
                <li>Optimistic updates</li>
                <li>Route guards</li>
              </ul>
            </div>
          </div>
        </CardContent>
      </Card>
    </div>
  </div>
</template>

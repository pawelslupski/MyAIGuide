<script setup lang="ts">
import { useRouter } from 'vue-router'
import { Info } from 'lucide-vue-next'
import { Alert, AlertTitle, AlertDescription } from '@/components/ui/alert'
import { Button } from '@/components/ui/button'

const emit = defineEmits<{
  dismiss: []
}>()

const router = useRouter()

function goToProfile() {
  router.push({ name: 'profile' })
}
</script>

<template>
  <Alert class="mb-6 flex items-start justify-between gap-4">
    <Info class="h-4 w-4 shrink-0" />
    <div class="flex-1">
      <AlertTitle>Complete your profile</AlertTitle>
      <AlertDescription>
        Set your travel preferences to get personalised trip plans.
      </AlertDescription>
      <div class="mt-3 flex gap-2">
        <Button size="sm" @click="goToProfile">Complete Profile</Button>
        <Button variant="ghost" size="sm" @click="emit('dismiss')">Dismiss</Button>
      </div>
    </div>
  </Alert>
</template>

<script setup lang="ts">
import { ref, onMounted } from 'vue'
import { useRouter } from 'vue-router'
import { Plus, AlertCircle } from 'lucide-vue-next'
import AppLayout from '@/layouts/AppLayout.vue'
import { Button } from '@/components/ui/button'
import { Alert, AlertTitle, AlertDescription } from '@/components/ui/alert'
import { Skeleton } from '@/components/ui/skeleton'
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter
} from '@/components/ui/dialog'
import { useToast } from '@/components/ui/toast/use-toast'
import TripCard from '@/components/TripCard.vue'
import TripListPagination from '@/components/TripListPagination.vue'
import UserProfilePanel from '@/components/UserProfilePanel.vue'
import { useTripStore } from '@/stores/trip.store'
import { useProfileStore } from '@/stores/profile.store'

const router = useRouter()
const tripStore = useTripStore()
const profileStore = useProfileStore()
const { toast } = useToast()

const showDeleteDialog = ref(false)
const tripIdToDelete = ref<number | null>(null)
const isDeleting = ref(false)

function openDeleteDialog(tripId: number) {
  tripIdToDelete.value = tripId
  showDeleteDialog.value = true
}

function cancelDelete() {
  showDeleteDialog.value = false
  tripIdToDelete.value = null
}

async function confirmDelete() {
  if (tripIdToDelete.value === null) return
  isDeleting.value = true
  try {
    await tripStore.deleteTripById(tripIdToDelete.value)
    toast({ title: 'Trip deleted', description: 'The trip has been permanently removed.' })
  } catch {
    toast({
      title: 'Error',
      description: 'Failed to delete trip. Please try again.',
      variant: 'destructive'
    })
  } finally {
    isDeleting.value = false
    showDeleteDialog.value = false
    tripIdToDelete.value = null
  }
}

async function createAndNavigate() {
  try {
    const id = await tripStore.createTrip()
    router.push({ name: 'trip-detail', params: { id } })
  } catch {
    toast({ title: 'Error', description: 'Failed to create trip.', variant: 'destructive' })
  }
}

async function handlePageChange(page: number) {
  await tripStore.fetchTrips(page)
}

async function retryFetch() {
  await tripStore.fetchTrips(tripStore.tripsPagination.current_page)
}

onMounted(async () => {
  await Promise.all([profileStore.fetchProfile().catch(() => {}), tripStore.fetchTrips(1)])
})
</script>

<template>
  <AppLayout>
    <!-- User profile panel -->
    <UserProfilePanel class="mb-8" />

    <!-- Page header -->
    <div class="mb-6 flex items-center justify-between">
      <h1 class="text-2xl font-bold">My Trips</h1>
      <Button :disabled="tripStore.isCreatingTrip" @click="createAndNavigate">
        <Plus class="mr-2 h-4 w-4" />
        {{ tripStore.isCreatingTrip ? 'Creating…' : 'New Trip' }}
      </Button>
    </div>

    <!-- Loading skeleton -->
    <div
      v-if="tripStore.isLoadingTrips"
      class="grid grid-cols-1 gap-4 sm:grid-cols-2 md:gap-6 lg:grid-cols-3"
    >
      <div v-for="n in 6" :key="n" class="rounded-lg border p-4">
        <Skeleton class="mb-3 h-5 w-3/4" />
        <Skeleton class="mb-4 h-4 w-1/4" />
        <Skeleton class="h-16 w-full" />
        <Skeleton class="mt-3 h-3 w-1/3" />
      </div>
    </div>

    <!-- Error state -->
    <Alert v-else-if="tripStore.tripsError" variant="destructive">
      <AlertCircle class="h-4 w-4" />
      <AlertTitle>Failed to load trips</AlertTitle>
      <AlertDescription>{{ tripStore.tripsError.error.message }}</AlertDescription>
      <Button variant="outline" size="sm" class="mt-3" @click="retryFetch">Retry</Button>
    </Alert>

    <!-- Empty state -->
    <div
      v-else-if="tripStore.trips.length === 0"
      class="flex min-h-[300px] flex-col items-center justify-center gap-4 text-center"
    >
      <p class="text-muted-foreground">You don't have any trips yet.</p>
      <Button :disabled="tripStore.isCreatingTrip" @click="createAndNavigate">
        <Plus class="mr-2 h-4 w-4" />
        {{ tripStore.isCreatingTrip ? 'Creating…' : 'Create your first trip' }}
      </Button>
    </div>

    <!-- Trip grid + pagination -->
    <template v-else>
      <div class="grid grid-cols-1 gap-4 sm:grid-cols-2 md:gap-6 lg:grid-cols-3">
        <TripCard
          v-for="trip in tripStore.trips"
          :key="trip.id"
          :trip="trip"
          @delete="openDeleteDialog"
        />
      </div>
      <TripListPagination
        v-if="tripStore.tripsPagination.total_pages > 1"
        :pagination="tripStore.tripsPagination"
        :is-loading="tripStore.isLoadingTrips"
        @page-change="handlePageChange"
      />
    </template>

    <!-- Delete confirmation dialog -->
    <Dialog
      :open="showDeleteDialog"
      @update:open="
        (v) => {
          if (!v) cancelDelete()
        }
      "
    >
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Delete trip?</DialogTitle>
          <DialogDescription>
            This action cannot be undone. The trip and all its data will be permanently removed.
          </DialogDescription>
        </DialogHeader>
        <DialogFooter>
          <Button variant="outline" :disabled="isDeleting" @click="cancelDelete">Cancel</Button>
          <Button variant="destructive" :disabled="isDeleting" @click="confirmDelete">
            {{ isDeleting ? 'Deleting…' : 'Delete' }}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  </AppLayout>
</template>

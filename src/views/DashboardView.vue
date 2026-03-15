<script setup lang="ts">
import { ref, onMounted } from 'vue'
import { useRouter } from 'vue-router'
import { useI18n } from 'vue-i18n'
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
const { t } = useI18n()

const currentPage = ref<number>(1)
const showDeleteDialog = ref(false)
const deletingTripId = ref<number | null>(null)
const isDeleting = ref(false)

function openDeleteDialog(tripId: number) {
  deletingTripId.value = tripId
  showDeleteDialog.value = true
}

function cancelDelete() {
  showDeleteDialog.value = false
  deletingTripId.value = null
}

async function confirmDelete() {
  if (deletingTripId.value === null) return
  isDeleting.value = true
  try {
    await tripStore.deleteTripById(deletingTripId.value)
    toast({
      title: t('dashboard.toast.deleted'),
      description: t('dashboard.toast.deletedDesc'),
      duration: 3000
    })
  } catch {
    toast({
      title: t('dashboard.toast.deleteFailed'),
      description: t('dashboard.toast.deleteFailedDesc'),
      variant: 'destructive',
      duration: 5000
    })
  } finally {
    isDeleting.value = false
    showDeleteDialog.value = false
    deletingTripId.value = null
  }
}

async function createAndNavigate() {
  try {
    const trip = await tripStore.createTrip({ title: 'New Trip' })
    router.push({ name: 'trip-detail', params: { id: trip.id } })
  } catch {
    toast({
      title: t('dashboard.toast.deleteFailed'),
      description: t('dashboard.toast.createFailedDesc'),
      variant: 'destructive',
      duration: 5000
    })
  }
}

async function handlePageChange(page: number) {
  currentPage.value = page
  await tripStore.fetchTrips(page)
}

async function retryFetch() {
  await tripStore.fetchTrips(currentPage.value)
}

onMounted(async () => {
  await Promise.all([
    profileStore.fetchProfile().catch(() => {
      toast({
        title: t('dashboard.profileUnavailable'),
        description: t('dashboard.profileUnavailableDesc'),
        variant: 'destructive',
        duration: 5000
      })
    }),
    tripStore.fetchTrips(1)
  ])
})
</script>

<template>
  <AppLayout>
    <!-- User profile panel -->
    <UserProfilePanel class="mb-8" />

    <!-- Page header -->
    <div class="mb-6 flex items-center justify-between">
      <h2 class="text-2xl font-bold">{{ t('dashboard.title') }}</h2>
      <Button
        v-if="tripStore.trips.length > 0"
        data-testid="new-trip-btn"
        :disabled="tripStore.isCreatingTrip"
        @click="createAndNavigate"
      >
        <Plus class="mr-2 h-4 w-4" />
        {{ tripStore.isCreatingTrip ? t('dashboard.creatingTrip') : t('dashboard.newTrip') }}
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
      <AlertTitle>{{ t('dashboard.loadFailed') }}</AlertTitle>
      <AlertDescription>{{ t('dashboard.loadFailedDesc') }}</AlertDescription>
      <Button variant="outline" size="sm" class="mt-3" @click="retryFetch">
        {{ t('dashboard.tryAgain') }}
      </Button>
    </Alert>

    <!-- Empty state -->
    <div
      v-else-if="tripStore.trips.length === 0"
      class="flex flex-col items-center gap-4 pt-6 text-center"
    >
      <p class="text-muted-foreground">{{ t('dashboard.noTrips') }}</p>
      <Button
        data-testid="create-first-trip-btn"
        :disabled="tripStore.isCreatingTrip"
        @click="createAndNavigate"
      >
        <Plus class="mr-2 h-4 w-4" />
        {{
          tripStore.isCreatingTrip ? t('dashboard.creatingTrip') : t('dashboard.createFirstTrip')
        }}
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
          <DialogTitle>{{ t('dashboard.deleteDialog.title') }}</DialogTitle>
          <DialogDescription>{{ t('dashboard.deleteDialog.description') }}</DialogDescription>
        </DialogHeader>
        <DialogFooter>
          <Button
            data-testid="delete-dialog-cancel"
            variant="outline"
            :disabled="isDeleting"
            @click="cancelDelete"
          >
            {{ t('dashboard.deleteDialog.cancel') }}
          </Button>
          <Button
            data-testid="delete-dialog-confirm"
            variant="destructive"
            :disabled="isDeleting"
            @click="confirmDelete"
          >
            {{
              isDeleting
                ? t('dashboard.deleteDialog.deleting')
                : t('dashboard.deleteDialog.confirm')
            }}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  </AppLayout>
</template>

import { test as teardown } from './fixtures'

teardown('delete all test trips', async ({ tripApi }) => {
  await tripApi.deleteAllTrips()
})

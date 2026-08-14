import { NativeConnection, Worker } from '@temporalio/worker'
import * as activities from './workflows/activities'
import { PHONE_PROVIDERS } from './workflows/phone/providers'

export const MAIN_TASK_QUEUE = 'myQueue'

export async function runTemporalWorker() {
  const connection = await NativeConnection.connect({
    address: 'localhost:7233',
  })
  try {
    const worker = await Worker.create({
      connection,
      namespace: 'default',
      taskQueue: MAIN_TASK_QUEUE,
      workflowsPath: require.resolve('./workflows'),
      activities,
    })

    /**
     * One activity-only worker per provider, each on the provider's own task queue.
     *
     * That queue is the rate-limit boundary: `maxTaskQueueActivitiesPerSecond` is enforced by the
     * server across every worker polling it, so when a provider publishes a limit it becomes a
     * single number in the registry rather than a semaphore we have to keep correct ourselves.
     * Isolating the queues also means a slow provider can't starve the others of activity slots.
     */
    const providerWorkers = await Promise.all(
      PHONE_PROVIDERS.map((provider) =>
        Worker.create({
          connection,
          namespace: 'default',
          taskQueue: provider.taskQueue,
          activities,
          maxTaskQueueActivitiesPerSecond: provider.maxActivitiesPerSecond,
        })
      )
    )

    await Promise.all([worker.run(), ...providerWorkers.map((providerWorker) => providerWorker.run())])
  } finally {
    await connection.close()
  }
}

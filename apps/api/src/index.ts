import { settings } from './config'
import { buildServer } from './server'

async function run(): Promise<void> {
  const app = await buildServer()
  const stop = () => {
    const deadline = setTimeout(() => process.exit(1), 12000)
    deadline.unref()
    void app.close().catch((error: unknown) => {
      app.log.error(error)
      process.exitCode = 1
    }).finally(() => clearTimeout(deadline))
  }
  process.once('SIGTERM', stop)
  process.once('SIGINT', stop)
  try {
    await app.listen({ host: '0.0.0.0', port: settings.port })
  } catch (error) {
    await app.close()
    throw error
  }
}

void run().catch((error: unknown) => {
  console.error(error)
  process.exitCode = 1
})

import { settings } from './config'
import { createServer } from './server'

createServer().then((app) => app.listen({ host: '0.0.0.0', port: settings.port })).catch((error) => {
  console.error(error)
  process.exitCode = 1
})

import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import { fileURLToPath } from 'node:url'
import path from 'node:path'
import fs from 'node:fs'

const __dirname = fileURLToPath(new URL('.', import.meta.url))

// Vite plugin that reads all game JSON files from server/data/ at build time
// and exposes them as a virtual module. This avoids import.meta.glob restrictions
// that prevent patterns from traversing outside the Vite project root (client/).
function gameDataPlugin() {
  const virtualId = 'virtual:game-data'
  const resolvedId = '\0' + virtualId
  return {
    name: 'game-data',
    resolveId(id: string) {
      if (id === virtualId) return resolvedId
    },
    load(id: string) {
      if (id === resolvedId) {
        const dir = path.resolve(__dirname, '../server/data')
        const games = fs.readdirSync(dir)
          .filter(f => f.endsWith('.json'))
          .map(f => JSON.parse(fs.readFileSync(path.join(dir, f), 'utf-8')))
        return `export default ${JSON.stringify(games)}`
      }
    },
  }
}

// https://vite.dev/config/
export default defineConfig(() => {
  const isViewer = process.env.VITE_VIEWER === 'true'
  return {
    plugins: [react(), ...(isViewer ? [gameDataPlugin()] : [])],
    define: {
      'import.meta.env.VITE_VIEWER': JSON.stringify(isViewer),
    },
    resolve: {
      alias: isViewer ? [
        {
          find: /^.*\/api$/,
          replacement: path.resolve(__dirname, 'src/api.viewer.ts'),
        },
      ] : [],
    },
    server: isViewer ? undefined : {
      proxy: { '/api': 'http://localhost:3001' },
    },
  }
})

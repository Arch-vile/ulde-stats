/// <reference types="vite/client" />

interface ImportMetaEnv {
  readonly VITE_VIEWER: boolean
}

interface ImportMeta {
  readonly env: ImportMetaEnv
}

declare module 'virtual:game-data' {
  const games: unknown[]
  export default games
}

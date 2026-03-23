/// <reference types="vite/client" />

interface ImportMetaEnv {
  readonly VITE_VIEWER: boolean
}

interface ImportMeta {
  readonly env: ImportMetaEnv
}

declare const __GIT_HASH__: string

declare module 'virtual:game-data' {
  const games: unknown[]
  export default games
}

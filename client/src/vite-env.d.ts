/// <reference types="vite/client" />

interface ImportMetaEnv {
  /** PocketBase base URL. Unset/empty = solo mode (static tier). */
  readonly VITE_POCKETBASE_URL?: string
  /** Cloudflare Worker URL used by the static tier to fetch ?id= programs. */
  readonly VITE_WORKER_URL?: string
}

interface ImportMeta {
  readonly env: ImportMetaEnv
}

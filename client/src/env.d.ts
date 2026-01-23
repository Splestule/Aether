/// <reference types="vite/client" />

interface ImportMetaEnv {
  readonly VITE_NODE_ENV: string;
  readonly VITE_LOCAL_IP: string;
}

interface ImportMeta {
  readonly env: ImportMetaEnv;
}

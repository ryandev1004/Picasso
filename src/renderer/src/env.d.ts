import type { PicassoAPI } from "@shared/ipc";

// `window.picasso` is injected by src/preload/index.ts.
declare global {
  interface Window {
    picasso: PicassoAPI;
  }
}

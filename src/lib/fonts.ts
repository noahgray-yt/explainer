import { useSyncExternalStore } from "react";

/* Fonts load asynchronously – text boxes measure again once they are ready. */

let ready = typeof document === "undefined" ? true : document.fonts.status === "loaded";
const listeners = new Set<() => void>();

if (typeof document !== "undefined") {
  const done = () => {
    ready = true;
    listeners.forEach((l) => l());
  };
  // Request Kalam explicitly so document.fonts.ready does not resolve too early
  Promise.all(["400", "700"].map((w) => document.fonts.load(`${w} 40px Kalam`)))
    .catch(() => undefined)
    .then(() => document.fonts.ready)
    .then(done);
}

export function useFontsReady(): boolean {
  return useSyncExternalStore(
    (cb) => {
      listeners.add(cb);
      return () => listeners.delete(cb);
    },
    () => ready,
  );
}

export const fontsLoaded = () => (ready ? Promise.resolve() : document.fonts.ready.then(() => undefined));

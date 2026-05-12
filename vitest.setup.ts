import "@testing-library/jest-dom/vitest";

/** Recharts `ResponsiveContainer` expects `ResizeObserver` (browser API). */
globalThis.ResizeObserver =
  globalThis.ResizeObserver ??
  class ResizeObserverPolyfill {
    observe(): void {}
    unobserve(): void {}
    disconnect(): void {}
  };

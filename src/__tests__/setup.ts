// Vitest setup file for test environment configuration
import { vi } from 'vitest';

// Polyfill crypto for Node.js environment (JSDOM doesn't have it by default)
if (typeof crypto === 'undefined') {
  globalThis.crypto = {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    randomUUID: (): any => {
      return 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, (c: string) => {
        const r = Math.random() * 16 | 0;
        const v = c === 'x' ? r : (r & 0x3 | 0x8);
        return v.toString(16);
      });
    },
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    getRandomValues: (array: any): any => {
      for (let i = 0; i < array.length; i++) {
        array[i] = Math.floor(Math.random() * 256);
      }
      return array;
    },
    // Add other required Crypto properties
    subtle: {} as any,
  } as Crypto;
}

// Mock ResizeObserver for components that use it
globalThis.ResizeObserver = vi.fn().mockImplementation(() => ({
  observe: vi.fn(),
  unobserve: vi.fn(),
  disconnect: vi.fn(),
}));

// Mock window.matchMedia
Object.defineProperty(window, 'matchMedia', {
  writable: true,
  value: vi.fn().mockImplementation((query: string) => ({
    matches: false,
    media: query,
    onchange: null,
    addListener: vi.fn(),
    removeListener: vi.fn(),
    addEventListener: vi.fn(),
    removeEventListener: vi.fn(),
    dispatchEvent: vi.fn(),
  })),
});

// Mock scrollTo
window.scrollTo = vi.fn((_options?: ScrollToOptions | number, _y?: number) => {
  // Mock implementation
});
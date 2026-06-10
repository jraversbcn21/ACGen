import '@testing-library/jest-dom';

let uuidCounter = 0;
Object.defineProperty(globalThis, 'crypto', {
  value: {
    randomUUID: () => `test-uuid-${++uuidCounter}`,
  },
});

beforeEach(() => {
  uuidCounter = 0;
  localStorage.clear();
});

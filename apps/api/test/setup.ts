// Jest setup file
import { jest } from '@jest/globals';

// Reset all mocks between tests
beforeEach(() => {
  jest.clearAllMocks();
});

// Global test timeout
jest.setTimeout(10000);

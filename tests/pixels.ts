import { expect } from '@playwright/test'

export function expectSamePixels(actual: number[], expected: number[]) {
  expect(actual.length).toBe(expected.length)
  const differences = actual.map((value, index) => Math.abs(value - expected[index]))
  expect(differences.reduce((total, value) => total + value, 0) / differences.length, 'Mean channel difference').toBeLessThan(.05)
  expect(Math.max(...differences), 'Largest edge-channel difference').toBeLessThanOrEqual(24)
  expect(differences.filter(value => value > 8).length / differences.length, 'Fraction of channels differing by more than eight').toBeLessThan(.001)
}
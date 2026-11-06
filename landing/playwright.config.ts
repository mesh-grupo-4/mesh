import { defineConfig, devices } from '@playwright/test'

export default defineConfig({
  testDir: 'tests',
  testMatch: '*.spec.ts',
  fullyParallel: true,
  reporter: 'list',
  use: { baseURL: 'http://localhost:4331' },
  webServer: {
    command: 'npx astro preview --port 4331',
    url: 'http://localhost:4331',
    reuseExistingServer: true,
  },
  projects: [
    { name: 'escritorio', use: { ...devices['Desktop Chrome'], viewport: { width: 1440, height: 900 } } },
    { name: 'movil', use: { ...devices['Pixel 7'], viewport: { width: 390, height: 844 } } },
  ],
})

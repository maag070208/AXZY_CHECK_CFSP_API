module.exports = {
  preset: 'ts-jest',
  testEnvironment: 'node',
  moduleNameMapper: {
    '^@src/(.*)$': '<rootDir>/src/$1',
  },
  testMatch: ['**/*.test.ts'],
  setupFiles: ['<rootDir>/test/setup-env.ts'],
  // Cierra el pool de Prisma tras cada archivo (evita acumulación → 'too many clients').
  setupFilesAfterEnv: ['<rootDir>/test/setup-after-env.ts'],
  globalSetup: '<rootDir>/test/global-setup.ts',
  verbose: true,
  forceExit: true,
  clearMocks: true,
  // Serial: un solo worker → un solo pool de Prisma (evita 'too many clients') y orden determinista.
  maxWorkers: 1,
  restoreMocks: true,
};

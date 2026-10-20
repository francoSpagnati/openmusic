export declare const repoRoot: string;
export declare function loadRootEnv(): void;
export declare function testDatabaseUrl(): string;
export declare function testRedisUrl(): string;
export declare function testEnv(): {
  NODE_ENV: 'test';
  DATABASE_URL: string;
  REDIS_URL: string;
  JWT_SECRET: string;
  CORS_ORIGIN: string;
};

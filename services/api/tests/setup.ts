// Vitest setup — 在所有 test module evaluate 前先設好 env，
// 確保 src/env.ts 的 zod parse 通過、src/index.ts 的 if(NODE_ENV!=='test') 跳過 serve()。

process.env.NODE_ENV = 'test'
process.env.PORT = process.env.PORT ?? '8787'
process.env.DATABASE_URL =
  process.env.DATABASE_URL ?? 'postgres://postgres:postgres@localhost:54322/postgres'
process.env.SUPABASE_URL = process.env.SUPABASE_URL ?? 'http://localhost:54321'
process.env.SUPABASE_ANON_KEY = process.env.SUPABASE_ANON_KEY ?? 'test-anon-key'
process.env.SUPABASE_JWT_SECRET =
  process.env.SUPABASE_JWT_SECRET ?? 'test-supabase-jwt-secret-for-vitest-only'

// 把 secret 露給 test 檔案用（同一個值，避免 sign / verify 不一致）
export const TEST_JWT_SECRET = process.env.SUPABASE_JWT_SECRET as string

# W2-T04 — Drizzle Postgres Repo + Supabase Migration

## Meta
- **task_id**: W2-T04_drizzle_repo
- **phase**: W2 後端骨架（封閉週）
- **executor**: Codex Local（檔案 6–8、需跑本機 vitest）
- **預估工時**: 0.5–1 天
- **依賴**: W2-T01/T02/T03 vitest 14/14 全綠（已過 ✅）

## Goal
把 `sessions` 從 in-memory `Map` 換成持久化 Postgres：
1. 寫 Supabase migration SQL（`lerna_sessions` 表 + RLS）
2. 在 `src/db/schema.ts` 加 sessions 的 Drizzle mapping
3. 寫 `DrizzleSessionsRepo`（同樣 implements `SessionsRepo` interface）
4. 加 repo factory，依 env `SESSIONS_REPO=in-memory|drizzle` 切換
5. **routes 不動**：只改它 import 的對象（從 `inMemorySessionsRepo` → `sessionsRepo` factory）
6. 加 unit test：用 vitest mock postgres client 驗 DrizzleSessionsRepo 的 SQL 行為
7. **預設 env 仍是 `in-memory`**，現有 7 個 sessions test 必須繼續通過（總計 14 + 新增 ≥ 4 = ≥ 18）

**不做**的事：
- 不跑真實 Postgres connection（需要 Supabase / docker，不在 brief 範圍）
- 不寫 integration test（W2-T05 才做，那時定 dev env）
- 不改現有 `tests/sessions.test.ts`（它驗 in-memory，仍要綠）

## Context Files

**要新增**：
- `supabase/migrations/20260502000000_add_lerna_sessions.sql`（datetime 用今天 UTC，可以由 Codex 產 e.g. `20260502120000`）
- `services/api/src/repositories/drizzle-sessions-repo.ts`
- `services/api/src/repositories/index.ts`（factory：依 env 回 in-memory 或 drizzle）
- `services/api/tests/drizzle-sessions-repo.test.ts`

**要修改**：
- `services/api/src/db/schema.ts`（加 sessions table mapping，**保留現有 users 表**）
- `services/api/src/env.ts`（加 `SESSIONS_REPO` env，default `'in-memory'`）
- `services/api/.env.example`（加 `SESSIONS_REPO=in-memory`）
- `services/api/src/routes/sessions.ts`（**只改 1 行**：把 `import { inMemorySessionsRepo } from '../repositories/in-memory-sessions-repo'` 改成 `import { sessionsRepo } from '../repositories'`，全檔內 `inMemorySessionsRepo` → `sessionsRepo`）

**禁止觸碰**：
- `src/middleware/**`、`src/routes/healthz.ts`、`src/routes/me.ts`
- `src/types/session.ts`（schema 已穩，不該動）
- `src/repositories/sessions-repo.ts`（interface 已穩）
- `src/repositories/in-memory-sessions-repo.ts`（**保留**，繼續被 factory 使用）
- `src/index.ts`（不動）
- `tests/me.test.ts`、`tests/rate-limit.test.ts`、`tests/sessions.test.ts`、`tests/setup.ts`
- `vitest.config.ts`、`tsconfig.json`、`package.json`（**本任務不加新依賴**，drizzle-orm / postgres / drizzle-kit 已在）
- 任何 W1 範圍檔案、Lerna.html、netlify.toml、vercel.json
- root `.env.example`、root `package.json`

## Migration SQL（Supabase 慣例）

`supabase/migrations/<ts>_add_lerna_sessions.sql`：

```sql
-- W2-T04: lerna_sessions table for tracking study sessions

create table if not exists public.lerna_sessions (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  started_at timestamptz not null default now(),
  ended_at timestamptz,
  duration_sec integer not null default 0 check (duration_sec >= 0),
  subject text check (subject is null or char_length(subject) <= 120),
  tags text[] not null default '{}',
  notes text check (notes is null or char_length(notes) <= 2000),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists idx_lerna_sessions_user_id on public.lerna_sessions(user_id);
create index if not exists idx_lerna_sessions_started_at on public.lerna_sessions(started_at desc);

alter table public.lerna_sessions enable row level security;

create policy "users see own sessions"
  on public.lerna_sessions for select
  using (auth.uid() = user_id);

create policy "users insert own sessions"
  on public.lerna_sessions for insert
  with check (auth.uid() = user_id);

create policy "users update own sessions"
  on public.lerna_sessions for update
  using (auth.uid() = user_id);

create policy "users delete own sessions"
  on public.lerna_sessions for delete
  using (auth.uid() = user_id);

create trigger lerna_sessions_set_updated_at
  before update on public.lerna_sessions
  for each row execute function public.set_updated_at();
```

注意：`set_updated_at()` 是 Supabase 常用 trigger function 慣例。如果 `supabase/schema.sql` 沒這個 function，**Codex 在同一份 migration 開頭加上**：

```sql
create or replace function public.set_updated_at()
returns trigger language plpgsql as $$
begin
  new.updated_at = now();
  return new;
end;
$$;
```

## Drizzle Schema Mapping（`src/db/schema.ts`）

在現有 `users` 表後**追加**：

```ts
import {
  pgTable,
  text,
  timestamp,
  uuid,
  integer,
  index
} from 'drizzle-orm/pg-core'

// 既有 users 表保留不動 ⬇

// 新增：
export const lernaSessions = pgTable(
  'lerna_sessions',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    userId: uuid('user_id').notNull(),
    startedAt: timestamp('started_at', { withTimezone: true }).notNull().defaultNow(),
    endedAt: timestamp('ended_at', { withTimezone: true }),
    durationSec: integer('duration_sec').notNull().default(0),
    subject: text('subject'),
    tags: text('tags').array().notNull().default([]),
    notes: text('notes'),
    createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
    updatedAt: timestamp('updated_at', { withTimezone: true }).notNull().defaultNow()
  },
  (table) => ({
    userIdIdx: index('idx_lerna_sessions_user_id').on(table.userId),
    startedAtIdx: index('idx_lerna_sessions_started_at').on(table.startedAt)
  })
)

export type LernaSessionRow = typeof lernaSessions.$inferSelect
export type NewLernaSessionRow = typeof lernaSessions.$inferInsert
```

## DrizzleSessionsRepo 行為

- constructor 接 `db: DbClient`（現有 `db/client.ts` 已 export）
- `list(userId)` → `select().from(lernaSessions).where(eq(userId)).orderBy(desc(startedAt))`，**回傳要轉成 Session 型別**（timestamp 轉 ISO string）
- `create(userId, input)` → insert + returning，轉 Session 回傳
- `update(userId, id, input)` → `update().set(input).where(and(eq(id), eq(userId))).returning()`，回傳第一筆或 null
- `delete(userId, id)` → `delete().where(and(eq(id), eq(userId))).returning({ id })`，回傳 `result.length > 0`
- 單純的 row → Session 轉換 helper：`rowToSession(row: LernaSessionRow): Session`，把 Date 轉 `.toISOString()`

## Repo Factory（`src/repositories/index.ts`）

```ts
import { env } from '../env'
import { inMemorySessionsRepo } from './in-memory-sessions-repo'
import type { SessionsRepo } from './sessions-repo'

let cached: SessionsRepo | undefined

export function getSessionsRepo(): SessionsRepo {
  if (cached) return cached

  if (env.SESSIONS_REPO === 'drizzle') {
    // lazy import 避免 in-memory 模式還要載 db client
    const { db } = require('../db/client')
    const { DrizzleSessionsRepo } = require('./drizzle-sessions-repo')
    cached = new DrizzleSessionsRepo(db)
  } else {
    cached = inMemorySessionsRepo
  }

  return cached
}

export const sessionsRepo = new Proxy({} as SessionsRepo, {
  get(_, prop) {
    return Reflect.get(getSessionsRepo(), prop)
  }
})

// 為了讓現有 sessions.test.ts 用的 resetSessionsRepo 仍工作：
export { resetSessionsRepo } from './in-memory-sessions-repo'
```

> Proxy 是為了讓 routes/sessions.ts 用 `import { sessionsRepo } from '../repositories'` 直接呼叫（`sessionsRepo.list(...)`），同時延遲到第一次 call 才決定哪個 impl。如果 Proxy 太巧，改寫成 `getSessionsRepo()` 函式 + 在 routes 每次 call 也可以——優先正確、不死磕 Proxy。

## env 變更

`src/env.ts` 在 envSchema 加：
```ts
SESSIONS_REPO: z.enum(['in-memory', 'drizzle']).default('in-memory'),
```

`.env.example` 加：
```
# Sessions repository — 'in-memory' for tests/dev, 'drizzle' for real Postgres
SESSIONS_REPO=in-memory
```

## 測試（`tests/drizzle-sessions-repo.test.ts`）

**用 vitest 的 mock**，不開真 Postgres。重點驗 SQL 形狀正確：

```ts
import { describe, expect, it, vi, beforeEach } from 'vitest'

// mock postgres before any imports
vi.mock('../src/db/client', () => {
  const fakeReturning = vi.fn().mockResolvedValue([
    {
      id: '00000000-0000-4000-8000-000000000001',
      user_id: '00000000-0000-4000-8000-000000000010',
      started_at: new Date('2026-01-01T00:00:00.000Z'),
      ended_at: null,
      duration_sec: 0,
      subject: 'Math',
      tags: ['algebra'],
      notes: null,
      created_at: new Date('2026-01-01T00:00:00.000Z'),
      updated_at: new Date('2026-01-01T00:00:00.000Z')
    }
  ])
  // 用一個 chain-able fake，每個 method 回 self，最後 returning() 真的 resolve
  // ... fixture
  return { db: /* fake */ }
})

import { DrizzleSessionsRepo } from '../src/repositories/drizzle-sessions-repo'

describe('DrizzleSessionsRepo', () => {
  // ≥ 4 case：list / create / update / delete 各 1 個，外加 ownership filter 1 個
})
```

至少 4 個 case：
1. `list(userId)` 呼叫 db.select 並 where user_id；回傳轉成 ISO string
2. `create(userId, input)` insert 並回 Session
3. `update(userId, id, input)` 用 and(eq id, eq userId) 過濾；回 null when not found
4. `delete(userId, id)` 一樣 and 過濾，回 false when not found

**接受**用 chain mock 或拿 `vi.spyOn(db, 'select')` 檢查呼叫參數，看 Codex 偏好。重點是驗：**SQL 的 where clause 一定有 user_id filter**（防 IDOR）。

## Constraints
- TypeScript strict
- 不引入新 dep
- 不動現有 in-memory repo 的測試
- migration SQL 不在 brief 範圍執行（使用者 W2-T05 跑 `supabase db push` 或手動 apply）
- routes/sessions.ts 變更最小：只改 import + 用 sessionsRepo
- 預設 env 是 in-memory，CI 與本地測試都不需要 Postgres
- migration 檔名 timestamp 用 `20260502120000` 之後的數字（避免與既有 migration 撞號；Codex 自己挑一個合理的）

## Acceptance

```powershell
npm run -w services/api typecheck    # 全綠
npm test --workspace services/api    # ≥ 18 case 全綠（先前 14 + 新增 ≥ 4）
```

具體：
1. `tests/me.test.ts` 4/4 過
2. `tests/rate-limit.test.ts` 3/3 過
3. `tests/sessions.test.ts` 7/7 過（**沒被新邏輯破壞**——in-memory repo 仍 default）
4. `tests/drizzle-sessions-repo.test.ts` 至少 4 case 過

也檢：
- `git diff src/routes/sessions.ts` 只有 import 一行 + symbol rename，**沒其他邏輯改動**
- `git diff src/db/schema.ts` 只有新增 lernaSessions table + import 補充，**users 表保留**
- `git status` 沒有 Lerna.html / netlify.toml / vercel.json / lernav*.html

## Risk
- Drizzle 對 `text[]` 在 type generation 可能要 `text('tags').array()` 還是 `text('tags', { mode: 'array' })` — Codex 跟 drizzle-orm 0.36 文件決定；如果 typecheck 紅，貼錯誤回我 review
- migration SQL 假設 `auth.users` 表存在（Supabase 預設）；如果使用者本機 Postgres 沒這 schema，本任務先不管（W2-T05 處理）
- Proxy factory 在某些 module 系統下行為奇怪；如果 routes 找不到 method，改成「routes 每次 call 一次 `getSessionsRepo()`」即可
- vitest mock drizzle 的 chain mock 不易寫對，預期 Codex 第一次跑可能要 1–2 次調整

## ChatGPT Router Prompt

```
你是 Codex Local 的 prompt 工程師。任務：把 services/api 的 sessions repo 從 in-memory 換成「可選擇 in-memory 或 Drizzle Postgres」，加 Supabase migration 與 mock-based unit test。請把下面 brief 翻譯成可貼進 Codex CLI 的 prompt：

要求：
1. 開頭明列「要新增的檔案」「要修改的檔案」「禁止觸碰的檔案」三段，逐一檔名
2. migration SQL 檔給完整內容
3. db/schema.ts 給完整 diff（保留現有 users 表）
4. drizzle-sessions-repo.ts 給完整 TypeScript（含 rowToSession helper）
5. repositories/index.ts 給完整 factory 內容
6. routes/sessions.ts 給完整新版（**強調只改 import + 變數名，其他全保留**）
7. drizzle-sessions-repo.test.ts 給完整內容含 ≥ 4 case 與 mock fixture
8. env.ts 給 diff
9. 結尾驗收指令清單
10. 強調 do-not-touch 清單（13 個檔案路徑）
11. 強調「不要新增 npm 依賴；drizzle-orm / postgres / drizzle-kit 都已存在」
12. 強調「default SESSIONS_REPO=in-memory；現有 14 個測試必須續綠」
13. 繁體中文 prose、code 與技術名詞用英文

Brief：
[把 W2-T04 整份 brief 貼進來]
```

## 完成回報模板
```
## W2-T04 完成回報
- [ ] typecheck 綠：[貼最後 5 行]
- [ ] vitest ≥ 18 case 全綠：[貼摘要]
- [ ] 新增/修改檔案清單：[列]
- [ ] git diff src/routes/sessions.ts 確認只改 import：[貼前 20 行]
- [ ] git status 沒越界：[貼 short 結果]
- 偏離 brief 的決策：[列]
- 下一個 brief 建議（W2-T05 候選：把 in-memory 真的拔掉、跑 supabase 本地 + integration test）：[寫]
```

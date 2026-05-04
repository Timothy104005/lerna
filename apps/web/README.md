# @lerna/web

Lerna 前端 PoC（W4-T01）。Vite + React 19 + TypeScript。

## Dev

兩個 terminal：

terminal 1（API）：

```bash
npm run -w services/api dev
```

terminal 2（web）：

```bash
cp apps/web/.env.example apps/web/.env  # 第一次
npm run -w @lerna/web dev
```

開 http://localhost:5173，貼 Supabase JWT access_token 進 dev token input，按 Save，看到 /me 回傳的 id + email。

## Build

```bash
npm run -w @lerna/web build
```

產出 apps/web/dist/。

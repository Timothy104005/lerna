# AI Briefs — Lerna 上線專案

這個資料夾是 **L1 Brain（Claude）→ L2 Router（ChatGPT）→ L3 Executor（Codex）** 工作流的 brief 池。

## 命名規則
`W<週>-T<序號>_<slug>.md`，例如 `W1-T01_monorepo_scaffold.md`。

## 每份 Brief 的結構
1. **Meta**：task_id / phase / 推薦執行器 / 預估工時 / 依賴
2. **Goal**：一句話
3. **Context Files**：要動的檔案 + 不能動的檔案
4. **Constraints**：硬性規則
5. **Acceptance**：跑得起來 / 測試 / 驗收條件
6. **Risk**：可能踩到的雷
7. **ChatGPT Router Prompt**：可直接貼進 ChatGPT 對話框的整段
8. **後續驗收回貼模板**：Codex 跑完後請使用者把 diff 貼回 Claude 用

## 流程
```
1. 你打開一份 brief
2. 把「ChatGPT Router Prompt」整段貼進 ChatGPT
3. ChatGPT 給你 Codex prompt → 你貼進 Codex Local / Cloud
4. Codex 跑完 → 你把 diff（git diff 結果）貼回 Claude
5. Claude review → 通過就 commit；退回就調整重跑
```

## 已釋出（順序執行）
- [x] W1-T01 monorepo scaffold
- [x] W1-T01b hotfix
- [x] W1-T02 CI pipeline (GitHub Actions)
- [x] W2-T01 API skeleton + /me endpoint
- [x] W2-T02 rate limit + CORS
- [x] W2-T03 sessions CRUD（in-memory）
- [x] W2-T04 Drizzle Postgres repo + Supabase migration
- [ ] W3-T01 OpenAPI spec + Swagger UI（待 Codex 接手）

未驗證：以下排程根據 `Lerna_執行手冊_v1.0.pdf` 抽樣推估，工時可能偏差。完成 W1 後重新校準。

# W1 cleanup — 跑這支腳本完成 Claude 沙箱無法刪除的部分
# 用法（PowerShell，cd 到 C:\Code\Lerna）：
#   pwsh -NoProfile -ExecutionPolicy Bypass -File scripts/w1_cleanup.ps1

$ErrorActionPreference = "Stop"
Set-StrictMode -Version Latest

Write-Host "==> 1/4 刪除 stray dirs" -ForegroundColor Cyan
foreach ($p in @(".tmp_w1_test", "scripts_w1")) {
    if (Test-Path $p) {
        Write-Host "    removing $p"
        Remove-Item -Recurse -Force $p
    } else {
        Write-Host "    $p already gone"
    }
}

Write-Host "==> 2/4 清 .git lock 檔" -ForegroundColor Cyan
Get-ChildItem ".git" -Filter "*.lock" -ErrorAction SilentlyContinue | ForEach-Object {
    Write-Host "    removing $($_.FullName)"
    Remove-Item $_.FullName -Force
}

Write-Host "==> 3/4 修 git index" -ForegroundColor Cyan
$indexOk = $false
try {
    git status > $null 2>&1
    $indexOk = ($LASTEXITCODE -eq 0)
} catch {}

if (-not $indexOk) {
    Write-Host "    git index 損毀，從 HEAD 重建"
    if (Test-Path ".git/index") {
        Copy-Item ".git/index" ".git/index.bak.$(Get-Date -Format yyyyMMddHHmmss)"
        Remove-Item ".git/index" -Force
    }
    git read-tree HEAD
    Write-Host "    重建完成"
} else {
    Write-Host "    git status 正常，跳過"
}

Write-Host "==> 4/4 驗證" -ForegroundColor Cyan
$checks = @(
    @{ Name = "package.json JSON valid"; Cmd = { node -e "JSON.parse(require('fs').readFileSync('package.json','utf8')); console.log('OK')" } },
    @{ Name = "git status 可跑"; Cmd = { git status --short | Out-Null; "OK" } },
    @{ Name = ".tmp_w1_test 不存在"; Cmd = { if (Test-Path ".tmp_w1_test") { throw "still here" }; "OK" } },
    @{ Name = "scripts_w1 不存在"; Cmd = { if (Test-Path "scripts_w1") { throw "still here" }; "OK" } }
)
$pass = 0
foreach ($c in $checks) {
    try {
        $c.Cmd.Invoke() | Out-Null
        Write-Host ("    [PASS] {0}" -f $c.Name) -ForegroundColor Green
        $pass++
    } catch {
        Write-Host ("    [FAIL] {0} -> {1}" -f $c.Name, $_) -ForegroundColor Red
    }
}

Write-Host ""
Write-Host ("Cleanup 完成 — {0}/{1} checks passed" -f $pass, $checks.Count) -ForegroundColor $(if ($pass -eq $checks.Count) { "Green" } else { "Yellow" })

Write-Host ""
Write-Host "下一步（手動）：" -ForegroundColor Cyan
Write-Host "  1. npm install                          # 重灌 lockfile，會把 hono/drizzle/vitest 拉進來"
Write-Host "  2. npx turbo run typecheck              # 應全綠（stub 都 echo）"
Write-Host "  3. npx turbo run lint                   # 應全綠"
Write-Host "  4. npx turbo run build                  # 應全綠"
Write-Host "  5. npm test --workspace services/api    # 應 4 case 全過"
Write-Host "  完成後把每條輸出貼回 Claude review。"

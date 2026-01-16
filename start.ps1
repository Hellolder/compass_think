Write-Host "Starting Think Compass..." -ForegroundColor Green

# 启动后端
Write-Host "Starting backend server..." -ForegroundColor Yellow
$backendJob = Start-Job -ScriptBlock {
    Set-Location "backend"
    & ".\.venv\Scripts\Activate.ps1"
    & "uvicorn" "main:app" "--host" "0.0.0.0" "--port" "8001" "--reload"
}

# 等待3秒让后端启动
Start-Sleep -Seconds 3

# 启动前端
Write-Host "Starting frontend dev server..." -ForegroundColor Yellow
$frontendJob = Start-Job -ScriptBlock {
    Set-Location "frontend"
    & "npm" "run" "dev" "--" "--host" "0.0.0.0" "--port" "5173"
}

Write-Host ""
Write-Host "Services starting..." -ForegroundColor Green
Write-Host "Backend: http://localhost:8001" -ForegroundColor Cyan
Write-Host "Frontend: http://localhost:5173" -ForegroundColor Cyan
Write-Host ""
Write-Host "Press Ctrl+C to stop all services" -ForegroundColor Yellow

# 等待用户中断
try {
    while ($true) {
        Start-Sleep -Seconds 1
    }
} finally {
    Write-Host "Stopping services..." -ForegroundColor Red
    Stop-Job $backendJob -ErrorAction SilentlyContinue
    Stop-Job $frontendJob -ErrorAction SilentlyContinue
    Remove-Job $backendJob -ErrorAction SilentlyContinue
    Remove-Job $frontendJob -ErrorAction SilentlyContinue
}
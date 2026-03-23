# ============================================
#   Setup completo do Git no Windows
#   Galpao Pro - Grupo Regulariza
# ============================================

$REPO_URL = "https://github.com/smoke182desu/cds-erp-industrial.git"
$TOKEN    = "SEU_TOKEN_AQUI"  # Cole seu GitHub Personal Access Token aqui
$REPO_URL_AUTH = "https://$TOKEN@github.com/smoke182desu/cds-erp-industrial.git"

Write-Host "============================================" -ForegroundColor Cyan
Write-Host "  Setup Git + GitHub - Galpao Pro" -ForegroundColor Cyan
Write-Host "============================================" -ForegroundColor Cyan
Write-Host ""

# 1. Verifica Git
if (-not (Get-Command git -ErrorAction SilentlyContinue)) {
    Write-Host "[!] Git nao encontrado. Instalando..." -ForegroundColor Yellow
    winget install --id Git.Git -e --source winget --accept-package-agreements --accept-source-agreements
    $env:Path = [System.Environment]::GetEnvironmentVariable("Path","Machine") + ";" + [System.Environment]::GetEnvironmentVariable("Path","User")
}
Write-Host "[OK] Git: $(git --version)" -ForegroundColor Green

# 2. Configura identidade
git config --global user.name "Grupo Regulariza"
git config --global user.email "raider@gruporegulariza.com"
git config --global init.defaultBranch main
git config --global core.autocrlf true
Write-Host "[OK] Git configurado" -ForegroundColor Green

# 3. Salva o token no Credential Manager do Windows (seguro)
$credTarget = "git:https://github.com"
cmdkey /add:$credTarget /user:"smoke182desu" /pass:$TOKEN | Out-Null
Write-Host "[OK] Token salvo no Windows Credential Manager" -ForegroundColor Green

# 4. Inicializa repo na pasta atual (se ainda nao for um repo)
$scriptDir = Split-Path -Parent $MyInvocation.MyCommand.Path
Set-Location $scriptDir

if (-not (Test-Path ".git")) {
    git init
    git remote add origin $REPO_URL_AUTH
} else {
    git remote set-url origin $REPO_URL_AUTH
}

git fetch origin main 2>$null
git branch -M main
Write-Host "[OK] Repositorio configurado" -ForegroundColor Green

Write-Host ""
Write-Host "============================================" -ForegroundColor Green
Write-Host "  Setup concluido!" -ForegroundColor Green
Write-Host "============================================" -ForegroundColor Green
Write-Host ""
Write-Host "Agora rode o auto-sync.ps1 para sincronizar" -ForegroundColor Yellow
Write-Host "automaticamente com o GitHub." -ForegroundColor Yellow
Write-Host ""
Read-Host "Pressione Enter para sair"

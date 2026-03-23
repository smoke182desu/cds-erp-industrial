# ============================================
#   Publicar no GitHub - Galpao Pro
#   Repositorio: smoke182desu/cds-erp-industrial
# ============================================

Write-Host "============================================" -ForegroundColor Cyan
Write-Host "  Publicando no GitHub..." -ForegroundColor Cyan
Write-Host "============================================" -ForegroundColor Cyan
Write-Host ""

# Verifica se git está instalado
if (-not (Get-Command git -ErrorAction SilentlyContinue)) {
    Write-Host "ERRO: Git nao encontrado!" -ForegroundColor Red
    Write-Host "Execute primeiro: instalar-git-github.ps1" -ForegroundColor Yellow
    Read-Host "Pressione Enter para sair"
    exit 1
}

$repoUrl = "https://github.com/smoke182desu/cds-erp-industrial.git"
$scriptDir = Split-Path -Parent $MyInvocation.MyCommand.Path

Write-Host "[1/4] Inicializando repositorio Git local..." -ForegroundColor Yellow
cd $scriptDir
git init
git config user.name "Grupo Regulariza"
git config user.email "raider@gruporegulariza.com"
git config init.defaultBranch main

Write-Host ""
Write-Host "[2/4] Preparando arquivos para commit..." -ForegroundColor Yellow
git add .
git status

Write-Host ""
Write-Host "[3/4] Criando commit inicial..." -ForegroundColor Yellow
git commit -m "feat: commit inicial do Galpao Pro ERP Industrial" 2>&1
if ($LASTEXITCODE -ne 0) {
    Write-Host "Commit ja existe ou nenhuma mudanca. Continuando..." -ForegroundColor Gray
}

Write-Host ""
Write-Host "[4/4] Enviando para o GitHub..." -ForegroundColor Yellow
Write-Host "Repositorio: $repoUrl" -ForegroundColor Gray
Write-Host ""
Write-Host "ATENCAO: Sera solicitado seu login do GitHub no navegador." -ForegroundColor Yellow

git remote remove origin 2>$null
git remote add origin $repoUrl
git branch -M main
git push -u origin main

if ($LASTEXITCODE -eq 0) {
    Write-Host ""
    Write-Host "============================================" -ForegroundColor Green
    Write-Host "  Codigo publicado com sucesso!" -ForegroundColor Green
    Write-Host "  https://github.com/smoke182desu/cds-erp-industrial" -ForegroundColor Green
    Write-Host "============================================" -ForegroundColor Green
} else {
    Write-Host ""
    Write-Host "Autenticacao necessaria. Tente com GitHub CLI:" -ForegroundColor Yellow
    Write-Host "  gh auth login" -ForegroundColor White
    Write-Host "  git push -u origin main" -ForegroundColor White
}

Write-Host ""
Read-Host "Pressione Enter para sair"

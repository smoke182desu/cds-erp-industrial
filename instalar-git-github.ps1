# ============================================
#   Instalador de Git + GitHub CLI para Windows
#   Galpao Pro - Grupo Regulariza
# ============================================

Write-Host "============================================" -ForegroundColor Cyan
Write-Host "  Instalando Git e GitHub CLI..." -ForegroundColor Cyan
Write-Host "============================================" -ForegroundColor Cyan
Write-Host ""

# Verifica se winget está disponível
$hasWinget = Get-Command winget -ErrorAction SilentlyContinue

if ($hasWinget) {
    Write-Host "[1/3] Instalando Git via winget..." -ForegroundColor Yellow
    winget install --id Git.Git -e --source winget --accept-package-agreements --accept-source-agreements

    Write-Host ""
    Write-Host "[2/3] Instalando GitHub CLI via winget..." -ForegroundColor Yellow
    winget install --id GitHub.cli -e --source winget --accept-package-agreements --accept-source-agreements

} else {
    Write-Host "winget nao encontrado. Baixando instaladores diretamente..." -ForegroundColor Yellow

    # Git para Windows
    Write-Host "[1/3] Baixando Git para Windows..." -ForegroundColor Yellow
    $gitUrl = "https://github.com/git-for-windows/git/releases/download/v2.47.1.windows.2/Git-2.47.1.2-64-bit.exe"
    $gitInstaller = "$env:TEMP\git-installer.exe"
    Invoke-WebRequest -Uri $gitUrl -OutFile $gitInstaller
    Start-Process -FilePath $gitInstaller -Args "/VERYSILENT /NORESTART" -Wait
    Remove-Item $gitInstaller

    # GitHub CLI
    Write-Host "[2/3] Baixando GitHub CLI..." -ForegroundColor Yellow
    $ghUrl = "https://github.com/cli/cli/releases/download/v2.67.0/gh_2.67.0_windows_amd64.msi"
    $ghInstaller = "$env:TEMP\gh-installer.msi"
    Invoke-WebRequest -Uri $ghUrl -OutFile $ghInstaller
    Start-Process -FilePath "msiexec.exe" -Args "/i $ghInstaller /quiet /norestart" -Wait
    Remove-Item $ghInstaller
}

# Recarrega o PATH
$env:Path = [System.Environment]::GetEnvironmentVariable("Path","Machine") + ";" + [System.Environment]::GetEnvironmentVariable("Path","User")

Write-Host ""
Write-Host "[3/3] Configurando Git..." -ForegroundColor Yellow

# Configurações básicas do Git
git config --global user.name "Grupo Regulariza"
git config --global user.email "raider@gruporegulariza.com"
git config --global init.defaultBranch main
git config --global core.autocrlf true
git config --global color.ui auto

Write-Host ""
Write-Host "============================================" -ForegroundColor Green
Write-Host "  Instalacao concluida!" -ForegroundColor Green
Write-Host "============================================" -ForegroundColor Green
Write-Host ""

# Verifica instalação
Write-Host "Versoes instaladas:" -ForegroundColor Cyan
git --version
gh --version

Write-Host ""
Write-Host "Proximo passo: Conecte ao GitHub com:" -ForegroundColor Yellow
Write-Host "  gh auth login" -ForegroundColor White
Write-Host ""
Read-Host "Pressione Enter para sair"

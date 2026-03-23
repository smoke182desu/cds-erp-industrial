# ============================================
#   Auto-Sync GitHub - Galpao Pro
#   Detecta alteracoes e salva no GitHub
#   automaticamente a cada 30 segundos
# ============================================

$TOKEN    = "SEU_TOKEN_AQUI"  # Configurado via setup-windows.ps1 no Credential Manager
$REPO_AUTH   = "https://github.com/smoke182desu/cds-erp-industrial.git"
# Autenticacao via Windows Credential Manager (configurado pelo setup-windows.ps1)
$scriptDir   = Split-Path -Parent $MyInvocation.MyCommand.Path
$INTERVALO   = 30  # segundos entre verificacoes

Set-Location $scriptDir

# Configura remote
git remote set-url origin $REPO_AUTH 2>$null

function Write-Log($msg, $cor = "White") {
    $hora = Get-Date -Format "HH:mm:ss"
    Write-Host "[$hora] $msg" -ForegroundColor $cor
}

function Sync-GitHub {
    $status = git status --porcelain
    if ($status) {
        Write-Log "Alteracoes detectadas. Salvando no GitHub..." "Yellow"
        git add .
        $timestamp = Get-Date -Format "dd/MM/yyyy HH:mm"
        git commit -m "auto-sync: $timestamp" 2>&1 | Out-Null
        $result = git push origin main 2>&1
        if ($LASTEXITCODE -eq 0) {
            Write-Log "Salvo no GitHub com sucesso!" "Green"
        } else {
            Write-Log "Erro ao salvar: $result" "Red"
        }
    } else {
        Write-Log "Sem alteracoes." "Gray"
    }
}

# Limpa a tela e exibe cabecalho
Clear-Host
Write-Host "============================================" -ForegroundColor Cyan
Write-Host "  AUTO-SYNC GITHUB - GALPAO PRO" -ForegroundColor Cyan
Write-Host "  Repositorio: smoke182desu/cds-erp-industrial" -ForegroundColor Gray
Write-Host "  Verificando a cada $INTERVALO segundos" -ForegroundColor Gray
Write-Host "  Para parar: pressione Ctrl+C" -ForegroundColor Gray
Write-Host "============================================" -ForegroundColor Cyan
Write-Host ""

# Faz sync inicial ao iniciar
Write-Log "Iniciando auto-sync..." "Cyan"
Sync-GitHub

# Loop principal
while ($true) {
    Start-Sleep -Seconds $INTERVALO
    Sync-GitHub
}

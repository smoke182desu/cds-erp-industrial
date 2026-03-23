# Cria atalho do CDS Industrial na Area de Trabalho
$ErrorActionPreference = "Stop"

try {
    # Descobre o caminho real da pasta do script
    $scriptDir = $PSScriptRoot
    if (-not $scriptDir) {
        $scriptDir = Split-Path -Parent $MyInvocation.MyCommand.Definition
    }
    if (-not $scriptDir) {
        $scriptDir = (Get-Location).Path
    }

    $batPath    = Join-Path $scriptDir "abrir-app.bat"
    $desktop    = [System.Environment]::GetFolderPath("Desktop")
    $atalhoPath = Join-Path $desktop "CDS Industrial.lnk"

    # Cria o atalho
    $wsh  = New-Object -ComObject WScript.Shell
    $link = $wsh.CreateShortcut($atalhoPath)
    $link.TargetPath       = $batPath
    $link.WorkingDirectory = $scriptDir
    $link.WindowStyle      = 1
    $link.Description      = "Abre o sistema ERP CDS Industrial"
    $link.Save()

    # Confirma com caixa de dialogo
    $msg = [System.Windows.Forms.MessageBox]
    Add-Type -AssemblyName System.Windows.Forms
    [System.Windows.Forms.MessageBox]::Show(
        "Atalho 'CDS Industrial' criado na Area de Trabalho!`n`nAgora e so dar duplo clique nele para abrir o sistema.",
        "Sucesso",
        [System.Windows.Forms.MessageBoxButtons]::OK,
        [System.Windows.Forms.MessageBoxIcon]::Information
    )

} catch {
    Add-Type -AssemblyName System.Windows.Forms
    [System.Windows.Forms.MessageBox]::Show(
        "Erro ao criar atalho:`n$_`n`nCaminho tentado: $atalhoPath",
        "Erro",
        [System.Windows.Forms.MessageBoxButtons]::OK,
        [System.Windows.Forms.MessageBoxIcon]::Error
    )
}

@echo off
setlocal

:: Pega o caminho da pasta atual
set "PASTA=%~dp0"
:: Remove a barra final
if "%PASTA:~-1%"=="\" set "PASTA=%PASTA:~0,-1%"

set "BAT=%PASTA%\abrir-app.bat"
set "DESKTOP=%USERPROFILE%\Desktop"
set "ATALHO=%DESKTOP%\CDS Industrial.lnk"

:: Escreve script PowerShell em arquivo temporario
set "TEMP_PS=%TEMP%\criar_atalho_cds.ps1"

(
echo $ws = New-Object -ComObject WScript.Shell
echo $s  = $ws.CreateShortcut('%ATALHO%'^)
echo $s.TargetPath       = '%BAT%'
echo $s.WorkingDirectory = '%PASTA%'
echo $s.WindowStyle      = 1
echo $s.Description      = 'CDS Industrial ERP'
echo $s.Save(^)
echo [System.Windows.Forms.MessageBox]::Show('Atalho CDS Industrial criado na Area de Trabalho!', 'Pronto', 0, 64^)
) > "%TEMP_PS%"

:: Executa o script
powershell -ExecutionPolicy Bypass -NoProfile -Command "Add-Type -AssemblyName System.Windows.Forms; & '%TEMP_PS%'"

:: Limpa o arquivo temporario
del "%TEMP_PS%" 2>nul

endlocal

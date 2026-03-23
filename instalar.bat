@echo off
echo ============================================
echo   Instalando Galpao Pro...
echo ============================================
echo.

where node >nul 2>&1
if %ERRORLEVEL% NEQ 0 (
    echo ERRO: Node.js nao encontrado!
    echo Por favor instale o Node.js em: https://nodejs.org/
    pause
    exit /b 1
)

echo Node.js encontrado. Instalando dependencias...
call npm install --ignore-scripts
if %ERRORLEVEL% NEQ 0 (
    echo ERRO na instalacao das dependencias!
    pause
    exit /b 1
)

echo.
echo ============================================
echo   Instalacao concluida com sucesso!
echo ============================================
echo.
echo PROXIMO PASSO: Configure o arquivo .env.local
echo com sua chave GEMINI_API_KEY antes de rodar.
echo.
pause

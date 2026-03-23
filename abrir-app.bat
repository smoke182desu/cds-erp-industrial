@echo off
cd /d "%~dp0"
title CDS Industrial - ERP

echo.
echo  ==========================================
echo    CDS INDUSTRIAL - Iniciando o sistema...
echo  ==========================================
echo.

:: Verifica se o Node.js esta instalado
node --version >nul 2>&1
if errorlevel 1 (
    echo ERRO: Node.js nao encontrado!
    echo.
    echo Instale o Node.js em: https://nodejs.org
    echo Baixe a versao LTS e instale normalmente.
    echo.
    pause
    exit /b 1
)

echo Node.js encontrado:
node --version
echo.

:: Verifica se serve.cjs existe
if not exist "%~dp0serve.cjs" (
    echo ERRO: Arquivo serve.cjs nao encontrado!
    echo Pasta atual: %~dp0
    pause
    exit /b 1
)

:: Verifica se a pasta dist existe
if not exist "%~dp0dist\index.html" (
    echo ERRO: Pasta dist nao encontrada ou incompleta!
    echo Pasta atual: %~dp0
    pause
    exit /b 1
)

echo Iniciando servidor...
echo Aguarde e o navegador abrira automaticamente.
echo.

:: Abre o navegador apos 3 segundos
start "" /min cmd /c "timeout /t 3 /nobreak >nul && start http://localhost:3000"

:: Inicia o servidor
node "%~dp0serve.cjs"

echo.
echo Servidor encerrado.
pause

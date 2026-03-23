@echo off
cd /d "%~dp0"
echo.
echo ==============================
echo   CDS ERP - Salvar no GitHub
echo ==============================
echo.

set /p MSG=Digite uma descricao das alteracoes (ex: Corrige preco NaN): 

if "%MSG%"=="" (
  set MSG=Atualizacao automatica - %DATE% %TIME%
)

git add -A
git commit -m "%MSG%"
git push origin main

echo.
echo ==============================
echo   Enviado para o GitHub!
echo ==============================
echo.
pause

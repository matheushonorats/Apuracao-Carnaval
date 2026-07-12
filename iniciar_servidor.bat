@echo off
echo Iniciando servidor de Apuracao...
echo.
echo O servidor identificará automaticamente o melhor IP da rede.
echo Aguarde o carregamento abaixo...
echo.
echo O navegador vai abrir automaticamente em 5 segundos...
echo Mantenha esta janela aberta!
echo.

start "" "http://localhost:3000"
node server.js

pause

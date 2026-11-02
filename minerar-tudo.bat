@echo off
title Solo Miner - PC + Celular
cd /d C:\solo-miner

REM ====== CONFIGURACAO ======
REM Endereco Bitcoin SEM sufixo. O programa acrescenta .pc e .cel sozinho.
set BTC_USER=bc1qsynd3t4h72wfk9xyspr78cuekevfggf7c9sc5d

REM Apelido DESTA maquina. Use um diferente em cada computador, para
REM distinguir no painel do pool: pc, note, escritorio, casa...
set APELIDO=pc

set POOL_HOST=solo.ckpool.org
set POOL_PORT=3333
set LISTEN_PORT=8081

REM Numero de threads. Em branco = nucleos menos um (deixa o PC usavel).
REM Com todos os nucleos rende cerca de 30%% mais, mas o PC fica lento.
REM Volte a deixar em branco se for trabalhar na maquina.
set THREADS=4

REM Ponha 1 para esconder as mensagens detalhadas e ver so o painel.
set SILENCIOSO=
REM ==========================

cls
node minerar-tudo.js

echo.
echo ================================================
echo  Encerrado. Esta janela fica aberta para leitura.
echo ================================================
pause

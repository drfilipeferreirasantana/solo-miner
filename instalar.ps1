# Baixa ou atualiza todos os arquivos do minerador em C:\solo-miner.
#
# Resolve de uma vez os tropecos de instalar arquivo por arquivo: nada fica na
# pasta errada, nada ganha .txt no fim do nome, nada chega pela metade. Pode
# rodar quantas vezes quiser - sempre traz a versao mais recente.
#
# No PowerShell:
#     cd C:\solo-miner
#     irm "https://raw.githubusercontent.com/drfilipeferreirasantana/solo-miner/main/instalar.ps1" | iex

$pasta = "C:\solo-miner"
$base  = "https://raw.githubusercontent.com/drfilipeferreirasantana/solo-miner/main/"

$arquivos = @(
  "minerar-tudo.js", "minerar-tudo.bat", "LEIA-ME-minerar-tudo.txt",
  "stratum-ws-proxy.js", "miner.html", "miner-pc.js",
  "monitorar-bloco.bat", "alerta-bloco.ps1", "iniciar-proxy.bat"
)

if (-not (Test-Path $pasta)) { New-Item -ItemType Directory -Path $pasta | Out-Null }
Set-Location $pasta

Write-Host ""
Write-Host "Baixando para $pasta" -ForegroundColor Cyan
Write-Host ("-" * 58)

$erros = 0
foreach ($a in $arquivos) {
  try {
    # para um arquivo temporario primeiro: assim um download interrompido nao
    # substitui um arquivo que ja funcionava
    $tmp = "$a.baixando"
    Invoke-WebRequest -Uri ($base + $a) -OutFile $tmp -UseBasicParsing -ErrorAction Stop
    $t = (Get-Item $tmp).Length
    if ($t -lt 200) { throw "veio vazio ou incompleto ($t bytes)" }
    Move-Item $tmp $a -Force
    Write-Host ("  ok     {0,-26} {1,8:N0} bytes" -f $a, $t) -ForegroundColor Green
  } catch {
    if (Test-Path $tmp) { Remove-Item $tmp -Force -ErrorAction SilentlyContinue }
    Write-Host ("  FALHOU {0,-26} {1}" -f $a, $_.Exception.Message) -ForegroundColor Red
    $erros++
  }
}

Write-Host ("-" * 58)

# a biblioteca ws e necessaria ao proxy do celular
if (-not (Test-Path "$pasta\node_modules\ws")) {
  Write-Host "  Instalando a biblioteca ws..." -ForegroundColor Yellow
  npm install ws --silent
}

if ($erros -eq 0) {
  Write-Host ""
  Write-Host "  Tudo pronto." -ForegroundColor Green
  Write-Host "    1. Feche a janela do minerar-tudo que estiver aberta"
  Write-Host "    2. Confira a linha BTC_USER no minerar-tudo.bat"
  Write-Host "    3. Abra o minerar-tudo.bat"
  Write-Host "    4. No celular, RECARREGUE a pagina (puxe a tela para baixo)"
} else {
  Write-Host ""
  Write-Host "  $erros arquivo(s) falharam. Confira a conexao e rode de novo." -ForegroundColor Red
}
Write-Host ""

# Solo Miner — PC + Celular

Mineração solo de Bitcoin somando a força do computador e de quantos celulares
você quiser, todos para o mesmo endereço.

## Instalar ou atualizar

No PowerShell, um comando só:

```powershell
cd C:\solo-miner
irm "https://raw.githubusercontent.com/drfilipeferreirasantana/solo-miner/main/instalar.ps1" | iex
```

Pode rodar quantas vezes quiser — sempre traz a versão mais recente. Baixa para
arquivo temporário antes de substituir, então um download interrompido nunca
estraga uma instalação que já funcionava.

## Usar

1. Abra `minerar-tudo.bat` e confira a linha do `BTC_USER` — o endereço vai
   **sem sufixo**; o programa acrescenta `.pc` e `.pc-cel` sozinho.
2. Dois cliques em `minerar-tudo.bat`.
3. Anote o IP que aparecer na tela.
4. No celular, mesma rede Wi-Fi: `http://SEU_IP:8081/`
5. Na página: proxy `ws://SEU_IP:8081/ws`, e o endereço Bitcoin.

O painel mostra as duas forças somadas:

```
TOTAL 11.6 MH/s  |  PC 8.6 MH/s  |  CEL 3.0 MH/s x2  |  shares 4
```

## Mais aparelhos

**Mais celulares:** abra o mesmo endereço em quantos quiser. Não instala nada.
O painel soma todos e mostra `x2`, `x3`.

**Mais computadores:** rode o instalador em cada um e mude só a linha
`set APELIDO=` no `minerar-tudo.bat` (`note`, `escritorio`...). O endereço
Bitcoin é o mesmo; o apelido separa as máquinas no painel do pool.

## Os arquivos

| Arquivo | O que faz |
|---|---|
| `minerar-tudo.js` | Liga as duas frentes e soma no painel |
| `minerar-tudo.bat` | Atalho de clique duplo |
| `miner-pc.js` | Mina no computador (WASM SIMD, Stratum por TCP) |
| `stratum-ws-proxy.js` | Serve a página, faz a ponte para os celulares, detecta bloco |
| `miner.html` | A página que o celular abre |
| `monitorar-bloco.bat` | Vigia o log e alerta com som se achar bloco |
| `alerta-bloco.ps1` | O alerta sonoro e visual |
| `iniciar-proxy.bat` | Só o proxy, sem o minerador do PC |
| `miner-python.py` | Versão didática, em Python puro, para leitura |
| `instalar.ps1` | Baixa ou atualiza tudo |

## Honestidade sobre as chances

Encontrar um bloco solo com esta potência é estatisticamente quase impossível.
Dobrar a força dobra uma probabilidade que continua mínima — cada hash é um
bilhete independente, sem bônus por quantidade.

O valor deste projeto está no que foi construído e aprendido, não no prêmio.

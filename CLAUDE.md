# Estado do projeto — leia antes de agir

Resumo para retomar sem reler o histórico.

## Quem

Filipe Ferreira Santana, advogado (OAB/ES 37.159). Não é programador: dar
comandos prontos para colar, um de cada vez, e conferir resultado antes de
seguir. Windows + PowerShell, iPhone com Safari.

## Os três repositórios

| Repositório | Visibilidade | Conteúdo |
|---|---|---|
| `solo-miner` | público | Este. Minerador. Sem dado de cliente |
| `registro-provas-hash` | público | Sistema de preservação de prova digital. Público por necessidade: o magistrado verifica |
| `ficha_preconsulta_filipe_ferreira` | **privado** | Sistema de gestão do escritório (clientes, financeiro, PJe, Asaas, WhatsApp). **Manter fechado** |

Instalação no PC dele, sempre:

```powershell
cd C:\solo-miner
irm "https://raw.githubusercontent.com/drfilipeferreirasantana/solo-miner/main/instalar.ps1" | iex
```

## Arquitetura do minerador

`minerar-tudo.js` lança dois processos filhos e lê a saída deles:

- `miner-pc.js` — mina no PC (worker_threads + WASM SIMD, Stratum TCP direto)
- `stratum-ws-proxy.js` — serve `miner.html` e faz ponte WebSocket↔TCP para os
  celulares; detecta bloco recalculando o hash contra o alvo real da rede

A página informa a própria taxa por `POST /taxa` (canal HTTP separado, **nunca
pelo Stratum**: mensagem fora do protocolo pode derrubar a sessão com o pool).
Vários celulares somam, cada um com id próprio guardado no navegador.

Nomes de trabalhador: `endereço.APELIDO` (PC) e `endereço.APELIDO-cel`.
Um apelido por computador.

## Convenções que custaram caro para descobrir

- **Merkle root NÃO leva swap de bytes.** version, prevhash, ntime e nbits
  levam. Conferido contra o bloco genesis — há guarda que aborta se quebrar.
- **extranonce2_size vem do pool** (ckpool usa 8, não 4). Ler da resposta.
- **ckpool impõe dificuldade 1**, ignorando sugestão menor. Cada share exige
  2³² hashes ≈ 9 min a 8 MH/s. "shares 0" nos primeiros minutos é normal.
- **Hashrate é taxa, não contador**: delta/tempo com suavização.
- **`ws` remove o cliente de `wss.clients` ANTES do evento `close`** — não
  descontar 1 na contagem.
- **Renomear, copiar, mudar data do sistema ou abrir para leitura NÃO alteram
  o hash de um arquivo.** Só o conteúdo altera. (Verificado.)

## Armadilhas do ambiente dele

- Download pelo chat **falha com frequência** — arquivo não chega, ou vem
  truncado, ou ganha `.txt`. Usar sempre o instalador do repositório público.
- Colar bloco grande no PowerShell **trunca**. Comandos curtos.
- `.js` não se abre com dois cliques no Windows: `node arquivo.js`.
- O IP da rede local muda com frequência. O lançador imprime o atual; usar
  sempre esse, e só o da linha Wi-Fi (ignorar Radmin VPN e Topaz Loopback).
- Safari guardava a página em cache. O proxy agora manda `no-store`.

## Como trabalhar aqui

Testes contra pool falso em `/tmp/.../scratchpad`, com Playwright e navegador
real. Regra aprendida: **um teste que passa nas duas versões não prova nada** —
construir até reprovar a versão com defeito, e só então confiar na aprovação.

## Honestidade sobre o projeto

Encontrar bloco solo com ~10 MH/s é estatisticamente quase impossível, e ele
sabe: há declaração datada e pública no repositório da ficha, registrada antes
de qualquer resultado. Não repetir o sermão das probabilidades a cada
mensagem; ele já decidiu, de olhos abertos. Mas nunca sugerir que vai dar
certo.

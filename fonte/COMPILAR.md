# Como recompilar o núcleo

O `nucleo.c` é a fonte do WebAssembly embutido em `miner-pc.js` e `miner.html`.
Ficava perdida; agora mora aqui.

```bash
clang --target=wasm32 -O3 -msimd128 -nostdlib \
      -Wl,--no-entry -Wl,--export-dynamic -Wl,--initial-memory=1048576 \
      -o nucleo.wasm nucleo.c
```

Depois converta para base64 em linhas de 110 caracteres e substitua os blocos
`WASM_B64` (em `miner-pc.js`) e `WASM_SIMD_B64` (em `miner.html`).

## Antes de publicar qualquer mudança aqui

1. `digest()` tem de bater com o SHA-256d de referência em centenas de
   cabeçalhos aleatórios.
2. `scan()` tem de achar **exatamente os mesmos nonces** que a versão anterior.
3. Rodar o minerador de verdade contra um pool falso que recalcule cada share
   de forma independente. Zero inválidos, ou não sobe.

Um erro aqui não quebra nada de modo visível: produz share inválido, que o
pool rejeita em silêncio. Por isso a verificação é em três camadas.

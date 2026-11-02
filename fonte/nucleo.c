// Nucleo de mineracao SHA-256d, 4 nonces por vez com SIMD de 128 bits.
//
// Interface identica a do nucleo anterior, para troca peca por peca:
//   hdr_ptr/stgt_ptr/ntgt_ptr/out_ptr  ponteiros para a memoria compartilhada
//   prepare()                          chamar apos escrever o cabecalho
//   scan(inicio, quantos)              1 se achou; out[0]=nonce out[1]=ehBloco
//   digest()                           hash completo de um nonce, para conferir
//
// Otimizacoes sobre o anterior:
//
//  1. Midstate - o primeiro bloco de 64 bytes do cabecalho nao muda com o
//     nonce, entao e comprimido uma vez em prepare().
//  2. Rodadas 0 a 2 do segundo bloco tambem nao tocam o nonce (ele e a
//     palavra 3), entao sao pre-calculadas em prepare().
//  3. As palavras 5 a 14 do segundo bloco sao ZERO. A expansao generica
//     calcularia sigma sobre zeros; aqui esses termos somem do codigo.
//  4. Saida antecipada: o alvo exige que os 32 bits mais altos do hash
//     exibido sejam zero, e esses vem da ultima palavra. Calcula-se so o
//     necessario para ela e, falhando, descarta-se antes das somas finais.

#include <wasm_simd128.h>

#define EXP(n) __attribute__((export_name(n)))

// sem biblioteca padrao: o compilador gera chamadas a memset nos lacos de
// zeragem, entao fornecemos a nossa
void *memset(void *d, int c, unsigned long n){
  unsigned char *p = (unsigned char*)d;
  while(n--) *p++ = (unsigned char)c;
  return d;
}
void *memcpy(void *d, const void *s, unsigned long n){
  unsigned char *a=(unsigned char*)d; const unsigned char *b=(const unsigned char*)s;
  while(n--) *a++ = *b++;
  return d;
}

static unsigned char  HDR[80];
static unsigned int   STGT[8], NTGT[8], OUT[8];

static const unsigned int K[64] = {
0x428a2f98,0x71374491,0xb5c0fbcf,0xe9b5dba5,0x3956c25b,0x59f111f1,0x923f82a4,0xab1c5ed5,
0xd807aa98,0x12835b01,0x243185be,0x550c7dc3,0x72be5d74,0x80deb1fe,0x9bdc06a7,0xc19bf174,
0xe49b69c1,0xefbe4786,0x0fc19dc6,0x240ca1cc,0x2de92c6f,0x4a7484aa,0x5cb0a9dc,0x76f988da,
0x983e5152,0xa831c66d,0xb00327c8,0xbf597fc7,0xc6e00bf3,0xd5a79147,0x06ca6351,0x14292967,
0x27b70a85,0x2e1b2138,0x4d2c6dfc,0x53380d13,0x650a7354,0x766a0abb,0x81c2c92e,0x92722c85,
0xa2bfe8a1,0xa81a664b,0xc24b8b70,0xc76c51a3,0xd192e819,0xd6990624,0xf40e3585,0x106aa070,
0x19a4c116,0x1e376c08,0x2748774c,0x34b0bcb5,0x391c0cb3,0x4ed8aa4a,0x5b9cca4f,0x682e6ff3,
0x748f82ee,0x78a5636f,0x84c87814,0x8cc70208,0x90befffa,0xa4506ceb,0xbef9a3f7,0xc67178f2};

static const unsigned int IV[8] = {
0x6a09e667,0xbb67ae85,0x3c6ef372,0xa54ff53a,0x510e527f,0x9b05688c,0x1f83d9ab,0x5be0cd19};

// ---------- escalar, usado so em prepare() e digest() ----------
#define ROR(x,n) (((x)>>(n))|((x)<<(32-(n))))
#define S0(x) (ROR(x,2)^ROR(x,13)^ROR(x,22))
#define S1(x) (ROR(x,6)^ROR(x,11)^ROR(x,25))
#define s0(x) (ROR(x,7)^ROR(x,18)^((x)>>3))
#define s1(x) (ROR(x,17)^ROR(x,19)^((x)>>10))

static void comprimir(unsigned int *h, const unsigned int *w16){
  unsigned int w[64];
  for(int i=0;i<16;i++) w[i]=w16[i];
  for(int i=16;i<64;i++) w[i]=s1(w[i-2])+w[i-7]+s0(w[i-15])+w[i-16];
  unsigned int a=h[0],b=h[1],c=h[2],d=h[3],e=h[4],f=h[5],g=h[6],hh=h[7];
  for(int i=0;i<64;i++){
    unsigned int t1=hh+S1(e)+((e&f)^(~e&g))+K[i]+w[i];
    unsigned int t2=S0(a)+((a&b)^(a&c)^(b&c));
    hh=g; g=f; f=e; e=d+t1; d=c; c=b; b=a; a=t1+t2;
  }
  h[0]+=a;h[1]+=b;h[2]+=c;h[3]+=d;h[4]+=e;h[5]+=f;h[6]+=g;h[7]+=hh;
}

// ---------- SIMD ----------
#define V v128_t
#define VROR(x,n) wasm_v128_or(wasm_u32x4_shr(x,n), wasm_i32x4_shl(x,32-(n)))
#define VS0(x) wasm_v128_xor(wasm_v128_xor(VROR(x,2),VROR(x,13)),VROR(x,22))
#define VS1(x) wasm_v128_xor(wasm_v128_xor(VROR(x,6),VROR(x,11)),VROR(x,25))
#define Vs0(x) wasm_v128_xor(wasm_v128_xor(VROR(x,7),VROR(x,18)),wasm_u32x4_shr(x,3))
#define Vs1(x) wasm_v128_xor(wasm_v128_xor(VROR(x,17),VROR(x,19)),wasm_u32x4_shr(x,10))
#define ADD(a,b) wasm_i32x4_add(a,b)
#define CH(e,f,g) wasm_v128_bitselect(f,g,e)
#define MAJ(a,b,c) wasm_v128_or(wasm_v128_and(a,wasm_v128_or(b,c)),wasm_v128_and(b,c))
#define SPL(x) wasm_i32x4_splat(x)

// estado preparado
static unsigned int MID[8];        // midstate do 1o bloco
static unsigned int W2[3];         // palavras 0..2 do 2o bloco (fixas)
static unsigned int P[8];          // estado apos as rodadas 0..2 do 2o bloco
static unsigned int W16, W17;      // expansoes que nao dependem do nonce

EXP("hdr_ptr")  unsigned int hdr_ptr(void){ return (unsigned int)HDR; }
EXP("stgt_ptr") unsigned int stgt_ptr(void){ return (unsigned int)STGT; }
EXP("ntgt_ptr") unsigned int ntgt_ptr(void){ return (unsigned int)NTGT; }
EXP("out_ptr")  unsigned int out_ptr(void){ return (unsigned int)OUT; }

static unsigned int be32(const unsigned char *p){
  return ((unsigned int)p[0]<<24)|((unsigned int)p[1]<<16)|((unsigned int)p[2]<<8)|p[3];
}

EXP("prepare") void prepare(void){
  unsigned int w[16];
  for(int i=0;i<16;i++) w[i]=be32(HDR+i*4);
  for(int i=0;i<8;i++) MID[i]=IV[i];
  comprimir(MID, w);                       // 1o bloco: 64 bytes do cabecalho

  for(int i=0;i<3;i++) W2[i]=be32(HDR+64+i*4);   // bytes 64..75: fixos no job

  // rodadas 0..2 do 2o bloco: usam W2[0..2], nao o nonce
  unsigned int a=MID[0],b=MID[1],c=MID[2],d=MID[3],
               e=MID[4],f=MID[5],g=MID[6],h=MID[7];
  for(int i=0;i<3;i++){
    unsigned int t1=h+S1(e)+((e&f)^(~e&g))+K[i]+W2[i];
    unsigned int t2=S0(a)+((a&b)^(a&c)^(b&c));
    h=g; g=f; f=e; e=d+t1; d=c; c=b; b=a; a=t1+t2;
  }
  P[0]=a;P[1]=b;P[2]=c;P[3]=d;P[4]=e;P[5]=f;P[6]=g;P[7]=h;

  // W[5..14] sao zero; W[4]=0x80000000; W[15]=640
  // W16 = s1(W14=0) + W9=0 + s0(W1) + W0  ->  s0(W2[1]) + W2[0]
  W16 = s0(W2[1]) + W2[0];
  // W17 = s1(W15=640) + W10=0 + s0(W2) + W1
  W17 = s1(640) + s0(W2[2]) + W2[1];
}

// Devolve o hash completo (8 palavras, ordem interna) de um nonce. Usado para
// conferir um achado antes de enviar, e no teste de corretude.
EXP("digest") void digest(unsigned int nonce){
  unsigned int w[16], h1[8], h2[8];
  w[0]=W2[0]; w[1]=W2[1]; w[2]=W2[2];
  w[3]=__builtin_bswap32(nonce);   // no cabecalho o nonce e little-endian
  w[4]=0x80000000u; for(int i=5;i<15;i++) w[i]=0; w[15]=640;
  for(int i=0;i<8;i++) h1[i]=MID[i];
  comprimir(h1, w);
  for(int i=0;i<8;i++) w[i]=h1[i];
  w[8]=0x80000000u; for(int i=9;i<15;i++) w[i]=0; w[15]=256;
  for(int i=0;i<8;i++) h2[i]=IV[i];
  comprimir(h2, w);
  for(int i=0;i<8;i++) OUT[i]=h2[i];
}

// Compara o hash (ordem interna) com um alvo em palavras big-endian de
// exibicao: alvo[0] e a parte mais significativa do hash como se le.
static int abaixoDoAlvo(const unsigned int *h, const unsigned int *alvo){
  for(int i=0;i<8;i++){
    unsigned int x = __builtin_bswap32(h[7-i]);
    if(x < alvo[i]) return 1;
    if(x > alvo[i]) return 0;
  }
  return 1;
}

EXP("scan") int scan(unsigned int inicio, unsigned int quantos){
  const V w4   = SPL(0x80000000u);
  const V zero = wasm_i32x4_splat(0);
  const V alvo0 = SPL(STGT[0]);

  for(unsigned int n=0; n<quantos; n+=4){
    const unsigned int base = inicio + n;
    // Janela deslizante de 16 palavras em vez de um vetor de 64.
    // Sessenta e quatro vetores sao 1 KB de pilha, que o compilador derrama
    // para a memoria a cada rodada. Com dezesseis, cabem em registradores.
    V w[16];
    w[0]=SPL(W2[0]); w[1]=SPL(W2[1]); w[2]=SPL(W2[2]);
    w[3]=wasm_i32x4_make(__builtin_bswap32(base),   __builtin_bswap32(base+1),
                         __builtin_bswap32(base+2), __builtin_bswap32(base+3));
    w[4]=w4;
    for(int i=5;i<15;i++) w[i]=zero;
    w[15]=SPL(640);

    V a=SPL(P[0]),b=SPL(P[1]),c=SPL(P[2]),d=SPL(P[3]),
      e=SPL(P[4]),f=SPL(P[5]),g=SPL(P[6]),h=SPL(P[7]);

    // rodadas 3..15 com as palavras originais (0..2 ja feitas em prepare)
    for(int i=3;i<16;i++){
      V t1=ADD(ADD(ADD(h,VS1(e)),ADD(CH(e,f,g),SPL(K[i]))),w[i]);
      V t2=ADD(VS0(a),MAJ(a,b,c));
      h=g; g=f; f=e; e=ADD(d,t1); d=c; c=b; b=a; a=ADD(t1,t2);
    }
    // rodadas 16..63, expandindo em cima da propria janela
    for(int i=16;i<64;i++){
      V nw = ADD(ADD(Vs1(w[(i-2)&15]), w[(i-7)&15]),
                 ADD(Vs0(w[(i-15)&15]), w[i&15]));
      w[i&15] = nw;
      V t1=ADD(ADD(ADD(h,VS1(e)),ADD(CH(e,f,g),SPL(K[i]))),nw);
      V t2=ADD(VS0(a),MAJ(a,b,c));
      h=g; g=f; f=e; e=ADD(d,t1); d=c; c=b; b=a; a=ADD(t1,t2);
    }
    V h1[8];
    h1[0]=ADD(SPL(MID[0]),a); h1[1]=ADD(SPL(MID[1]),b);
    h1[2]=ADD(SPL(MID[2]),c); h1[3]=ADD(SPL(MID[3]),d);
    h1[4]=ADD(SPL(MID[4]),e); h1[5]=ADD(SPL(MID[5]),f);
    h1[6]=ADD(SPL(MID[6]),g); h1[7]=ADD(SPL(MID[7]),h);

    // --- 2o SHA: entrada = h1 (32 bytes) + enchimento ---
    for(int i=0;i<8;i++) w[i]=h1[i];
    w[8]=w4; for(int i=9;i<15;i++) w[i]=zero; w[15]=SPL(256);

    a=SPL(IV[0]);b=SPL(IV[1]);c=SPL(IV[2]);d=SPL(IV[3]);
    e=SPL(IV[4]);f=SPL(IV[5]);g=SPL(IV[6]);h=SPL(IV[7]);
    for(int i=0;i<16;i++){
      V t1=ADD(ADD(ADD(h,VS1(e)),ADD(CH(e,f,g),SPL(K[i]))),w[i]);
      V t2=ADD(VS0(a),MAJ(a,b,c));
      h=g; g=f; f=e; e=ADD(d,t1); d=c; c=b; b=a; a=ADD(t1,t2);
    }
    // ate a rodada 60: apos ela, 'e' ja e a ultima palavra do estado final
    for(int i=16;i<61;i++){
      V nw = ADD(ADD(Vs1(w[(i-2)&15]), w[(i-7)&15]),
                 ADD(Vs0(w[(i-15)&15]), w[i&15]));
      w[i&15] = nw;
      V t1=ADD(ADD(ADD(h,VS1(e)),ADD(CH(e,f,g),SPL(K[i]))),nw);
      V t2=ADD(VS0(a),MAJ(a,b,c));
      h=g; g=f; f=e; e=ADD(d,t1); d=c; c=b; b=a; a=ADD(t1,t2);
    }
    // h apos 64 = g apos 63 = f apos 62 = e apos 61: as tres ultimas
    // rodadas nao alteram o que vamos olhar
    V ult=ADD(SPL(IV[7]), e);
    V ultb = wasm_i8x16_shuffle(ult, ult, 3,2,1,0, 7,6,5,4,
                                11,10,9,8, 15,14,13,12);
    if(wasm_v128_any_true(wasm_u32x4_le(ultb, alvo0))){
      for(int L=0; L<4; L++){
        unsigned int cand = base + L;
        digest(cand);
        if(abaixoDoAlvo(OUT, STGT)){
          unsigned int tmp[8];
          for(int i=0;i<8;i++) tmp[i]=OUT[i];
          int bloco = abaixoDoAlvo(tmp, NTGT);
          OUT[0]=cand; OUT[1]=(unsigned int)bloco;
          return 1;
        }
      }
    }
  }
  return 0;
}

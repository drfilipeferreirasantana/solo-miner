// SHA-256d para mineracao, um nonce por invocacao.
//
// A GPU apenas PROPOE candidatos: quem confirma e o nucleo WASM, na CPU,
// antes de qualquer envio ao pool. Assim, mesmo um erro aqui nao consegue
// produzir share invalido - no pior caso a GPU propoe algo que a CPU recusa.

struct Params {
  mid     : array<vec4<u32>, 2>,   // midstate do 1o bloco (8 palavras)
  w2      : vec4<u32>,             // w2.xyz = palavras 0..2 do 2o bloco
  cfg     : vec4<u32>,             // x = alvo0, y = nonce inicial
};

@group(0) @binding(0) var<uniform> P : Params;
@group(0) @binding(1) var<storage, read_write> achados : array<atomic<u32>>;

const K = array<u32, 64>(
0x428a2f98u,0x71374491u,0xb5c0fbcfu,0xe9b5dba5u,0x3956c25bu,0x59f111f1u,0x923f82a4u,0xab1c5ed5u,
0xd807aa98u,0x12835b01u,0x243185beu,0x550c7dc3u,0x72be5d74u,0x80deb1feu,0x9bdc06a7u,0xc19bf174u,
0xe49b69c1u,0xefbe4786u,0x0fc19dc6u,0x240ca1ccu,0x2de92c6fu,0x4a7484aau,0x5cb0a9dcu,0x76f988dau,
0x983e5152u,0xa831c66du,0xb00327c8u,0xbf597fc7u,0xc6e00bf3u,0xd5a79147u,0x06ca6351u,0x14292967u,
0x27b70a85u,0x2e1b2138u,0x4d2c6dfcu,0x53380d13u,0x650a7354u,0x766a0abbu,0x81c2c92eu,0x92722c85u,
0xa2bfe8a1u,0xa81a664bu,0xc24b8b70u,0xc76c51a3u,0xd192e819u,0xd6990624u,0xf40e3585u,0x106aa070u,
0x19a4c116u,0x1e376c08u,0x2748774cu,0x34b0bcb5u,0x391c0cb3u,0x4ed8aa4au,0x5b9cca4fu,0x682e6ff3u,
0x748f82eeu,0x78a5636fu,0x84c87814u,0x8cc70208u,0x90befffau,0xa4506cebu,0xbef9a3f7u,0xc67178f2u);

const IV = array<u32, 8>(
0x6a09e667u,0xbb67ae85u,0x3c6ef372u,0xa54ff53au,0x510e527fu,0x9b05688cu,0x1f83d9abu,0x5be0cd19u);

fn ror(x: u32, n: u32) -> u32 { return (x >> n) | (x << (32u - n)); }
fn bS0(x: u32) -> u32 { return ror(x,2u) ^ ror(x,13u) ^ ror(x,22u); }
fn bS1(x: u32) -> u32 { return ror(x,6u) ^ ror(x,11u) ^ ror(x,25u); }
fn sS0(x: u32) -> u32 { return ror(x,7u) ^ ror(x,18u) ^ (x >> 3u); }
fn sS1(x: u32) -> u32 { return ror(x,17u) ^ ror(x,19u) ^ (x >> 10u); }
fn bswap(x: u32) -> u32 {
  return ((x & 0xFFu) << 24u) | ((x & 0xFF00u) << 8u) |
         ((x >> 8u) & 0xFF00u) | ((x >> 24u) & 0xFFu);
}

@compute @workgroup_size(64)
fn main(@builtin(global_invocation_id) gid : vec3<u32>) {
  let nonce : u32 = P.cfg.y + gid.x;

  var w : array<u32, 16>;
  var a : u32; var b : u32; var c : u32; var d : u32;
  var e : u32; var f : u32; var g : u32; var h : u32;
  var t1 : u32; var t2 : u32; var nw : u32;

  // ---------- 2o bloco do cabecalho, a partir do midstate ----------
  w[0] = P.w2.x; w[1] = P.w2.y; w[2] = P.w2.z;
  w[3] = bswap(nonce);            // no cabecalho o nonce e little-endian
  w[4] = 0x80000000u;
  for (var i = 5u; i < 15u; i = i + 1u) { w[i] = 0u; }
  w[15] = 640u;

  a = P.mid[0].x; b = P.mid[0].y; c = P.mid[0].z; d = P.mid[0].w;
  e = P.mid[1].x; f = P.mid[1].y; g = P.mid[1].z; h = P.mid[1].w;

  for (var i = 0u; i < 16u; i = i + 1u) {
    t1 = h + bS1(e) + ((e & f) ^ (~e & g)) + K[i] + w[i];
    t2 = bS0(a) + ((a & b) ^ (a & c) ^ (b & c));
    h = g; g = f; f = e; e = d + t1; d = c; c = b; b = a; a = t1 + t2;
  }
  for (var i = 16u; i < 64u; i = i + 1u) {
    nw = sS1(w[(i - 2u) & 15u]) + w[(i - 7u) & 15u] +
         sS0(w[(i - 15u) & 15u]) + w[i & 15u];
    w[i & 15u] = nw;
    t1 = h + bS1(e) + ((e & f) ^ (~e & g)) + K[i] + nw;
    t2 = bS0(a) + ((a & b) ^ (a & c) ^ (b & c));
    h = g; g = f; f = e; e = d + t1; d = c; c = b; b = a; a = t1 + t2;
  }

  w[0] = P.mid[0].x + a; w[1] = P.mid[0].y + b;
  w[2] = P.mid[0].z + c; w[3] = P.mid[0].w + d;
  w[4] = P.mid[1].x + e; w[5] = P.mid[1].y + f;
  w[6] = P.mid[1].z + g; w[7] = P.mid[1].w + h;

  // ---------- 2o SHA: entrada = hash anterior + enchimento ----------
  w[8] = 0x80000000u;
  for (var i = 9u; i < 15u; i = i + 1u) { w[i] = 0u; }
  w[15] = 256u;

  a = IV[0]; b = IV[1]; c = IV[2]; d = IV[3];
  e = IV[4]; f = IV[5]; g = IV[6]; h = IV[7];

  for (var i = 0u; i < 16u; i = i + 1u) {
    t1 = h + bS1(e) + ((e & f) ^ (~e & g)) + K[i] + w[i];
    t2 = bS0(a) + ((a & b) ^ (a & c) ^ (b & c));
    h = g; g = f; f = e; e = d + t1; d = c; c = b; b = a; a = t1 + t2;
  }
  // Ate a rodada 60: depois dela 'e' ja e a ultima palavra do estado final,
  // pois h apos 64 = g apos 63 = f apos 62 = e apos 61.
  for (var i = 16u; i < 61u; i = i + 1u) {
    nw = sS1(w[(i - 2u) & 15u]) + w[(i - 7u) & 15u] +
         sS0(w[(i - 15u) & 15u]) + w[i & 15u];
    w[i & 15u] = nw;
    t1 = h + bS1(e) + ((e & f) ^ (~e & g)) + K[i] + nw;
    t2 = bS0(a) + ((a & b) ^ (a & c) ^ (b & c));
    h = g; g = f; f = e; e = d + t1; d = c; c = b; b = a; a = t1 + t2;
  }

  let ult : u32 = bswap(IV[7] + e);
  if (ult <= P.cfg.x) {
    let i : u32 = atomicAdd(&achados[0], 1u);
    if (i < 31u) { atomicStore(&achados[i + 1u], nonce); }
  }
}

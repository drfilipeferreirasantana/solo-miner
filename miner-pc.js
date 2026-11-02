#!/usr/bin/env node
// Minerador solo de Bitcoin para PC: Node.js + WASM SIMD + Stratum direto por TCP.
// Nao precisa do proxy: Node abre soquete TCP nativamente.
//
// Uso:
//   node miner-pc.js
// Variaveis opcionais:
//   POOL_HOST (padrao solo.ckpool.org)  POOL_PORT (3333)
//   BTC_USER  (endereco.worker)         THREADS (padrao: nucleos - 1)
//   SUG_DIFF  (dificuldade sugerida, 0 = deixar o pool decidir)

'use strict';
const net = require('net');
const os = require('os');
const { Worker, isMainThread, parentPort, workerData } = require('worker_threads');

const WASM_B64 = [
  "AGFzbQEAAAABHgZgA39/fwF/YAABf2AAAGACf38AYAF/AGACf38BfwMKCQABAQEBAgMEBQQFAXABAQEFAwEAEAYIAX8BQeCMBAsHTggGbWVtb3",
  "J5AgAHaGRyX3B0cgABCHN0Z3RfcHRyAAIIbnRndF9wdHIAAwdvdXRfcHRyAAQHcHJlcGFyZQAFBmRpZ2VzdAAHBHNjYW4ACArzNwmGAQMDfwF7",
  "An8CQCACRQ0AAkACQCACQRBPDQAgACEDIAIhBAwBCyACQQ9xIQQgACACQXBxIgVqIQMgAf0PIQYgBSEHIAAhCANAIAggBv0LAAAgCEEQaiEIIA",
  "dBcGoiBw0ACyAFIAJGDQELA0AgAyABOgAAIANBAWohAyAEQX9qIgQNAAsLIAALCABBoIqAgAALCABB8IqAgAALCABBkIuAgAALCABBsIuAgAAL",
  "ngsBDH8jgICAgABBwABrIgAkgICAgAAgAEEAKAKgioCAACIBQRh0IAFBgP4DcUEIdHIgAUEIdkGA/gNxIAFBGHZycjYCACAAQQAoAqSKgIAAIg",
  "FBGHQgAUGA/gNxQQh0ciABQQh2QYD+A3EgAUEYdnJyNgIEIABBACgCqIqAgAAiAUEYdCABQYD+A3FBCHRyIAFBCHZBgP4DcSABQRh2cnI2Aggg",
  "AEEAKAKsioCAACIBQRh0IAFBgP4DcUEIdHIgAUEIdkGA/gNxIAFBGHZycjYCDCAAQQAoArCKgIAAIgFBGHQgAUGA/gNxQQh0ciABQQh2QYD+A3",
  "EgAUEYdnJyNgIQIABBACgCtIqAgAAiAUEYdCABQYD+A3FBCHRyIAFBCHZBgP4DcSABQRh2cnI2AhQgAEEAKAK4ioCAACIBQRh0IAFBgP4DcUEI",
  "dHIgAUEIdkGA/gNxIAFBGHZycjYCGCAAQQAoAryKgIAAIgFBGHQgAUGA/gNxQQh0ciABQQh2QYD+A3EgAUEYdnJyNgIcQQAoAsCKgIAAIQFBAE",
  "EA/QAEkIiAgAD9CwTgi4CAAEEAQQD9AASAiICAAP0LBNCLgIAAIAAgAUEYdCABQYD+A3FBCHRyIAFBCHZBgP4DcSABQRh2cnI2AiAgAEEAKALE",
  "ioCAACIBQRh0IAFBgP4DcUEIdHIgAUEIdkGA/gNxIAFBGHZycjYCJCAAQQAoAsiKgIAAIgFBGHQgAUGA/gNxQQh0ciABQQh2QYD+A3EgAUEYdn",
  "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",
  "d7AX8Bew5/I4CAgIAAQYAEayICJICAgIAAQQAhAwJAIAFFDQBBACgC8IqAgAAiBP0RIQVBAP0ABOCLgIAAIgYgCP0NDA0ODwwNDg8MDQ4PDA0O",
  "DyEHIAYgCP0NCAkKCwgJCgsICQoLCAkKCyEJIAYgCP0NBAUGBwQFBgcEBQYHBAUGByEKIAYgCP0NAAECAwABAgMAAQIDAAECAyELQQD9AALci4",
  "CAACIIIAj9DQABAgMAAQIDAAECAwABAgMhDEEA/QAD2IuAgAAiDSAI/Q0AAQIDAAECAwABAgMAAQIDIQ5BAP0AAtSLgIAAIg8gCP0NAAECAwAB",
  "AgMAAQIDAAECAyEQIAJBMGohESACQZABaiESIAJB0ABqIRNBACgCjIuAgAAhFEEAKAKIi4CAACEVQQAoAoSLgIAAIRZBACgCgIuAgAAhF0EAKA",
  "L8ioCAACEYQQAoAviKgIAAIRlBACgC9IqAgAAhGiACQYACakEkaiEbIAJBlAJqIRxBAP0JAtCMgIAAIR1BAP0JAsiMgIAAIR5BAP0JAsCMgIAA",
  "IR9BAP0JArCMgIAAISBBAP0JAqCMgIAAISFBAP0JApiMgIAAISJBAP0JApCMgIAAISNBAP0JAoCMgIAAISQgBv0bAyElIAb9GwIhJiAG/RsBIS",
  "cgBv0bACEoIAj9GwAhKSAN/RsAISogD/0bACErQQAoAtCLgIAAIiz9ESEtQQAoAviLgIAAIi79ESEvQQAoAvSLgIAAIjD9ESExQQAoAvCLgIAA",
  "IjL9ESEzQQAhNANAIAL9DAAAAIAAAACAAAAAgAAAAIAiNf0LBEAgAiAv/QsEICACIDH9CwQQIAIgM/0LBAAgAiA0IABqIjZBGHQgNkGA/gNxQQ",
  "h0ciA2QQh2QYD+A3EgNkEYdnJy/REgNkEBaiIDQRh0IANBgP4DcUEIdHIgA0EIdkGA/gNxIANBGHZycv0cASA2QQJqIgNBGHQgA0GA/gNxQQh0",
  "ciADQQh2QYD+A3EgA0EYdnJy/RwCIDZBA2oiA0EYdCADQYD+A3FBCHRyIANBCHZBgP4DcSADQRh2cnL9HAP9CwQwIBNBAEGgARCAgICAABogAv",
  "0MgAIAAIACAACAAgAAgAIAAP0LBPABQQwhAyARITcgJCE4ICMhCCAiIQ8gISE5ICAhOiAfIQ0gHiE7IB0hPANAIDshPSAPIT4gCCEPIDgiCEEe",
  "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",
  "NgK0i4CAAEEAIEY2ArCLgIAACyA0QQRqIjQgAUkNAAtBACEDCyACQYAEaiSAgICAACADCwuoAgEAQYAIC6ACZ+YJaoWuZ7ty8248OvVPpX9SDl",
  "GMaAWbq9mDHxnN4FuYL4pCkUQ3cc/7wLWl27XpW8JWOfER8Vmkgj+S1V4cq5iqB9gBW4MSvoUxJMN9DFV0Xb5y/rHegKcG3Jt08ZvBwWmb5IZH",
  "vu/GncEPzKEMJG8s6S2qhHRK3KmwXNqI+XZSUT6YbcYxqMgnA7DHf1m/8wvgxkeRp9VRY8oGZykpFIUKtyc4IRsu/G0sTRMNOFNUcwpluwpqdi",
  "7JwoGFLHKSoei/oktmGqhwi0vCo1FsxxnoktEkBpnWhTUO9HCgahAWwaQZCGw3Hkx3SCe1vLA0swwcOUqq2E5Pypxb828uaO6Cj3RvY6V4FHjI",
  "hAgCx4z6/76Q62xQpPej+b7yeHHGAIQBBG5hbWUACglub3ZvLndhc20BUQkABm1lbXNldAEHaGRyX3B0cgIIc3RndF9wdHIDCG50Z3RfcHRyBA",
  "dvdXRfcHRyBQdwcmVwYXJlBgljb21wcmltaXIHBmRpZ2VzdAgEc2NhbgcSAQAPX19zdGFja19wb2ludGVyCQoBAAcucm9kYXRhADgJcHJvZHVj",
  "ZXJzAQxwcm9jZXNzZWQtYnkBDFVidW50dSBjbGFuZxExOC4xLjMgKDF1YnVudHUxKQA1D3RhcmdldF9mZWF0dXJlcwMrD211dGFibGUtZ2xvYm",
  "FscysIc2lnbi1leHQrB3NpbWQxMjg=",
].join("");

// ==================== NUCLEO (roda em cada thread) ====================
function iniciarWorker(){
  const bin = Buffer.from(WASM_B64, 'base64');
  const inst = new WebAssembly.Instance(new WebAssembly.Module(bin), {});
  const ex = inst.exports;
  const hdrPtr = ex.hdr_ptr(), stgtPtr = ex.stgt_ptr(), ntgtPtr = ex.ntgt_ptr(), outPtr = ex.out_ptr();
  const out = new Uint32Array(ex.memory.buffer, outPtr, 8);

  let rodando = false, cursor = 0, hashes = 0, fatia = 400000, ultimoAviso = Date.now();

  parentPort.on('message', (m) => {
    if(m.type === 'job'){
      new Uint8Array(ex.memory.buffer).set(m.headerPrefix, hdrPtr);
      ex.prepare();
      new Uint32Array(ex.memory.buffer, stgtPtr, 8).set(m.shareTarget);
      new Uint32Array(ex.memory.buffer, ntgtPtr, 8).set(m.networkTarget);
      cursor = m.nonceStart >>> 0;
      hashes = 0; ultimoAviso = Date.now();
      if(!rodando){ rodando = true; setImmediate(laco); }
    } else if(m.type === 'setShareTarget'){
      new Uint32Array(ex.memory.buffer, stgtPtr, 8).set(m.shareTarget);
    } else if(m.type === 'stop'){
      rodando = false;
    }
  });

  function laco(){
    if(!rodando) return;
    const t0 = Date.now();
    if(ex.scan(cursor >>> 0, fatia)){
      const nonce = out[0] >>> 0;
      parentPort.postMessage({type:'found', nonce, isBlock: out[1] === 1});
      hashes += ((nonce - cursor) >>> 0) + 1;
      cursor = (nonce + 1) >>> 0;
    } else {
      hashes += fatia;
      cursor = (cursor + fatia) >>> 0;
    }
    const dt = Date.now() - t0;
    if(dt > 0) fatia = Math.max(100000, Math.min(20000000, Math.round(fatia * (200/dt)))) & ~3;
    const agora = Date.now();
    if(agora - ultimoAviso >= 1000){
      parentPort.postMessage({type:'progress', hashes});
      hashes = 0; ultimoAviso = agora;
    }
    setImmediate(laco);
  }
  parentPort.postMessage({type:'pronto'});
}

if(!isMainThread){ iniciarWorker(); return; }

// ==================== PRINCIPAL ====================
const POOL_HOST = process.env.POOL_HOST || 'solo.ckpool.org';
const POOL_PORT = parseInt(process.env.POOL_PORT || '3333', 10);
const BTC_USER  = process.env.BTC_USER  || '';
const THREADS   = parseInt(process.env.THREADS || String(Math.max(1, os.cpus().length - 1)), 10);
const SUG_DIFF  = parseFloat(process.env.SUG_DIFF || '0.05');

if(!BTC_USER){
  console.error('Defina BTC_USER com seu endereco Bitcoin. Exemplo:');
  console.error('  set BTC_USER=bc1qseuendereco.pc');
  process.exit(1);
}

// ---- utilidades de bytes ----
const hx = (h) => Buffer.from(h, 'hex');
function swap32(hex){
  const b = hx(hex), o = Buffer.alloc(b.length);
  for(let i=0;i<b.length;i+=4){ o[i]=b[i+3]; o[i+1]=b[i+2]; o[i+2]=b[i+1]; o[i+3]=b[i]; }
  return o.toString('hex');
}
const crypto = require('crypto');
const sha256d = (b) => crypto.createHash('sha256').update(crypto.createHash('sha256').update(b).digest()).digest();

function bitsParaAlvo(bitsHex){
  const b = hx(bitsHex), exp = b[0];
  const t = Buffer.alloc(32), ini = 32 - exp;
  for(let i=0;i<3;i++){ const p = ini + i; if(p>=0 && p<32) t[p] = b[1+i]; }
  const w = new Uint32Array(8);
  for(let i=0;i<8;i++) w[i] = t.readUInt32BE(i*4);
  return w;
}
function dificuldadeParaAlvo(diff){
  const diff1 = 0xFFFFn << 208n;
  let x = (diff1 * 1000000n) / BigInt(Math.max(1, Math.round(diff * 1e6)));
  const lim = (1n << 256n) - 1n;
  if(x > lim) x = lim;
  const w = new Uint32Array(8);
  for(let i=7;i>=0;i--){ w[i] = Number(x & 0xffffffffn) >>> 0; x >>= 32n; }
  return w;
}

// ---- guarda: a montagem do cabecalho tem que reproduzir o bloco genesis ----
(function guardaGenesis(){
  const alvo = '000000000019d6689c085ae165831e934ff763ae46a2a6c172b3f1b60a8ce26f';
  const merkle = hx('4a5e1e4baab89f3a32518a88c31bc87f618f76673e2cc77ab2127b7afdeda33b').reverse();
  const hex = swap32('00000001') + swap32('0'.repeat(64)) + merkle.toString('hex') +
              swap32('495fab29') + swap32('1d00ffff');
  const h = Buffer.alloc(80); hx(hex).copy(h, 0); h.writeUInt32LE(2083236893, 76);
  if(Buffer.from(sha256d(h)).reverse().toString('hex') !== alvo){
    console.error('FALHA: a montagem do cabecalho nao reproduz o bloco genesis. Abortando.');
    process.exit(1);
  }
})();

// ---- estado ----
let extranonce1 = null, extranonce2Size = 4;
let jobAtual = null, msgId = 1, poolDiff = 1;
let aceitos = 0, rejeitados = 0, hashAcum = 0, ultimaTaxa = Date.now(), taxaEma = 0;
let subscribeId = -1, authorizeId = -1, suggestId = -1;
const pendentes = {};
const workers = [];

function log(...a){ console.log('[' + new Date().toLocaleTimeString('pt-BR') + ']', ...a); }
function fmt(h){
  if(h >= 1e9) return (h/1e9).toFixed(2)+' GH/s';
  if(h >= 1e6) return (h/1e6).toFixed(2)+' MH/s';
  if(h >= 1e3) return (h/1e3).toFixed(2)+' kH/s';
  return h.toFixed(0)+' H/s';
}

// ---- conexao Stratum (TCP direto, sem proxy) ----
const sock = net.connect(POOL_PORT, POOL_HOST, () => {
  log('Conectado a ' + POOL_HOST + ':' + POOL_PORT);
  subscribeId = msgId++;
  enviar({id: subscribeId, method:'mining.subscribe', params:['miner-pc/1.0']});
});
sock.setEncoding('utf8');
sock.on('error', (e) => { log('Erro de conexao:', e.message); process.exit(1); });
sock.on('close', () => { log('Conexao encerrada pelo pool.'); process.exit(1); });

function enviar(o){ sock.write(JSON.stringify(o) + '\n'); }

let buf = '';
sock.on('data', (d) => {
  buf += d;
  let i;
  while((i = buf.indexOf('\n')) >= 0){
    const linha = buf.slice(0, i); buf = buf.slice(i+1);
    if(linha.trim()) tratar(JSON.parse(linha));
  }
});

function tratar(m){
  if(m.id === subscribeId && m.result){
    extranonce1 = m.result[1];
    extranonce2Size = m.result[2];
    log('Inscrito. extranonce1=' + extranonce1 + ' size=' + extranonce2Size);
    authorizeId = msgId++;
    enviar({id: authorizeId, method:'mining.authorize', params:[BTC_USER, 'x']});
  } else if(m.id === authorizeId){
    log(m.result === true ? 'Autorizado pelo pool.' : 'Pool NAO autorizou: ' + JSON.stringify(m.error));
    if(SUG_DIFF > 0){
      suggestId = msgId++;
      enviar({id: suggestId, method:'mining.suggest_difficulty', params:[SUG_DIFF]});
      log('Sugerindo dificuldade ' + SUG_DIFF);
    }
  } else if(m.id === suggestId){
    if(m.error) log('Pool recusou a sugestao de dificuldade (usa a dele).');
  } else if(m.method === 'mining.notify'){
    jobAtual = { jobId:m.params[0], prevhash:m.params[1], coinb1:m.params[2], coinb2:m.params[3],
                 branch:m.params[4], version:m.params[5], nbits:m.params[6], ntime:m.params[7] };
    distribuirJob();
  } else if(m.method === 'mining.set_difficulty'){
    poolDiff = m.params[0];
    log('Dificuldade do pool: ' + poolDiff);
    const st = dificuldadeParaAlvo(poolDiff);
    workers.forEach(w => w.postMessage({type:'setShareTarget', shareTarget: st}));
  } else if(pendentes[m.id] !== undefined){
    const p = pendentes[m.id]; delete pendentes[m.id];
    if(m.result === true){
      aceitos++;
      if(p.isBlock) log('*** BLOCO ENCONTRADO! Hash abaixo do alvo REAL da rede. ***');
      else log('Share aceito (' + aceitos + ')');
    } else {
      rejeitados++;
      log('Share REJEITADO: ' + JSON.stringify(m.error || m.result));
    }
  }
}

function montarPrefixo(job, en2){
  const coinbase = Buffer.concat([hx(job.coinb1), hx(extranonce1), hx(en2), hx(job.coinb2)]);
  let merkle = sha256d(coinbase);
  for(const b of job.branch) merkle = sha256d(Buffer.concat([merkle, hx(b)]));
  // merkle NAO leva swap (conferido contra o bloco genesis acima)
  const hex = swap32(job.version) + swap32(job.prevhash) + merkle.toString('hex') +
              swap32(job.ntime) + swap32(job.nbits);
  return new Uint8Array(hx(hex));
}

function distribuirJob(){
  if(!jobAtual || !workers.length) return;
  const st = dificuldadeParaAlvo(poolDiff);
  const nt = bitsParaAlvo(jobAtual.nbits);
  workers.forEach((w, i) => {
    const en2 = i.toString(16).padStart(extranonce2Size*2, '0');
    w._en2 = en2;
    w.postMessage({ type:'job', headerPrefix: montarPrefixo(jobAtual, en2),
                    shareTarget: st, networkTarget: nt,
                    nonceStart: Math.floor(4294967295 / workers.length) * i });
  });
}

function submeter(idx, nonce, isBlock){
  if(!jobAtual) return;
  const id = msgId++;
  pendentes[id] = { isBlock: !!isBlock };
  enviar({ id, method:'mining.submit',
           params:[BTC_USER, jobAtual.jobId, workers[idx]._en2, jobAtual.ntime,
                   (nonce >>> 0).toString(16).padStart(8,'0')] });
}

// ---- sobe as threads ----
log('Iniciando ' + THREADS + ' threads (WASM SIMD) - usuario ' + BTC_USER);
for(let i=0;i<THREADS;i++){
  const w = new Worker(__filename);
  w.on('message', (m) => {
    if(m.type === 'progress') hashAcum += m.hashes;
    else if(m.type === 'found') submeter(i, m.nonce, m.isBlock);
    else if(m.type === 'pronto' && jobAtual) distribuirJob();
  });
  w.on('error', (e) => log('Erro na thread ' + i + ':', e.message));
  workers.push(w);
}

setInterval(() => {
  const agora = Date.now(), dt = (agora - ultimaTaxa)/1000;
  if(dt >= 1){
    const inst = hashAcum / dt;
    taxaEma = taxaEma > 0 ? taxaEma*0.6 + inst*0.4 : inst;
    hashAcum = 0; ultimaTaxa = agora;
    process.stdout.write('\r  ' + fmt(taxaEma) + '  |  aceitos: ' + aceitos +
                         '  rejeitados: ' + rejeitados + '  |  dif. pool: ' + poolDiff + '     ');
  }
}, 2000);

process.on('SIGINT', () => { console.log('\nEncerrando...'); workers.forEach(w=>w.terminate()); process.exit(0); });

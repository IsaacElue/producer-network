// Runtime polyfills for Expo Go's Hermes engine. Must load before anything
// that touches Supabase auth — see index.js, which imports this first.
//
// Why: supabase-js derives its PKCE `code_challenge` with
//   crypto.getRandomValues(...)            // the verifier
//   crypto.subtle.digest('SHA-256', ...)   // the s256 challenge
//   btoa(...)                              // base64url of the digest
// Hermes ships none of crypto.subtle/btoa, so supabase-js logs "WebCrypto API
// is not supported" and silently downgrades to code_challenge_method=plain
// (the verifier sent in the clear). Backing crypto with expo-crypto restores
// real s256; the base64 shims cover btoa/atob if the runtime lacks them.

import * as ExpoCrypto from 'expo-crypto';

const g = globalThis as any;

// ── WebCrypto (getRandomValues + subtle.digest) ──────────────────────
const cryptoObj = g.crypto ?? (g.crypto = {});

if (typeof cryptoObj.getRandomValues !== 'function') {
  cryptoObj.getRandomValues = (array: ArrayBufferView | null) => {
    if (array) ExpoCrypto.getRandomValues(array as Parameters<typeof ExpoCrypto.getRandomValues>[0]);
    return array;
  };
}

if (typeof cryptoObj.subtle === 'undefined') {
  cryptoObj.subtle = {
    // expo-crypto's CryptoDigestAlgorithm.SHA256 value is the literal string
    // 'SHA-256', so the WebCrypto algorithm name maps through unchanged, and
    // digest() already returns a Promise<ArrayBuffer> like subtle.digest.
    digest: (algorithm: AlgorithmIdentifier, data: BufferSource) => {
      const name = typeof algorithm === 'string' ? algorithm : algorithm.name;
      return ExpoCrypto.digest(
        name as ExpoCrypto.CryptoDigestAlgorithm,
        data as Parameters<typeof ExpoCrypto.digest>[1],
      );
    },
  };
}

// ── base64 (btoa/atob over binary strings) ───────────────────────────
const B64 = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789+/';

if (typeof g.btoa !== 'function') {
  g.btoa = (input: string): string => {
    let output = '';
    let i = 0;
    while (i < input.length) {
      const c1 = input.charCodeAt(i++);
      const c2 = input.charCodeAt(i++);
      const c3 = input.charCodeAt(i++);
      if (c1 > 0xff || c2 > 0xff || c3 > 0xff) {
        throw new Error("btoa: string contains characters outside of the Latin1 range");
      }
      const e1 = c1 >> 2;
      const e2 = ((c1 & 3) << 4) | (c2 >> 4);
      let e3 = ((c2 & 15) << 2) | (c3 >> 6);
      let e4 = c3 & 63;
      if (isNaN(c2)) e3 = e4 = 64;
      else if (isNaN(c3)) e4 = 64;
      output +=
        B64.charAt(e1) +
        B64.charAt(e2) +
        (e3 === 64 ? '=' : B64.charAt(e3)) +
        (e4 === 64 ? '=' : B64.charAt(e4));
    }
    return output;
  };
}

if (typeof g.atob !== 'function') {
  g.atob = (input: string): string => {
    const clean = input.replace(/[^A-Za-z0-9+/=]/g, '');
    let output = '';
    let i = 0;
    while (i < clean.length) {
      const e1 = B64.indexOf(clean.charAt(i++));
      const e2 = B64.indexOf(clean.charAt(i++));
      const e3 = B64.indexOf(clean.charAt(i++));
      const e4 = B64.indexOf(clean.charAt(i++));
      output += String.fromCharCode((e1 << 2) | (e2 >> 4));
      if (e3 !== 64 && e3 !== -1) output += String.fromCharCode(((e2 & 15) << 4) | (e3 >> 2));
      if (e4 !== 64 && e4 !== -1) output += String.fromCharCode(((e3 & 3) << 6) | e4);
    }
    return output;
  };
}

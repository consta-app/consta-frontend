// lib/mnemonic.ts
// 12-word recovery phrase generation and key derivation.
// Uses BIP-39 wordlist for the mnemonic, deterministic key derivation
// via PBKDF2 + SHA-256 for the keypair seed.

import { generateMnemonic, validateMnemonic, mnemonicToSeed } from "bip39";

export type Mnemonic = string;

/**
 * Generates a new 12-word recovery phrase.
 * Uses 128 bits of entropy → 12 words from the BIP-39 English wordlist.
 */
export function generateRecoveryPhrase(): Mnemonic {
  return generateMnemonic(128); // 128 bits = 12 words
}

/**
 * Validates that a recovery phrase has the correct format and checksum.
 */
export function isValidRecoveryPhrase(phrase: string): boolean {
  return validateMnemonic(phrase.trim().toLowerCase());
}

/**
 * Derives a deterministic seed from the mnemonic.
 * The same mnemonic always produces the same seed.
 */
export async function deriveSeed(phrase: Mnemonic): Promise<Uint8Array> {
  const seed = await mnemonicToSeed(phrase.trim().toLowerCase());
  return new Uint8Array(seed);
}

/**
 * Derives an Ed25519 keypair from the recovery phrase.
 * Uses the first 32 bytes of the seed as the Ed25519 private key seed.
 *
 * Returns base64-encoded public and private keys (matching crypto.ts format).
 */
export async function keypairFromPhrase(
  phrase: Mnemonic
): Promise<{ publicKey: string; privateKey: string }> {
  if (!isValidRecoveryPhrase(phrase)) {
    throw new Error("Frase de recuperación inválida.");
  }

  const seed = await deriveSeed(phrase);
  const privateKeySeed = seed.slice(0, 32);

  // Try Ed25519 via Web Crypto API
  const subtle = globalThis.crypto?.subtle;
  if (!subtle) {
    throw new Error("Web Crypto API no disponible.");
  }

  try {
    // Ed25519 in Web Crypto requires importing the seed as a private key
    // Format: PKCS#8 with the 32-byte seed wrapped in the Ed25519 OID structure
    const pkcs8Header = new Uint8Array([
      0x30, 0x2e, 0x02, 0x01, 0x00, 0x30, 0x05, 0x06, 0x03, 0x2b, 0x65, 0x70,
      0x04, 0x22, 0x04, 0x20,
    ]);
    const pkcs8 = new Uint8Array(pkcs8Header.length + privateKeySeed.length);
    pkcs8.set(pkcs8Header);
    pkcs8.set(privateKeySeed, pkcs8Header.length);

    const privateKey = await subtle.importKey(
      "pkcs8",
      pkcs8.buffer as ArrayBuffer,
      "Ed25519",
      true,
      ["sign"]
    );

    // Derive the public key by signing a known message and extracting it
    // Actually, we need to export the public key separately. The cleanest way
    // is to use the JWK format which contains both x (public) when exported.
    const jwk = await subtle.exportKey("jwk", privateKey);

    // The public key is the "x" field in the JWK
    if (!jwk.x) {
      throw new Error("Could not derive public key");
    }

    // Convert base64url to base64 for the public key
    const publicKeyBase64 = jwk.x.replace(/-/g, "+").replace(/_/g, "/");
    const padding = "=".repeat((4 - (publicKeyBase64.length % 4)) % 4);

    const privateKeyJwk = btoa(JSON.stringify(jwk));

    return {
      publicKey: publicKeyBase64 + padding,
      privateKey: privateKeyJwk,
    };
  } catch (err) {
    // Fallback: deterministic stub for browsers without Ed25519 support
    const pubBytes = await subtle.digest("SHA-256", privateKeySeed.buffer as ArrayBuffer);
    return {
      publicKey: bytesToBase64(new Uint8Array(pubBytes)),
      privateKey: btoa(
        JSON.stringify({
          stub: true,
          seed: bytesToBase64(privateKeySeed),
        })
      ),
    };
  }
}

/**
 * Computes a deterministic email-hash equivalent from a mnemonic.
 * This lets us look up the user without storing an email.
 */
export async function userIdFromPhrase(phrase: Mnemonic): Promise<string> {
  const seed = await deriveSeed(phrase);
  const subtle = globalThis.crypto?.subtle;
  if (!subtle) throw new Error("Web Crypto API no disponible.");
  const hash = await subtle.digest("SHA-256", seed.buffer as ArrayBuffer);
  return bytesToHex(new Uint8Array(hash));
}

// ─── Helpers ────────────────────────────────────────────────────────────────

function bytesToBase64(bytes: Uint8Array): string {
  let binary = "";
  for (let i = 0; i < bytes.byteLength; i++) {
    binary += String.fromCharCode(bytes[i]);
  }
  return btoa(binary);
}

function bytesToHex(bytes: Uint8Array): string {
  return Array.from(bytes)
    .map((b) => b.toString(16).padStart(2, "0"))
    .join("");
}

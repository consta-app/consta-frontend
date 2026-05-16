// STUB de la Persona 2 — implementación pragmática con Web Crypto API.
// La Persona 1 va a entregar el módulo definitivo; cuando llegue, reemplazar
// este archivo entero. Los nombres y firmas deben mantenerse iguales para que
// los componentes no necesiten cambios.

// Las llaves se exponen como base64 serializable (no como CryptoKey) para que
// se puedan guardar directamente en localStorage tal como muestra CLAUDE.md.
export type PublicKey = string;
export type PrivateKey = string;

function bytesToHex(bytes: Uint8Array): string {
  return Array.from(bytes)
    .map((b) => b.toString(16).padStart(2, "0"))
    .join("");
}

function bytesToBase64(bytes: Uint8Array): string {
  let binary = "";
  for (let i = 0; i < bytes.byteLength; i++) {
    binary += String.fromCharCode(bytes[i]);
  }
  return btoa(binary);
}

function base64ToBytes(b64: string): Uint8Array {
  const binary = atob(b64);
  const bytes = new Uint8Array(binary.length);
  for (let i = 0; i < binary.length; i++) bytes[i] = binary.charCodeAt(i);
  return bytes;
}

function getSubtle(): SubtleCrypto {
  if (typeof globalThis === "undefined" || !globalThis.crypto?.subtle) {
    throw new Error("Web Crypto API no disponible en este entorno.");
  }
  return globalThis.crypto.subtle;
}

export async function sha256(text: string): Promise<string> {
  const data = new TextEncoder().encode(text);
  const digest = await getSubtle().digest("SHA-256", data);
  return bytesToHex(new Uint8Array(digest));
}

export async function generateKeyPair(): Promise<{
  publicKey: PublicKey;
  privateKey: PrivateKey;
}> {
  const subtle = getSubtle();
  // Ed25519 está soportado en Chrome 113+, Safari 17+, Firefox 130+.
  // Si falla, el stub usa un fallback para que la demo no se rompa.
  try {
    const kp = (await subtle.generateKey("Ed25519", true, [
      "sign",
      "verify",
    ])) as CryptoKeyPair;
    const pubRaw = await subtle.exportKey("raw", kp.publicKey);
    const privJwk = await subtle.exportKey("jwk", kp.privateKey);
    return {
      publicKey: bytesToBase64(new Uint8Array(pubRaw)),
      privateKey: btoa(JSON.stringify(privJwk)),
    };
  } catch {
    // Fallback determinístico pero claramente marcado como stub.
    const pub = new Uint8Array(32);
    const priv = new Uint8Array(32);
    crypto.getRandomValues(pub);
    crypto.getRandomValues(priv);
    return {
      publicKey: bytesToBase64(pub),
      privateKey: btoa(
        JSON.stringify({ stub: true, seed: bytesToBase64(priv) }),
      ),
    };
  }
}

export async function exportPublicKey(publicKey: PublicKey): Promise<string> {
  // Las llaves ya viajan en base64; esta función existe solo para mantener el
  // contrato del CLAUDE.md y dejar espacio a transformaciones futuras.
  return publicKey;
}

export async function signContent(
  privateKey: PrivateKey,
  contentHash: string,
): Promise<string> {
  const subtle = getSubtle();
  const message = new TextEncoder().encode(contentHash);
  try {
    const jwk = JSON.parse(atob(privateKey));
    if (jwk?.stub) {
      // Firma simulada — solo hash + seed. Persona 1 lo reemplaza con Ed25519 real.
      const concat = await subtle.digest(
        "SHA-256",
        new TextEncoder().encode(contentHash + jwk.seed),
      );
      return bytesToBase64(new Uint8Array(concat));
    }
    const key = await subtle.importKey("jwk", jwk, "Ed25519", false, ["sign"]);
    const sig = await subtle.sign("Ed25519", key, message);
    return bytesToBase64(new Uint8Array(sig));
  } catch (err) {
    throw new Error(
      `No se pudo firmar el contenido: ${(err as Error).message}`,
    );
  }
}

// Helpers expuestos por si la UI necesita decodificar firmas o hashes.
export const __internal = { bytesToHex, bytesToBase64, base64ToBytes };

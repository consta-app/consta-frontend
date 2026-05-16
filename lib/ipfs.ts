// STUB de la Persona 2 — IPFS simulado contra localStorage para que la demo
// funcione sin Pinata. La Persona 1 entrega el módulo real; reemplazar este
// archivo manteniendo las firmas.

const STORE_PREFIX = "ipfs-mock:";

function isBrowser() {
  return typeof window !== "undefined" && typeof localStorage !== "undefined";
}

function fakeCid(seed: string): string {
  // CIDv0 falso pero verosímil: "Qm" + 44 caracteres base58-like derivados
  // determinísticamente del contenido para que el mismo texto produzca el
  // mismo CID (útil para que verify y new sean coherentes).
  const alphabet =
    "123456789ABCDEFGHJKLMNPQRSTUVWXYZabcdefghijkmnopqrstuvwxyz";
  let hash = 0;
  for (let i = 0; i < seed.length; i++) {
    hash = (hash * 31 + seed.charCodeAt(i)) >>> 0;
  }
  let out = "Qm";
  for (let i = 0; i < 44; i++) {
    hash = (hash * 1103515245 + 12345 + i) >>> 0;
    out += alphabet[hash % alphabet.length];
  }
  return out;
}

export async function uploadToIPFS(text: string): Promise<string> {
  const cid = fakeCid(text);
  if (isBrowser()) {
    localStorage.setItem(STORE_PREFIX + cid, text);
  }
  // Pequeño delay para que la UI muestre el estado "subiendo".
  await new Promise((r) => setTimeout(r, 300));
  return cid;
}

export async function fetchFromIPFS(cid: string): Promise<string> {
  if (isBrowser()) {
    const text = localStorage.getItem(STORE_PREFIX + cid);
    if (text != null) return text;
  }
  // En SSR o cuando el CID no está en localStorage devolvemos un placeholder
  // visible para que el equipo sepa que el contenido falta y no se rompa la UI.
  await new Promise((r) => setTimeout(r, 200));
  return `[contenido IPFS no disponible en este dispositivo · CID ${cid}]`;
}

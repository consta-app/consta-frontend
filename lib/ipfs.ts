const USE_MOCKS =
  (process.env.NEXT_PUBLIC_USE_MOCKS ?? "true").toLowerCase() !== "false";
const PINATA_GATEWAY =
  process.env.NEXT_PUBLIC_PINATA_GATEWAY ?? "https://gateway.pinata.cloud";

const STORE_PREFIX = "ipfs-mock:";

function isBrowser() {
  return typeof window !== "undefined" && typeof localStorage !== "undefined";
}

function fakeCid(seed: string): string {
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
  if (USE_MOCKS) {
    const cid = fakeCid(text);
    if (isBrowser()) localStorage.setItem(STORE_PREFIX + cid, text);
    await new Promise((r) => setTimeout(r, 300));
    return cid;
  }

  const res = await fetch("/api/upload", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ text }),
  });
  if (!res.ok) {
    const msg = await res.text();
    throw new Error(`Error al subir a IPFS: ${msg}`);
  }
  const { cid } = await res.json();
  return cid as string;
}

export async function fetchFromIPFS(cid: string): Promise<string> {
  if (USE_MOCKS) {
    if (isBrowser()) {
      const text = localStorage.getItem(STORE_PREFIX + cid);
      if (text != null) return text;
    }
    await new Promise((r) => setTimeout(r, 200));
    return `[contenido IPFS no disponible en este dispositivo · CID ${cid}]`;
  }

  const res = await fetch(`${PINATA_GATEWAY}/ipfs/${cid}`);
  if (!res.ok) {
    throw new Error(`Contenido IPFS no disponible: ${cid}`);
  }
  return res.text();
}

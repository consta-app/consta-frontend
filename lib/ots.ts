// Verificación en vivo de pruebas OpenTimestamps en el navegador.
// Sin dependencia del backend: descarga la última prueba desde los calendarios
// y la verifica contra Bitcoin directamente en el cliente.

import OpenTimestamps from "javascript-opentimestamps";

export type OTSResult =
  | { status: "confirmed"; blockHeight: number }
  | { status: "pending" }
  | { status: "error"; message: string };

function base64ToBytes(b64: string): Uint8Array {
  const binary = atob(b64);
  const bytes = new Uint8Array(binary.length);
  for (let i = 0; i < binary.length; i++) bytes[i] = binary.charCodeAt(i);
  return bytes;
}

function hexToBytes(hex: string): Uint8Array {
  const bytes = new Uint8Array(hex.length / 2);
  for (let i = 0; i < bytes.length; i++) {
    bytes[i] = parseInt(hex.substr(i * 2, 2), 16);
  }
  return bytes;
}

// Verifica una prueba OTS contra Bitcoin sin pasar por nuestro backend.
// 1. Deserializa la prueba almacenada
// 2. La actualiza desde los calendarios (alice, bob, finney, ...)
// 3. Pregunta a la librería si ya está anclada en Bitcoin
export async function verifyOTSLive(
  otsBase64: string,
  contentHashHex: string,
): Promise<OTSResult> {
  try {
    const otsBytes = base64ToBytes(otsBase64);
    const detached = OpenTimestamps.DetachedTimestampFile.deserialize(otsBytes);

    try {
      await OpenTimestamps.upgrade(detached);
    } catch {
      // upgrade puede fallar si todos los calendarios están caídos; seguimos
      // intentando verify por si la prueba que tenemos ya estaba completa
    }

    const hashBytes = hexToBytes(contentHashHex);
    const result = await OpenTimestamps.verify(
      detached,
      new OpenTimestamps.Ops.OpSHA256(),
      hashBytes,
    );

    // result es algo como { bitcoin: { height, timestamp } } o {} si está pendiente
    if (result && typeof result === "object" && Object.keys(result).length > 0) {
      const first = Object.values(result)[0] as { height?: number } | number;
      const blockHeight =
        typeof first === "number"
          ? first
          : typeof first?.height === "number"
            ? first.height
            : 0;
      return { status: "confirmed", blockHeight };
    }

    return { status: "pending" };
  } catch (err) {
    return {
      status: "error",
      message: (err as Error).message ?? "Error verificando OTS",
    };
  }
}

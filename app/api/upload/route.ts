import { NextRequest, NextResponse } from "next/server";

export async function POST(req: NextRequest) {
  const { text } = await req.json();
  if (!text || typeof text !== "string") {
    return NextResponse.json({ error: "text requerido" }, { status: 400 });
  }

  const jwt = process.env.PINATA_JWT;
  if (!jwt) {
    return NextResponse.json(
      { error: "Pinata no configurado en el servidor" },
      { status: 500 },
    );
  }

  const formData = new FormData();
  const blob = new Blob([text], { type: "text/plain" });
  formData.append("file", blob, "declaration.txt");
  formData.append(
    "pinataMetadata",
    JSON.stringify({ name: "consta-declaration" }),
  );

  const res = await fetch("https://api.pinata.cloud/pinning/pinFileToIPFS", {
    method: "POST",
    headers: {
      Authorization: `Bearer ${jwt}`,
    },
    body: formData,
  });

  if (!res.ok) {
    return NextResponse.json(
      { error: "Error al subir a Pinata" },
      { status: 502 },
    );
  }

  const data = await res.json();
  return NextResponse.json({ cid: data.IpfsHash });
}

# Consta — Frontend

## Qué es este proyecto

Consta es un registro público donde periodistas, abogados, científicos y activistas
en Latinoamérica pueden crear una declaración firmada criptográficamente que establece
que no tienen intención de hacerse daño. Si algo les pasa, sus propias palabras quedan
como evidencia pública, fechada e inmutable.

Construido en 72h para hack@latam — track DEF/ACC. Open source, deployado.

**Este repo es el frontend.** El backend vive en `consta-backend`.

---

## Stack

- Next.js 15+ (App Router)
- Tailwind CSS
- `lib/crypto.ts` — firma Ed25519 y hash SHA-256 via Web Crypto API
- `lib/ipfs.ts` — subir y leer desde IPFS via Pinata
- `lib/mnemonic.ts` — generación de frase BIP-39 y derivación de keypair
- `lib/api.ts` — todas las llamadas al backend (con capa mock para desarrollo)
- `lib/didit.ts` — cliente para sesiones de verificación KYC de Didit
- `components/verification/` — componentes de captura de pasaporte y calidad de imagen

## Estructura del proyecto

```
app/
  page.tsx                        # landing page
  register/page.tsx               # flujo de registro (4 pasos, frase BIP-39)
  login/page.tsx                  # login con frase de 12 palabras
  declaration/
    new/page.tsx                  # crear declaración
    [id]/verify/page.tsx          # verificar declaración pública (ruta pública)
  profile/[id]/page.tsx           # perfil público del usuario
  checkin/page.tsx                # confirmar señal de vida
  contacts/page.tsx               # gestionar contactos de alerta
  verify-identity/page.tsx        # verificación de identidad (Didit KYC)
components/
  site-header.tsx                 # header con nav completa + login/logout
  site-footer.tsx
  ui.tsx                          # componentes base (Button, Card, Field, etc.)
  verification/
    responsive-preview.tsx        # preview de cámara responsivo (3:2, 640-800px)
    quality-feedback.tsx          # mensajes de calidad en tiempo real
    handoff-ui.tsx                # QR code para handoff a móvil
    fallback-upload.tsx           # subida de imagen como alternativa a cámara
    step-indicator.tsx            # indicador de pasos del flujo
lib/
  api.ts                          # cliente del backend + capa mock completa
  crypto.ts                       # sha256, generateKeyPair, signContent
  ipfs.ts                         # uploadToIPFS, fetchFromIPFS
  mnemonic.ts                     # generateRecoveryPhrase, keypairFromPhrase, userIdFromPhrase
  didit.ts                        # createDiditSession, getDiditSessionStatus
  verification/
    types.ts                      # tipos compartidos de verificación
    blur-detector.ts              # detección de desenfoque (varianza Laplaciana)
    glare-detector.ts             # detección de reflejo (luminancia > 240)
    lighting-detector.ts          # detección de poca luz (luminancia media < 80)
    framing-detector.ts           # detección de encuadre (cobertura de bordes Canny)
    quality-analyzer.ts           # orquestador de todos los detectores
    token-manager.ts              # tokens de handoff (TTL 5 min, base64url)
    handoff-session.ts            # sesión WebSocket para handoff a móvil
    file-validator.ts             # validación de archivos subidos (JPEG/PNG, ≤10MB)
docs/
  BACKEND_CLAUDE.md               # spec completa para el backend
  BACKEND_BOOTSTRAP_PROMPT.md    # guía de implementación RFC 3161 + OpenTimestamps
  HANDOFF_RELAY_SPEC.md           # spec del relay WebSocket para handoff móvil
```

## Cómo correr en desarrollo

```bash
npm install
cp .env.example .env.local
# llenar variables (ver abajo)
npm run dev
```

Para probar la integración con Didit también necesitas el proxy local:
```bash
node didit-backend.js   # corre en :3001, hace de proxy hacia Didit
```

## Variables de entorno

```bash
NEXT_PUBLIC_API_URL=http://localhost:3001   # URL del backend (o proxy Didit local)
NEXT_PUBLIC_USE_MOCKS=true                 # false cuando el backend real esté listo
PINATA_API_KEY=                            # para subir a IPFS
PINATA_SECRET_KEY=
```

Cuando `NEXT_PUBLIC_USE_MOCKS=true` (el default), `lib/api.ts` sirve todas las
respuestas desde localStorage. No hace falta backend para que la demo funcione.

---

## Autenticación — frase de recuperación BIP-39

**No hay email ni contraseña.** La cuenta se identifica por una frase de 12 palabras
BIP-39. El flujo es:

1. Al registrarse: `generateRecoveryPhrase()` genera 12 palabras con 128 bits de entropía
2. `keypairFromPhrase(phrase)` deriva un keypair Ed25519 determinístico
3. `userIdFromPhrase(phrase)` deriva el `email_hash` (SHA-256 del seed) — identificador opaco
4. El backend recibe `{ email_hash, public_key, ... }` — nunca ve la frase
5. Al hacer login: el usuario ingresa las 12 palabras → se deriva el mismo keypair → se firma un challenge

**Almacenamiento en localStorage:**
```
consta:session_token   → JWT del backend
consta:user_id         → UUID del usuario
consta:private_key     → clave privada Ed25519 (JWK base64)
consta:public_key      → clave pública Ed25519 (base64)
consta:seed_hash       → SHA-256 del seed (= email_hash)
```

La clave privada nunca sale del navegador. Si el usuario borra localStorage,
puede recuperar el acceso ingresando su frase de 12 palabras de nuevo.

### Auth flow con el backend real (challenge/verify)

Cuando `NEXT_PUBLIC_USE_MOCKS=false`, el login usa el flujo seguro:

1. `POST /auth/challenge` con `{ email_hash }` → recibe nonce
2. El cliente firma el nonce con la clave privada
3. `POST /auth/verify` con `{ email_hash, challenge, signature }` → recibe JWT

El mock actual usa `POST /auth/login` directamente (sin challenge). Cuando el
backend esté listo, actualizar `lib/api.ts` para usar el flujo challenge/verify.

---

## Verificación de identidad — Didit KYC

La verificación biométrica usa [Didit](https://didit.me) en lugar de un pipeline
local (face-api + Tesseract). Didit maneja captura de documento, liveness y face
matching en sus servidores.

**Flujo:**
1. Frontend llama `createDiditSession()` → backend crea sesión en Didit
2. Frontend embeds `verification_url` en un iframe
3. Frontend hace polling con `getDiditSessionStatus(sessionId)` cada 3 segundos
4. Cuando el status es `Approved`: backend elimina la sesión de Didit inmediatamente
5. Frontend llama `requestVerification({ verifier_type: "video", confidence, proof })`
6. El perfil del usuario muestra `verified: true`

**Privacidad crítica:** ninguna imagen, embedding ni dato biométrico crudo cruza
la red desde el frontend. Solo `{ confidence, proof_hash }` se envía al backend.

**`didit-backend.js`** es un proxy temporal que corre localmente para desarrollo.
En producción, estas rutas las maneja el backend real (`consta-backend`).

---

## Captura de pasaporte — módulos de calidad

Los módulos en `lib/verification/` analizan la imagen del documento en el cliente
antes de enviarlo. Todo el procesamiento es local, nada de esto sale a la red.

| Módulo | Qué detecta | Umbral |
|--------|-------------|--------|
| `glare-detector` | Reflejo (luminancia > 240) | > 3% de píxeles |
| `blur-detector` | Desenfoque (varianza Laplaciana) | < 100 |
| `lighting-detector` | Poca luz (luminancia media) | < 80 |
| `framing-detector` | Encuadre (cobertura de bordes Canny) | < 60% del perímetro |
| `quality-analyzer` | Orquesta los 4 detectores | — |

**Mensajes de remediación (español):**
- Reflejo: "Inclina el documento o ajusta la luz para reducir el reflejo"
- Desenfoque: "Mantén el dispositivo firme"
- Poca luz: "Busca mejor iluminación"
- Encuadre: "Centra el documento dentro de la guía"

**ResponsivePreview:** el preview de cámara usa `clamp(640px, 80vw, 800px)` en
desktop y `calc(100vw - 48px)` en móvil, con aspect ratio 3:2 forzado.

**FallbackUpload:** si no hay cámara disponible, el usuario puede subir una imagen
JPEG/PNG (≤ 10MB). La imagen se analiza completa (sin recorte central).
El framing detector se desactiva para imágenes subidas.

---

## API del backend

Base URL: `NEXT_PUBLIC_API_URL`

| Método | Ruta | Auth | Descripción |
|--------|------|------|-------------|
| POST | /auth/register | No | Crear cuenta nueva |
| POST | /auth/challenge | No | Solicitar nonce para login |
| POST | /auth/verify | No | Verificar firma → JWT |
| POST | /declarations | Sí | Crear declaración firmada |
| GET | /declarations/:id/verify | No | Verificar declaración pública |
| POST | /checkin | Sí | Confirmar señal de vida |
| POST | /contacts | Sí | Agregar contacto de alerta |
| GET | /contacts | Sí | Listar contactos |
| POST | /verifications | Sí | Registrar verificación (org o video) |
| GET | /verifications/mine | Sí | Listar verificaciones del usuario |
| POST | /verifications/didit/session | Sí | Crear sesión Didit |
| GET | /verifications/didit/session/:id/status | Sí | Consultar estado + auto-delete |
| GET | /users/:id/public | No | Perfil público del usuario |

### Autenticación
```
Authorization: Bearer {jwt_token}
```

### Contratos principales

**POST /auth/register**
```json
// body
{ "email_hash": "sha256hex", "public_key": "ed25519_base64",
  "display_name": "string|null",
  "domain": "periodista|abogado|cientifico|activista|otro",
  "risk_level": "bajo|medio|alto" }
// 201
{ "user_id": "uuid", "created_at": "ISO8601" }
// 409 si email_hash ya existe
```

**POST /auth/challenge**
```json
// body
{ "email_hash": "sha256hex" }
// 200
{ "challenge": "base64url-nonce", "expires_at": "ISO8601" }
// 404 si el usuario no existe
```

**POST /auth/verify**
```json
// body
{ "email_hash": "sha256hex", "challenge": "base64url-nonce",
  "signature": "ed25519_base64" }
// 200
{ "session_token": "jwt", "expires_at": "ISO8601" }
// 401 si la firma no verifica
// 410 si el challenge expiró o ya fue usado
```

**POST /declarations**
```json
// body
{ "content_hash": "sha256hex", "ipfs_cid": "string",
  "signature": "ed25519_base64", "is_public": true }
// 201
{ "declaration_id": "uuid", "timestamp_token": "string",
  "blockchain_tx": "string", "created_at": "ISO8601" }
```

**GET /declarations/:id/verify**
```json
// 200
{ "declaration_id": "uuid", "user_display": "string|Anónimo",
  "domain": "periodista", "content_hash": "sha256hex",
  "ipfs_cid": "string", "timestamp_token": "string",
  "blockchain_tx": "string", "created_at": "ISO8601",
  "verifications": [{ "type": "org|user|video", "name": "string", "at": "ISO8601" }] }
```

**POST /verifications**
```json
// body — verificación por organización
{ "declaration_id": "uuid|null", "verifier_type": "org", "org_name": "string" }
// body — verificación biométrica (Didit aprobó)
{ "declaration_id": "uuid|null", "verifier_type": "video",
  "confidence": 0.92, "proof": "sha256hex", "didit_session_id": "uuid" }
// 201
{ "verification_id": "uuid", "status": "pending|verified", "created_at": "ISO8601" }
```

**GET /users/:id/public**
```json
// 200
{ "user_id": "uuid", "display_name": "string|null", "domain": "periodista",
  "risk_level": "alto", "verified": true,
  "declarations": [{ "id": "uuid", "created_at": "ISO8601" }],
  "last_checkin": "ISO8601|null", "next_due": "ISO8601|null" }
```

---

## Flujo criptográfico completo

```typescript
import { sha256, signContent } from '@/lib/crypto'
import { uploadToIPFS, fetchFromIPFS } from '@/lib/ipfs'
import { generateRecoveryPhrase, keypairFromPhrase, userIdFromPhrase } from '@/lib/mnemonic'

// Al registrarse:
const phrase = generateRecoveryPhrase()           // 12 palabras BIP-39
const seedHash = await userIdFromPhrase(phrase)   // SHA-256 del seed → email_hash
const { publicKey, privateKey } = await keypairFromPhrase(phrase)
// guardar privateKey, publicKey, seedHash en localStorage

// Al crear una declaración:
const cid = await uploadToIPFS(declarationText)
const contentHash = await sha256(declarationText)
const signature = await signContent(privateKey, contentHash)
// POST /declarations con { content_hash: contentHash, ipfs_cid: cid, signature }

// Al verificar una declaración:
const text = await fetchFromIPFS(ipfs_cid)
const recomputedHash = await sha256(text)
// comparar con content_hash del backend para confirmar integridad
```

---

## Capa mock (lib/api.ts)

Cuando `NEXT_PUBLIC_USE_MOCKS=true`, todas las funciones de `lib/api.ts` sirven
respuestas desde localStorage. Hay datos de demo pre-sembrados (usuario "María Solís",
una declaración, un check-in) que se inicializan la primera vez.

Para pasar al backend real:
1. Poner `NEXT_PUBLIC_USE_MOCKS=false` en `.env.local`
2. Asegurar que `NEXT_PUBLIC_API_URL` apunte al backend
3. Actualizar `login()` en `lib/api.ts` para usar el flujo challenge/verify

No hace falta tocar los componentes — la interfaz de las funciones es idéntica.

---

## Convenciones

- TypeScript en todo
- Componentes en PascalCase, archivos en kebab-case
- Llamadas al backend solo desde `lib/api.ts` y `lib/didit.ts`, nunca fetch inline
- Comentarios en español
- Sin guardar emails, IPs ni datos identificables más allá de lo necesario
- La clave privada vive solo en localStorage — nunca sale al backend

## Diseño

- Dark theme: fondo `#0a0a0a`
- Texto: blanco y gris (`#ffffff`, `#6b7280`)
- Acento: verde desaturado (`#4ade80`) usado con moderación
- Fuente monospace para hashes y datos técnicos
- Fuente "DejaVu Serif Condensed" para el logo "consta" en el header
- Sin imágenes, sin gradientes — ASCII como único elemento decorativo

## Deploy

- Vercel (conecta el repo, detecta Next.js automáticamente)
- Variables de entorno: configurar en el dashboard de Vercel
- El repo es público pero `.env.local` nunca se sube (está en `.gitignore`)

## Recursos

- Pinata SDK: https://docs.pinata.cloud
- Web Crypto API: https://developer.mozilla.org/en-US/docs/Web/API/Web_Crypto_API
- BIP-39 wordlist: https://github.com/bitcoinjs/bip39
- Didit Docs: https://docs.didit.me
- Vercel: https://vercel.com

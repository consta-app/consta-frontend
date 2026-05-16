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

- Next.js 14+ (App Router)
- Tailwind CSS
- `lib/crypto.ts` — lo escribe la Persona 1 (backend) y te lo pasa listo
- `lib/ipfs.ts` — lo escribe la Persona 1 (backend) y te lo pasa listo
- `lib/api.ts` — lo escribes tú, llama al backend usando los contratos de abajo
- Fetch para llamadas a la API del backend

## Estructura del proyecto

```
app/
  page.tsx                  # landing page
  register/
    page.tsx                # flujo de registro
  declaration/
    new/page.tsx            # crear declaración
    [id]/verify/page.tsx    # verificar declaración pública (ruta pública)
  profile/
    [id]/page.tsx           # perfil público del usuario
  checkin/
    page.tsx                # confirmar señal de vida
  contacts/
    page.tsx                # gestionar contactos de alerta
lib/
  api.ts                    # todas las llamadas al backend
  crypto.ts                 # funciones de firma Ed25519 y hash SHA-256
  ipfs.ts                   # subir y leer archivos de IPFS via Pinata
```

## Cómo correr en desarrollo

```bash
npm install
cp .env.example .env.local
# llenar NEXT_PUBLIC_API_URL y PINATA_API_KEY
npm run dev
```

## Variables de entorno requeridas

```bash
NEXT_PUBLIC_API_URL=http://localhost:3001   # URL del backend
PINATA_API_KEY=                             # para subir a IPFS
PINATA_SECRET_KEY=
```

---

## API del backend — base URL

```
NEXT_PUBLIC_API_URL (dev: http://localhost:3001, prod: https://api.consta.lat)
```

### Endpoints disponibles

| Método | Ruta | Auth | Descripción |
|--------|------|------|-------------|
| POST | /auth/register | No | Crear cuenta nueva |
| POST | /auth/login | No | Obtener JWT |
| POST | /declarations | Sí | Crear declaración firmada |
| GET | /declarations/:id/verify | No | Verificar declaración pública |
| POST | /checkin | Sí | Confirmar señal de vida |
| POST | /contacts | Sí | Agregar contacto de alerta |
| GET | /contacts | Sí | Listar contactos |
| GET | /users/:id/public | No | Perfil público del usuario |

### Autenticación
Todas las rutas con Auth requieren header:
```
Authorization: Bearer {jwt_token}
```
El JWT se obtiene en POST /auth/login y se guarda en localStorage.

---

### Contratos completos — lo que mandas y lo que recibes

**POST /auth/register**
```json
// body que mandas
{ "email_hash": "sha256hex", "public_key": "ed25519_base64",
  "display_name": "string|null",
  "domain": "periodista|abogado|cientifico|activista|otro",
  "risk_level": "bajo|medio|alto" }
// respuesta 201
{ "user_id": "uuid", "created_at": "ISO8601" }
// error 409 si el email ya existe
```

**POST /auth/login**
```json
// body que mandas
{ "email_hash": "sha256hex" }
// respuesta 200
{ "session_token": "jwt", "expires_at": "ISO8601" }
// error 404 si el usuario no existe
```

**POST /declarations** — requiere Authorization header
```json
// body que mandas (subir a IPFS primero, luego llamar esto)
{ "content_hash": "sha256hex", "ipfs_cid": "string",
  "signature": "ed25519_base64", "is_public": true }
// respuesta 201
{ "declaration_id": "uuid", "timestamp_token": "string",
  "blockchain_tx": "string", "created_at": "ISO8601" }
```

**GET /declarations/:id/verify** — sin auth, ruta pública
```json
// respuesta 200
{ "declaration_id": "uuid", "user_display": "string|Anónimo",
  "domain": "periodista", "content_hash": "sha256hex",
  "ipfs_cid": "string", "timestamp_token": "string",
  "blockchain_tx": "string", "created_at": "ISO8601",
  "verifications": [{ "type": "org|user|video", "name": "string", "at": "ISO8601" }] }
// usa ipfs_cid para cargar el texto completo desde IPFS en el cliente
// error 404 si no existe o is_public = false
```

**POST /checkin** — requiere Authorization header
```json
// body que mandas
{ "interval_days": 30 }
// respuesta 200
{ "next_checkin_due": "ISO8601", "alert_sent": false }
```

**POST /contacts** — requiere Authorization header
```json
// body que mandas
{ "contact_hash": "sha256hex", "contact_name": "string|null" }
// respuesta 201
{ "contact_id": "uuid", "confirmed": false }
// confirmed siempre false al crear — el contacto confirma por email
```

**GET /contacts** — requiere Authorization header
```json
// respuesta 200
{ "contacts": [{ "id": "uuid", "contact_name": "string|null",
  "confirmed": true, "created_at": "ISO8601" }] }
```

**GET /users/:id/public** — sin auth, ruta pública
```json
// respuesta 200
{ "user_id": "uuid", "display_name": "string|null", "domain": "periodista",
  "risk_level": "alto", "verified": true,
  "declarations": [{ "id": "uuid", "created_at": "ISO8601" }],
  "last_checkin": "ISO8601|null", "next_due": "ISO8601|null" }
// error 404 si no existe
```

---

## Flujo criptográfico (crypto.ts e ipfs.ts los escribe la Persona 1)

La Persona 2 no implementa la criptografía — solo la usa.
Cuando la Persona 1 entregue los módulos, úsalos así:

```typescript
import { sha256, generateKeyPair, signContent, exportPublicKey } from '@/lib/crypto'
import { uploadToIPFS, fetchFromIPFS } from '@/lib/ipfs'

// Al registrarse:
const emailHash = await sha256(email)
const { publicKey, privateKey } = await generateKeyPair()
const publicKeyB64 = await exportPublicKey(publicKey)
// guardar privateKey en localStorage

// Al crear una declaración:
const cid = await uploadToIPFS(declarationText)
const contentHash = await sha256(declarationText)
const signature = await signContent(privateKey, contentHash)
// luego llamar POST /declarations con { content_hash, ipfs_cid: cid, signature }

// Al verificar una declaración:
const text = await fetchFromIPFS(ipfs_cid)
const recomputedHash = await sha256(text)
// comparar con content_hash del backend para confirmar integridad
```

---

## Pantallas principales a construir

### Landing (/)
- Estética dark con ASCII art landscape (ver prompt de Lovable en docs/)
- Nombre "Consta" grande sobre el paisaje ASCII
- Subtítulo: "Tu declaración. Tu firma. Tu evidencia."
- CTA: "Registrar mi declaración"

### Registro (/register)
- Paso 1: email (solo para login, se hashea antes de mandarse)
- Paso 2: dominio (periodista, abogado, etc.) y nivel de riesgo
- Paso 3: generar llaves criptográficas (automático, mostrar confirmación)
- Guardar clave privada en localStorage con advertencia clara

### Nueva declaración (/declaration/new)
- Textarea para escribir la declaración
- Preview de cómo se verá públicamente
- Botón "Firmar y publicar" — dispara el flujo criptográfico completo
- Mostrar CID de IPFS y hash como confirmación

### Verificación pública (/declaration/:id/verify)
- Muestra la declaración completa (cargada desde IPFS via CID)
- Muestra hash, timestamp RFC 3161, tx de blockchain
- Botón "Verificar integridad" que re-hashea el contenido y compara
- Sin login — accesible para cualquiera

### Perfil público (/profile/:id)
- Nombre o "Anónimo", dominio, nivel de riesgo
- Lista de declaraciones públicas con fechas
- Último check-in

### Check-in (/checkin)
- Una sola pantalla: "Confirmar que estoy bien"
- Selector de intervalo (7, 14, 30, 60 días)
- Botón grande — una acción, simple y rápida

---

## Convenciones

- TypeScript en todo
- Componentes en PascalCase, archivos en kebab-case
- Llamadas al backend solo desde lib/api.ts, nunca fetch inline en componentes
- La clave privada del usuario vive en localStorage — advertir al usuario que
  si borra el localStorage pierde acceso a su cuenta
- Comentarios en español
- Sin guardar emails, IPs ni datos identificables en el cliente más allá de lo necesario

## Diseño

- Dark theme: fondo #0a0a0a
- Texto: blanco y gris (#ffffff, #6b7280)
- Acento: verde desaturado (#4ade80) usado con moderación
- Fuente monospace para ASCII art y hashes
- Sans-serif para el resto
- Sin imágenes, sin gradientes — ASCII como único elemento decorativo

## Deploy

- Vercel (conecta el repo, detecta Next.js automáticamente)
- Variables de entorno: configurar en el dashboard de Vercel
- El repo es público pero .env.local nunca se sube (está en .gitignore)

## Recursos

- Pinata SDK: https://docs.pinata.cloud
- Web Crypto API: https://developer.mozilla.org/en-US/docs/Web/API/Web_Crypto_API
- Vercel: https://vercel.com

# Consta — Backend

## What this project is

Consta is a public registry where journalists, lawyers, scientists, and activists
in Latin America can create a cryptographically signed declaration stating that
they have no intention of harming themselves. If something happens to them, their
own words remain as public, dated, immutable evidence.

Built in 72h for hack@latam — track DEF/ACC. Open source, deployed.

**This repo is the backend.** The frontend lives in `consta-frontend`.

---

## Stack

- Node.js + Express
- PostgreSQL (Supabase in dev, Railway in prod)
- JWT for session authentication
- Ed25519 for cryptographic signatures (Web Crypto API)
- BIP-39 12-word recovery phrases (deterministically derives the Ed25519 keypair)
- RFC 3161 via FreeTSA for certified timestamps
- OpenTimestamps for Bitcoin anchor
- IPFS via Pinata (the full declaration content lives there, not here)
- **Didit (didit.me)** — third-party KYC for identity verification. Replaces the
  original local face-api/Tesseract pipeline. Biometric processing happens on
  Didit's servers, not in the user's browser.

## Project structure

```
src/
  index.js                       # entry, Express + CORS
  db/
    schema.js                    # PostgreSQL connection + table creation
  middleware/
    auth.js                      # JWT verification on protected routes
  services/
    didit.js                     # NEW — wrapper for Didit's API
                                 #   (createSession, getStatus, deleteSession)
  routes/
    auth.js                      # POST /auth/register, /auth/challenge, /auth/verify
    declarations.js              # POST /declarations, GET /declarations/:id/verify
    checkin.js                   # POST /checkin
    contacts.js                  # POST /contacts, GET /contacts
    verifications.js             # NEW — POST /verifications, GET /verifications/mine
                                 #   plus the Didit proxy (sessions + status)
    public.js                    # GET /users/:id/public
```

## How to run in development

```bash
npm install
cp .env.example .env
# fill in all the variables in .env (see below)
node src/index.js
# or with auto-reload:
node --watch src/index.js
```

## Required environment variables

```bash
DATABASE_URL=         # PostgreSQL connection string
JWT_SECRET=           # long random string (64+ chars)
FRONTEND_URL=         # frontend URL(s) for CORS — accepts CSV
                      # e.g. http://localhost:3000,https://consta.vercel.app
PINATA_API_KEY=       # Pinata API key for IPFS
PINATA_SECRET_KEY=    # Pinata secret key
PORT=3001
NODE_ENV=development

# Didit KYC
DIDIT_API_KEY=        # from business.didit.me → Settings → API Keys
DIDIT_WORKFLOW_ID=    # from business.didit.me → Workflows
DIDIT_API_URL=https://verification.didit.me
```

---

## Important changes vs the original brief

Two structural changes were made during frontend development that the backend
needs to accommodate:

1. **Authentication via recovery phrase, not email.** The user never provides
   an email. They generate 12 BIP-39 words that deterministically derive their
   Ed25519 keypair. The `email_hash` column now receives a `seed_hash`
   (SHA-256 of the BIP-39 seed) — to the backend it's an opaque identifier,
   but there is no longer any way to recover the account via email.

2. **Identity verification delegated to Didit.** The original brief assumed a
   100% local pipeline (face-api + Tesseract + mrz). That was replaced with
   Didit. The backend must add endpoints to create/poll Didit sessions and
   must delete the session immediately after receiving the decision.

---

## Database schema

```sql
users
  id UUID PRIMARY KEY,
  email_hash VARCHAR UNIQUE NOT NULL,    -- now receives the seed_hash from the BIP-39 phrase
  public_key VARCHAR NOT NULL,           -- Ed25519 pubkey in base64
  display_name VARCHAR,
  domain VARCHAR NOT NULL,               -- 'periodista' | 'abogado' | 'cientifico' | 'activista' | 'otro'
  risk_level VARCHAR NOT NULL,           -- 'bajo' | 'medio' | 'alto'
  verified_at TIMESTAMP,                 -- set when a 'video' verification is Approved
  created_at TIMESTAMP NOT NULL DEFAULT NOW()

declarations
  id UUID PRIMARY KEY,
  user_id UUID REFERENCES users(id) NOT NULL,
  content_hash VARCHAR NOT NULL,         -- SHA-256 hex
  ipfs_cid VARCHAR NOT NULL,
  signature VARCHAR NOT NULL,            -- Ed25519 base64
  timestamp_token VARCHAR,               -- RFC 3161
  blockchain_tx VARCHAR,                 -- OpenTimestamps tx
  is_public BOOLEAN NOT NULL DEFAULT TRUE,
  created_at TIMESTAMP NOT NULL DEFAULT NOW()

check_ins
  id UUID PRIMARY KEY,
  user_id UUID REFERENCES users(id) UNIQUE NOT NULL,
  interval_days INT NOT NULL,
  last_checkin TIMESTAMP NOT NULL,
  next_due TIMESTAMP NOT NULL,
  alert_sent BOOLEAN NOT NULL DEFAULT FALSE

trusted_contacts
  id UUID PRIMARY KEY,
  user_id UUID REFERENCES users(id) NOT NULL,
  contact_hash VARCHAR NOT NULL,         -- SHA-256 of the contact's email
  contact_name VARCHAR,
  confirmed BOOLEAN NOT NULL DEFAULT FALSE,
  created_at TIMESTAMP NOT NULL DEFAULT NOW()

verifications
  id UUID PRIMARY KEY,
  declaration_id UUID REFERENCES declarations(id),
  user_id UUID REFERENCES users(id) NOT NULL,
  verifier_type VARCHAR NOT NULL,        -- 'org' | 'video' | 'user'
  verifier_id UUID,                      -- nullable, for user-based verifications
  org_name VARCHAR,                      -- nullable, only for 'org'
  confidence FLOAT,                      -- nullable, only for 'video'
  proof_hash VARCHAR,                    -- nullable, only for 'video'
  didit_session_id VARCHAR,              -- nullable, for traceability of the Didit session
  status VARCHAR NOT NULL DEFAULT 'pending', -- 'pending' | 'verified'
  verified_at TIMESTAMP,
  created_at TIMESTAMP NOT NULL DEFAULT NOW()

auth_challenges                          -- NEW — for the challenge/verify flow
  id UUID PRIMARY KEY,
  email_hash VARCHAR NOT NULL,
  challenge VARCHAR NOT NULL,            -- random 32-byte base64url nonce
  expires_at TIMESTAMP NOT NULL,         -- 5 minutes from creation
  used BOOLEAN NOT NULL DEFAULT FALSE,
  created_at TIMESTAMP NOT NULL DEFAULT NOW()
```

**Critical rules:**
- PostgreSQL only stores hashes and metadata.
- The full declaration text lives on IPFS.
- Never store IPs.
- **No endpoint accepts biometric data** (images, embeddings, video frames).
  The only data crossing the network from Didit is `{session_id, status}`.

---

## API — endpoints

| Method | Route | Auth | Description |
|--------|-------|------|-------------|
| POST | /auth/register | No | Create a new account |
| POST | /auth/challenge | No | Request a nonce for login |
| POST | /auth/verify | No | Verify nonce signature → JWT |
| POST | /declarations | Yes | Create a signed declaration |
| GET | /declarations/:id/verify | No | Verify a public declaration |
| POST | /checkin | Yes | Confirm proof of life |
| POST | /contacts | Yes | Add an alert contact |
| GET | /contacts | Yes | List contacts |
| POST | /verifications | Yes | Record a verification (org or video) |
| GET | /verifications/mine | Yes | List the current user's verifications |
| POST | /verifications/didit/session | Yes | Create a Didit session |
| GET | /verifications/didit/session/:id/status | Yes | Poll status + auto-delete |
| GET | /users/:id/public | No | User's public profile |
| GET | /health | No | Server status |

### Declaration flow (order matters)
1. Frontend derives an Ed25519 keypair from the user's BIP-39 phrase
2. Frontend hashes the seed with SHA-256 (this becomes `email_hash`)
3. User writes their declaration
4. Frontend uploads the text to IPFS → receives a CID
5. Frontend signs the SHA-256 of the text with the private key
6. Frontend calls `POST /declarations` with: content_hash, ipfs_cid, signature
7. Backend verifies the Ed25519 signature against the stored public_key
8. Backend calls FreeTSA to get an RFC 3161 TimeStampToken (base64, stored in `timestamp_token`)
9. Backend calls OpenTimestamps public calendars to get an initial OTS proof (base64, stored in `blockchain_tx`)
10. Both timestamp calls are non-blocking on failure — the declaration is saved even if they time out
11. A background cron job upgrades the OTS proof to a full Bitcoin proof ~1 hour later
12. The declaration becomes public, verifiable, and immutable — with two independent timestamp proofs

### Challenge/verify auth flow (new)

The original brief had a `POST /auth/login` that accepted only `email_hash`
and returned a JWT — that's insecure because anyone with a known seed_hash
could log in. The correct flow is:

1. Frontend calls `POST /auth/challenge` with `email_hash`
2. Backend generates a random 32-byte nonce, stores it with a 5-minute TTL,
   and returns it
3. Frontend signs the challenge with the private key derived from the phrase
4. Frontend calls `POST /auth/verify` with `{email_hash, challenge, signature}`
5. Backend looks up the user's `public_key`, verifies the signature with Ed25519,
   marks the challenge as used, issues a JWT

### Didit verification flow

1. User clicks "Iniciar verificación" on `/verify-identity`
2. Frontend calls `POST /verifications/didit/session`
3. Backend calls Didit: `POST https://verification.didit.me/v3/session/`
   with `x-api-key: $DIDIT_API_KEY` header and body
   `{ workflow_id: $DIDIT_WORKFLOW_ID, vendor_data: user_id, language: "es" }`
4. Backend returns `{ session_id, verification_url }` to the frontend
5. Frontend embeds `verification_url` in an iframe
6. User completes verification on Didit (document + selfie + liveness)
7. Frontend polls `GET /verifications/didit/session/:id/status` every 3 seconds
8. Backend queries `GET https://verification.didit.me/v3/session/:id/decision/`
9. **When the status becomes Approved or Declined, the backend MUST
   immediately call `DELETE https://verification.didit.me/v3/session/:id/delete/`
   to wipe all biometric data from Didit's servers.**
10. If Approved: the backend also creates an internal verification record
    (equivalent to `POST /verifications`) with `verifier_type: "video"`,
    `confidence`, `proof_hash`, `didit_session_id`, and updates
    `users.verified_at = NOW()` for the user.

### Main endpoint contracts

**POST /auth/register**
```json
// body
{ "email_hash": "sha256hex", "public_key": "ed25519_base64",
  "display_name": "string|null", "domain": "periodista|abogado|cientifico|activista|otro",
  "risk_level": "bajo|medio|alto" }
// 201
{ "user_id": "uuid", "created_at": "ISO8601" }
// 409 if email_hash already exists
```

**POST /auth/challenge**
```json
// body
{ "email_hash": "sha256hex" }
// 200
{ "challenge": "base64url-nonce", "expires_at": "ISO8601" }
// 404 if user doesn't exist
```

**POST /auth/verify**
```json
// body
{ "email_hash": "sha256hex", "challenge": "base64url-nonce",
  "signature": "ed25519_base64" }
// 200
{ "session_token": "jwt", "expires_at": "ISO8601" }
// 401 if signature does not verify against the stored public_key
// 410 if the challenge expired or was already used
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
// no body, no auth
// 200
{ "declaration_id": "uuid", "user_display": "string|Anónimo",
  "domain": "periodista", "content_hash": "sha256hex",
  "ipfs_cid": "string", "timestamp_token": "string",
  "blockchain_tx": "string", "created_at": "ISO8601",
  "verifications": [{ "type": "org|user|video", "name": "string", "at": "ISO8601" }] }
// 404 if not found or is_public = false
```

**POST /checkin**
```json
// body
{ "interval_days": 30 }
// 200
{ "next_checkin_due": "ISO8601", "alert_sent": false }
```

**POST /contacts**
```json
// body
{ "contact_hash": "sha256hex", "contact_name": "string|null" }
// 201
{ "contact_id": "uuid", "confirmed": false }
// confirmed is always false on create — the contact must confirm via email
```

**GET /contacts**
```json
// no body
// 200
{ "contacts": [{ "id": "uuid", "contact_name": "string|null",
  "confirmed": true, "created_at": "ISO8601" }] }
```

**POST /verifications**
```json
// body — for organization verification
{ "declaration_id": "uuid|null", "verifier_type": "org",
  "org_name": "Artículo 19" }
// body — for biometric verification (Didit already responded Approved)
{ "declaration_id": "uuid|null", "verifier_type": "video",
  "confidence": 0.92, "proof": "sha256hex", "didit_session_id": "uuid" }
// 201
{ "verification_id": "uuid",
  "status": "pending|verified",  // 'verified' immediately for video, 'pending' for org
  "created_at": "ISO8601" }
// IMPORTANT: when verifier_type === 'video' and status is 'verified',
// the backend MUST update users.verified_at = NOW() so the public profile
// reflects the verified state.
```

**GET /verifications/mine**
```json
// no body, requires auth
// 200
{ "verifications": [{
    "id": "uuid",
    "verifier_type": "org|video",
    "verifier_name": "string",       // org_name or "Verificación biométrica" for video
    "status": "pending|verified",
    "created_at": "ISO8601"
}] }
```

**POST /verifications/didit/session**
```json
// body — requires auth
{ "user_id": "uuid" }
// 201
{ "session_id": "uuid",
  "verification_url": "https://verify.didit.me/session/...",
  "status": "Not Started" }
// 500 if Didit returns an error
```

**GET /verifications/didit/session/:sessionId/status**
```json
// no body, requires auth
// 200
{ "status": "Not Started|In Progress|Approved|Declined|Expired|Abandoned" }
// CRITICAL: if the status retrieved from Didit is 'Approved' or 'Declined',
// the backend MUST immediately call:
// DELETE https://verification.didit.me/v3/session/:id/delete/
// with the x-api-key header. This wipes all biometric data on Didit's side.
// Only after the session is deleted should the backend respond to the frontend.
```

**GET /users/:id/public**
```json
// no body, no auth
// 200
{ "user_id": "uuid", "display_name": "string|null", "domain": "periodista",
  "risk_level": "alto", "verified": true,            // = (users.verified_at IS NOT NULL)
  "declarations": [{ "id": "uuid", "created_at": "ISO8601" }],
  "last_checkin": "ISO8601|null", "next_due": "ISO8601|null" }
// 404 if not found
```

---

## Modules this repo delivers to the frontend

In addition to the API, Person 1 writes these two TypeScript modules
which Person 2 copies directly into `consta-frontend/lib/`:

**crypto.ts** — signing and hashing functions
```typescript
// sha256(text: string): Promise<string>  → hex
// generateKeyPair(): Promise<{publicKey, privateKey}>
// signContent(privateKey, contentHash): Promise<string>  → base64
// exportPublicKey(publicKey): Promise<string>  → base64
```

**ipfs.ts** — upload to and read from IPFS
```typescript
// uploadToIPFS(text: string): Promise<string>  → CID
// fetchFromIPFS(cid: string): Promise<string>  → full text
```

The frontend already has a `lib/mnemonic.ts` module that handles BIP-39 phrase
generation and keypair derivation — that module is not the backend's
responsibility.

When ready, ping Person 2 and pass them through the team channel.

---

## Code conventions

- Async/await on all handlers, no callbacks
- Always try/catch around DB operations and Didit calls
- Errors with semantic HTTP codes: 400 input, 401 auth, 404 not found,
  409 conflict, 410 gone (expired challenge), 500 server
- Never log user data, only technical errors
- Comments in Spanish (matches existing codebase)
- **Never log Didit payloads** (they may contain sensitive data)

## Operational security (critical)

- Zero logging of IPs or connection metadata
- JWT expires in 7 days
- All emails (now seed_hashes) arrive pre-hashed from the frontend
- The server cannot reconstruct a user's identity from the DB
- Sensitive variables only in environment, never in code
- **Biometric data: never accept, never store.** Only `{confidence, proof}`.
- **Auto-delete from Didit:** the session is deleted from Didit's servers
  immediately after receiving Approved/Declined. This is the backend's
  responsibility, not the frontend's.
- CORS: `FRONTEND_URL` can be CSV. Also consider allowing `*.vercel.app`
  for preview deploys.

## Deploy

- Backend: Railway (connect the repo, add the PostgreSQL plugin, done)
- Environment variables: configure in the Railway dashboard
- The repo is public but .env is never committed (it's in .gitignore)
- In the Didit dashboard (`business.didit.me`) configure data retention to
  the minimum (1 month) as a safety net. Auto-delete already covers the
  normal case; this is a fallback in case delete fails.

## Timestamping — implementation requirements

Both RFC 3161 and OpenTimestamps are **required features**, not stubs.
See `BACKEND_BOOTSTRAP_PROMPT.md` for the full implementation guide with code.

### RFC 3161 (FreeTSA)

- npm package: `timestamp-client`
- TSA endpoint: `https://freetsa.org/tsr` (no API key required)
- Called synchronously inside `POST /declarations` before the INSERT
- Returns a DER-encoded TimeStampToken stored as base64 in `declarations.timestamp_token`
- Timeout: 10 seconds, retry once. If both fail, store `null` and log — do not block the user.
- The token is returned in the API response so any third party can verify it independently.

### OpenTimestamps (Bitcoin anchor)

- npm package: `opentimestamps`
- Called synchronously inside `POST /declarations` after the RFC 3161 call
- Returns an incomplete OTS proof (base64) stored in `declarations.blockchain_tx`
- The proof is incomplete at creation time — Bitcoin confirmation takes ~1 hour
- A Railway cron job runs every 2 hours to upgrade incomplete proofs to full Bitcoin proofs
- Add `blockchain_tx_upgraded BOOLEAN NOT NULL DEFAULT FALSE` to the `declarations` table
- Verification: `OpenTimestamps.verify()` returns `{ bitcoin: Date }` when complete, `{}` when pending

### Why both

RFC 3161 gives an immediate, legally recognized timestamp from a trusted CA.
OpenTimestamps gives a second, independent proof anchored in Bitcoin that requires
trusting no single authority. Together they make the timestamp essentially unforgeable.

---

## Resources

- FreeTSA: https://freetsa.org
- OpenTimestamps: https://opentimestamps.org
- `timestamp-client` npm: https://www.npmjs.com/package/timestamp-client
- `opentimestamps` npm: https://www.npmjs.com/package/opentimestamps
- Pinata: https://pinata.cloud
- Railway: https://railway.app
- Didit Console: https://business.didit.me
- Didit Docs: https://docs.didit.me
- Didit Delete Session: https://docs.didit.me/sessions-api/delete-session

# Backend Bootstrap Prompt — Consta

You are building the backend for **Consta**, a public registry where journalists,
lawyers, scientists, and activists in Latin America can create cryptographically
signed declarations stating they have no intention of harming themselves.

Read `BACKEND_CLAUDE.md` in this same `docs/` folder first — it is your primary
specification. This file adds implementation detail for the two features that
must NOT be stubbed: **RFC 3161 timestamping** and **OpenTimestamps Bitcoin anchoring**.

---

## RFC 3161 — Certified Timestamps (FreeTSA)

Every declaration must carry a certified timestamp from a trusted third-party
Time Stamp Authority (TSA). We use FreeTSA (https://freetsa.org) because it is
free, reliable, and its root certificate is widely trusted.

### What RFC 3161 proves

A TSA receives a hash of your data, signs it together with the current time using
its own private key, and returns a `TimeStampToken` (TST). Anyone can later verify
that the data existed at that exact time without trusting you — they only need to
trust the TSA's public certificate.

### npm package

```bash
npm install timestamp-client
# or, if you prefer a lower-level approach:
npm install node-forge  # for DER parsing
```

The simplest production-ready approach is `timestamp-client`:

```js
const { TimestampClient } = require('timestamp-client');

async function getTimestamp(contentHashHex) {
  // contentHashHex is the SHA-256 hex string of the declaration text
  const hashBuffer = Buffer.from(contentHashHex, 'hex');

  const client = new TimestampClient({
    url: 'https://freetsa.org/tsr',
    // FreeTSA does not require authentication
  });

  // request() hashes the buffer internally with SHA-256 and sends the TSQ
  const token = await client.request(hashBuffer, { algorithm: 'sha256' });
  // token is a Buffer containing the DER-encoded TimeStampToken
  return token.toString('base64');
}
```

Store the base64 string in `declarations.timestamp_token`. It is typically
~1–2 KB.

### Verification (for GET /declarations/:id/verify)

```js
const { TimestampClient } = require('timestamp-client');

async function verifyTimestamp(contentHashHex, timestampTokenBase64) {
  const hashBuffer = Buffer.from(contentHashHex, 'hex');
  const tokenBuffer = Buffer.from(timestampTokenBase64, 'base64');

  const client = new TimestampClient({ url: 'https://freetsa.org/tsr' });
  const result = await client.verify(tokenBuffer, hashBuffer);
  // result.time is a Date object — the certified timestamp
  // result.valid is boolean
  return result;
}
```

Return `timestamp_token` (the raw base64) in the API response so the frontend
or any third party can independently verify it with any RFC 3161 library.

### Error handling

FreeTSA is occasionally slow. Wrap the call in a 10-second timeout and retry
once. If it fails twice, still save the declaration but set `timestamp_token`
to `null` and log the error. Do not block the user.

```js
async function getTimestampWithRetry(contentHashHex) {
  for (let attempt = 0; attempt < 2; attempt++) {
    try {
      const controller = new AbortController();
      const timeout = setTimeout(() => controller.abort(), 10_000);
      const token = await getTimestamp(contentHashHex); // add signal support if library allows
      clearTimeout(timeout);
      return token;
    } catch (err) {
      if (attempt === 1) {
        console.error('RFC 3161 timestamp failed after 2 attempts:', err.message);
        return null;
      }
    }
  }
}
```

---

## OpenTimestamps — Bitcoin Anchor

OpenTimestamps (https://opentimestamps.org) aggregates many hashes into a Merkle
tree and anchors the root in a Bitcoin transaction. This gives the declaration a
second, independent proof of existence that is verifiable without trusting any
single authority — only the Bitcoin blockchain.

### How it works

1. You submit a hash to the OTS calendar servers.
2. They return an **incomplete** `.ots` proof file immediately (the Bitcoin tx
   hasn't been mined yet — it takes ~1 hour).
3. After ~1 hour, you can "upgrade" the proof to get the full Bitcoin tx ID.
4. The incomplete proof is still useful — it proves the hash was submitted before
   the next Bitcoin block.

### npm package

```bash
npm install opentimestamps
```

### Stamping a declaration

```js
const OpenTimestamps = require('opentimestamps');

async function stampWithOTS(contentHashHex) {
  const hashBytes = Buffer.from(contentHashHex, 'hex');

  // Create a DetachedTimestampFile from the raw hash
  const detached = OpenTimestamps.DetachedTimestampFile.fromHash(
    new OpenTimestamps.Ops.OpSHA256(),
    hashBytes
  );

  // Submit to the public calendar servers (no API key needed)
  await OpenTimestamps.stamp(detached);

  // Serialize the (incomplete) proof to bytes
  const ctx = new OpenTimestamps.Context.SerializationContext();
  detached.serialize(ctx);
  const otsBytes = Buffer.from(ctx.getOutput());

  return otsBytes.toString('base64');
}
```

Store the base64 string in `declarations.blockchain_tx`. Despite the column name,
this stores the OTS proof bytes, not a raw tx hash. The column name is kept for
backwards compatibility.

### Upgrading the proof (background job)

The incomplete proof needs to be upgraded after ~1 hour to embed the actual
Bitcoin block hash. Run this as a scheduled job (cron every 2 hours):

```js
async function upgradeOTSProofs() {
  // Find declarations with incomplete OTS proofs (no bitcoin tx yet)
  const rows = await db.query(`
    SELECT id, content_hash, blockchain_tx
    FROM declarations
    WHERE blockchain_tx IS NOT NULL
      AND blockchain_tx_upgraded = FALSE
      AND created_at < NOW() - INTERVAL '1 hour'
    LIMIT 50
  `);

  for (const row of rows) {
    try {
      const otsBytes = Buffer.from(row.blockchain_tx, 'base64');
      const detached = OpenTimestamps.DetachedTimestampFile.deserialize(
        new OpenTimestamps.Context.DeserializationContext(otsBytes)
      );

      await OpenTimestamps.upgrade(detached);

      const ctx = new OpenTimestamps.Context.SerializationContext();
      detached.serialize(ctx);
      const upgradedBase64 = Buffer.from(ctx.getOutput()).toString('base64');

      await db.query(
        `UPDATE declarations
         SET blockchain_tx = $1, blockchain_tx_upgraded = TRUE
         WHERE id = $2`,
        [upgradedBase64, row.id]
      );
    } catch (err) {
      // Not ready yet — try again next cycle
      console.error(`OTS upgrade failed for ${row.id}:`, err.message);
    }
  }
}
```

Add `blockchain_tx_upgraded BOOLEAN NOT NULL DEFAULT FALSE` to the `declarations`
table (migration below).

### Verification

```js
async function verifyOTS(contentHashHex, otsBase64) {
  const hashBytes = Buffer.from(contentHashHex, 'hex');
  const otsBytes = Buffer.from(otsBase64, 'base64');

  const detached = OpenTimestamps.DetachedTimestampFile.deserialize(
    new OpenTimestamps.Context.DeserializationContext(otsBytes)
  );

  // verify() returns a map of attestations
  const result = await OpenTimestamps.verify(detached, hashBytes);
  // result is an object like { bitcoin: Date } when the proof is complete
  // or {} when the proof is still pending
  return result;
}
```

---

## Schema migration

Add this column to `declarations`:

```sql
ALTER TABLE declarations
  ADD COLUMN IF NOT EXISTS blockchain_tx_upgraded BOOLEAN NOT NULL DEFAULT FALSE;
```

Run this migration before deploying the OTS upgrade job.

---

## Declaration creation flow (complete)

This is the full sequence for `POST /declarations`:

```js
router.post('/', requireAuth, async (req, res) => {
  const { content_hash, ipfs_cid, signature, is_public = true } = req.body;
  const user_id = req.user.id;

  // 1. Verify the Ed25519 signature
  const user = await db.query('SELECT public_key FROM users WHERE id = $1', [user_id]);
  const valid = await verifySignature(user.rows[0].public_key, content_hash, signature);
  if (!valid) return res.status(401).json({ error: 'Firma inválida' });

  // 2. Get RFC 3161 timestamp (non-blocking on failure)
  const timestamp_token = await getTimestampWithRetry(content_hash);

  // 3. Get OpenTimestamps proof (non-blocking on failure)
  let blockchain_tx = null;
  try {
    blockchain_tx = await stampWithOTS(content_hash);
  } catch (err) {
    console.error('OTS stamp failed:', err.message);
  }

  // 4. Insert declaration
  const result = await db.query(
    `INSERT INTO declarations
       (id, user_id, content_hash, ipfs_cid, signature,
        timestamp_token, blockchain_tx, is_public)
     VALUES (gen_random_uuid(), $1, $2, $3, $4, $5, $6, $7)
     RETURNING id, created_at`,
    [user_id, content_hash, ipfs_cid, signature,
     timestamp_token, blockchain_tx, is_public]
  );

  res.status(201).json({
    declaration_id: result.rows[0].id,
    timestamp_token,
    blockchain_tx,
    created_at: result.rows[0].created_at,
  });
});
```

---

## Cron job setup (Railway)

Railway supports cron jobs natively. Add a `railway.toml` at the repo root:

```toml
[deploy]
startCommand = "node src/index.js"

[[cronJobs]]
name = "upgrade-ots-proofs"
schedule = "0 */2 * * *"   # every 2 hours
command = "node src/jobs/upgrade-ots.js"
```

Create `src/jobs/upgrade-ots.js`:

```js
const { upgradeOTSProofs } = require('../services/timestamps');

upgradeOTSProofs()
  .then(() => { console.log('OTS upgrade job complete'); process.exit(0); })
  .catch(err => { console.error(err); process.exit(1); });
```

---

## Summary of what must NOT be stubbed

| Feature | Implementation | Fallback on failure |
|---------|---------------|---------------------|
| RFC 3161 timestamp | `timestamp-client` → FreeTSA | `null` in DB, log error, don't block user |
| OTS stamp (initial) | `opentimestamps` → public calendars | `null` in DB, log error, don't block user |
| OTS upgrade (cron) | Railway cron every 2h | Retry next cycle silently |
| Didit auto-delete | `DELETE /v3/session/:id/delete/` | Must not fail silently — retry 3× then alert |

Everything else in `BACKEND_CLAUDE.md` applies as written.

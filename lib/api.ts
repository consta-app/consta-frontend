// Cliente del backend de Consta. Una función por endpoint del CLAUDE.md.
//
// Mientras el backend (consta-backend) no esté listo se sirven respuestas
// mockeadas contra localStorage para que la demo funcione end-to-end. Cuando
// el backend esté disponible:
//   1. Poner NEXT_PUBLIC_USE_MOCKS=false en .env.local
//   2. Asegurar que NEXT_PUBLIC_API_URL apunte al backend
// No hace falta tocar los componentes.

const API_URL =
  process.env.NEXT_PUBLIC_API_URL ?? "http://localhost:3001";
export const USE_MOCKS =
  (process.env.NEXT_PUBLIC_USE_MOCKS ?? "true").toLowerCase() !== "false";

// ─── Tipos compartidos (espejo de los contratos del CLAUDE.md) ──────────────

export type Domain =
  | "periodista"
  | "abogado"
  | "cientifico"
  | "activista"
  | "otro";
export type RiskLevel = "bajo" | "medio" | "alto";

export interface RegisterBody {
  email_hash: string;
  public_key: string;
  display_name: string | null;
  domain: Domain;
  risk_level: RiskLevel;
}
export interface RegisterResponse {
  user_id: string;
  created_at: string;
}

export interface LoginBody {
  email_hash: string;
}
export interface LoginResponse {
  session_token: string;
  expires_at: string;
}

export interface ChallengeBody {
  email_hash: string;
}
export interface ChallengeResponse {
  challenge: string;
  expires_at: string;
}

export interface VerifyBody {
  email_hash: string;
  challenge: string;
  signature: string;
}
export interface VerifyResponse {
  session_token: string;
  expires_at: string;
}

export interface CreateDeclarationBody {
  content_hash: string;
  ipfs_cid: string;
  signature: string;
  is_public: boolean;
}
export interface CreateDeclarationResponse {
  declaration_id: string;
  timestamp_token: string;
  blockchain_tx: string;
  created_at: string;
}

export interface DeclarationVerification {
  type: "org" | "user" | "video";
  name: string;
  at: string;
}
export interface PublicDeclarationItem {
  id: string;
  user_display: string;
  domain: Domain;
  risk_level: RiskLevel;
  blockchain_confirmed: boolean;
  verification_count: number;
  created_at: string;
}
export interface ListDeclarationsResponse {
  declarations: PublicDeclarationItem[];
}

export interface VerifyDeclarationResponse {
  declaration_id: string;
  user_display: string;
  domain: Domain;
  content_hash: string;
  ipfs_cid: string;
  timestamp_token: string;
  blockchain_tx: string;
  blockchain_confirmed: boolean;
  created_at: string;
  verifications: DeclarationVerification[];
}

export interface CheckinBody {
  interval_days: number;
}
export interface CheckinResponse {
  next_checkin_due: string;
  alert_sent: boolean;
}

export interface CreateContactBody {
  contact_hash: string;
  contact_name: string | null;
  contact_info: string;
}
export interface CreateContactResponse {
  contact_id: string;
  confirmed: boolean;
}
export interface ContactItem {
  id: string;
  contact_name: string | null;
  contact_info: string | null;
  confirmed: boolean;
  created_at: string;
}
export interface ListContactsResponse {
  contacts: ContactItem[];
}

// Verificaciones de identidad — todavía no existe el endpoint en el backend.
// TODO: connect to backend endpoint (POST /verifications, GET /verifications/mine)
//
// PRIVACIDAD: para verifier_type === "video" el cliente ejecuta toda la
// coincidencia facial localmente y solo envía un puntaje de confianza y
// un hash de prueba. Ninguna imagen, embedding ni dato biométrico crudo
// debe aparecer nunca en este payload.
export type VerifierType = "org" | "video";

export interface RequestVerificationBody {
  declaration_id?: string;
  verifier_type: VerifierType;
  org_name?: string;
  confidence?: number;
  proof?: string;
}
export interface RequestVerificationResponse {
  verification_id: string;
  status: "pending" | "verified";
  created_at: string;
}
export interface MyVerificationItem {
  id: string;
  verifier_type: VerifierType;
  verifier_name: string;
  status: "pending" | "verified";
  created_at: string;
}
export interface MyVerificationsResponse {
  verifications: MyVerificationItem[];
}

export interface PublicProfileResponse {
  user_id: string;
  display_name: string | null;
  domain: Domain;
  risk_level: RiskLevel;
  verified: boolean;
  declarations: { id: string; created_at: string }[];
  last_checkin: string | null;
  next_due: string | null;
}

// ─── Helpers de sesión ──────────────────────────────────────────────────────

const TOKEN_KEY = "consta:session_token";
const USER_KEY = "consta:user_id";

export function getSessionToken(): string | null {
  if (typeof window === "undefined") return null;
  return localStorage.getItem(TOKEN_KEY);
}
export function setSession(token: string, userId: string) {
  if (typeof window === "undefined") return;
  localStorage.setItem(TOKEN_KEY, token);
  localStorage.setItem(USER_KEY, userId);
}
export function clearSession() {
  if (typeof window === "undefined") return;
  localStorage.removeItem(TOKEN_KEY);
  localStorage.removeItem(USER_KEY);
}
export function getCurrentUserId(): string | null {
  if (typeof window === "undefined") return null;
  return localStorage.getItem(USER_KEY);
}

function authHeaders(): Record<string, string> {
  const token = getSessionToken();
  return token ? { Authorization: `Bearer ${token}` } : {};
}

export class ApiError extends Error {
  constructor(public status: number, message: string) {
    super(message);
  }
}

async function request<T>(
  path: string,
  init: RequestInit & { auth?: boolean } = {},
): Promise<T> {
  const headers: Record<string, string> = {
    "Content-Type": "application/json",
    ...(init.auth ? authHeaders() : {}),
    ...((init.headers as Record<string, string>) ?? {}),
  };
  const res = await fetch(`${API_URL}${path}`, { ...init, headers });
  if (!res.ok) {
    const body = await res.text();
    throw new ApiError(res.status, body || res.statusText);
  }
  return (await res.json()) as T;
}

// ─── Mocks ──────────────────────────────────────────────────────────────────

interface MockUser {
  user_id: string;
  email_hash: string;
  public_key: string;
  display_name: string | null;
  domain: Domain;
  risk_level: RiskLevel;
  created_at: string;
  verified: boolean;
}
interface MockDeclaration {
  declaration_id: string;
  user_id: string;
  content_hash: string;
  ipfs_cid: string;
  signature: string;
  is_public: boolean;
  timestamp_token: string;
  blockchain_tx: string;
  created_at: string;
  verifications: DeclarationVerification[];
}
interface MockCheckin {
  last_checkin: string;
  next_due: string;
  interval_days: number;
}

const MOCK = {
  users: "consta-mock:users",
  declarations: "consta-mock:declarations",
  checkins: "consta-mock:checkins",
  contacts: "consta-mock:contacts",
  verifications: "consta-mock:verifications",
};

function readArr<T>(key: string): T[] {
  if (typeof window === "undefined") return [];
  try {
    return JSON.parse(localStorage.getItem(key) ?? "[]") as T[];
  } catch {
    return [];
  }
}
function writeArr<T>(key: string, value: T[]) {
  if (typeof window === "undefined") return;
  localStorage.setItem(key, JSON.stringify(value));
}
function readMap<T>(key: string): Record<string, T> {
  if (typeof window === "undefined") return {};
  try {
    return JSON.parse(localStorage.getItem(key) ?? "{}") as Record<string, T>;
  } catch {
    return {};
  }
}
function writeMap<T>(key: string, value: Record<string, T>) {
  if (typeof window === "undefined") return;
  localStorage.setItem(key, JSON.stringify(value));
}

function uuid(): string {
  if (typeof crypto !== "undefined" && "randomUUID" in crypto) {
    return crypto.randomUUID();
  }
  return "uuid-" + Math.random().toString(36).slice(2, 12);
}

function nowIso() {
  return new Date().toISOString();
}

function addDays(date: Date, days: number) {
  const d = new Date(date);
  d.setDate(d.getDate() + days);
  return d;
}

function seedDemoData() {
  if (typeof window === "undefined") return;
  if (localStorage.getItem("consta-mock:seeded") === "1") return;

  const demoUser: MockUser = {
    user_id: "demo-user-maria",
    email_hash: "demo-email-hash",
    public_key: "demo-public-key-base64",
    display_name: "María Solís",
    domain: "periodista",
    risk_level: "alto",
    verified: true,
    created_at: addDays(new Date(), -45).toISOString(),
  };
  writeArr<MockUser>(MOCK.users, [demoUser]);

  const demoDecl: MockDeclaration = {
    declaration_id: "demo-declaration-1",
    user_id: demoUser.user_id,
    content_hash:
      "3b6f1a4b2c8c5e9d7a1f0e8b4d6c2a9f7e3d1b5c8a0f2e4d6b8c0a2e4f6d8b0a",
    ipfs_cid: "QmDemoConstaDeclaration1abcDEFghiJKLmnoPQRstuVWXyz12345",
    signature: "demo-signature-base64",
    is_public: true,
    timestamp_token: "RFC3161:demo-tsa-token-abc123",
    blockchain_tx:
      "0xdemoblockchaintx9f8e7d6c5b4a3210fedcba9876543210abcdef0123",
    verifications: [
      {
        type: "org",
        name: "Fundación por la Libertad de Prensa",
        at: addDays(new Date(), -40).toISOString(),
      },
      {
        type: "user",
        name: "Carlos Vega · @cvega",
        at: addDays(new Date(), -38).toISOString(),
      },
    ],
    created_at: addDays(new Date(), -45).toISOString(),
  };
  writeArr<MockDeclaration>(MOCK.declarations, [demoDecl]);

  // Sembrar el texto en el "IPFS mock"
  localStorage.setItem(
    "ipfs-mock:" + demoDecl.ipfs_cid,
    [
      "Yo, María Solís, periodista en Bogotá, declaro que no tengo intención",
      "de hacerme daño. Trabajo investigando casos de corrupción municipal y",
      "he recibido amenazas anónimas en las últimas dos semanas.",
      "",
      "Si algo me ocurre, que estas palabras sirvan como evidencia pública,",
      "fechada e inmutable, de mi voluntad y mi estado mental al momento de",
      "firmar este documento.",
    ].join("\n"),
  );

  const checkins = readMap<MockCheckin>(MOCK.checkins);
  checkins[demoUser.user_id] = {
    last_checkin: addDays(new Date(), -5).toISOString(),
    next_due: addDays(new Date(), 25).toISOString(),
    interval_days: 30,
  };
  writeMap(MOCK.checkins, checkins);

  localStorage.setItem("consta-mock:seeded", "1");
}

function ensureSeeded() {
  if (USE_MOCKS) seedDemoData();
}

// ─── Endpoints ──────────────────────────────────────────────────────────────

export async function register(body: RegisterBody): Promise<RegisterResponse> {
  if (!USE_MOCKS) {
    return request<RegisterResponse>("/auth/register", {
      method: "POST",
      body: JSON.stringify(body),
    });
  }
  ensureSeeded();
  const users = readArr<MockUser>(MOCK.users);
  if (users.some((u) => u.email_hash === body.email_hash)) {
    throw new ApiError(409, "Ese email ya está registrado.");
  }
  const user: MockUser = {
    user_id: uuid(),
    email_hash: body.email_hash,
    public_key: body.public_key,
    display_name: body.display_name,
    domain: body.domain,
    risk_level: body.risk_level,
    verified: false,
    created_at: nowIso(),
  };
  writeArr(MOCK.users, [...users, user]);
  return { user_id: user.user_id, created_at: user.created_at };
}

export async function login(body: LoginBody): Promise<LoginResponse> {
  if (!USE_MOCKS) {
    return request<LoginResponse>("/auth/login", {
      method: "POST",
      body: JSON.stringify(body),
    });
  }
  ensureSeeded();
  const users = readArr<MockUser>(MOCK.users);
  const user = users.find((u) => u.email_hash === body.email_hash);
  if (!user) throw new ApiError(404, "Usuario no encontrado.");
  return {
    session_token: `mock-jwt.${user.user_id}.${Date.now()}`,
    expires_at: addDays(new Date(), 7).toISOString(),
  };
}

export async function challenge(body: ChallengeBody): Promise<ChallengeResponse> {
  return request<ChallengeResponse>("/auth/challenge", {
    method: "POST",
    body: JSON.stringify(body),
  });
}

export async function verify(body: VerifyBody): Promise<VerifyResponse> {
  return request<VerifyResponse>("/auth/verify", {
    method: "POST",
    body: JSON.stringify(body),
  });
}

export async function createDeclaration(
  body: CreateDeclarationBody,
): Promise<CreateDeclarationResponse> {
  if (!USE_MOCKS) {
    return request<CreateDeclarationResponse>("/declarations", {
      method: "POST",
      body: JSON.stringify(body),
      auth: true,
    });
  }
  ensureSeeded();
  const userId = getCurrentUserId();
  if (!userId) throw new ApiError(401, "Sesión requerida.");
  const decl: MockDeclaration = {
    declaration_id: uuid(),
    user_id: userId,
    content_hash: body.content_hash,
    ipfs_cid: body.ipfs_cid,
    signature: body.signature,
    is_public: body.is_public,
    timestamp_token: `RFC3161:mock-${Date.now()}`,
    blockchain_tx: `0xmock${Date.now().toString(16).padStart(60, "0")}`,
    verifications: [],
    created_at: nowIso(),
  };
  const all = readArr<MockDeclaration>(MOCK.declarations);
  writeArr(MOCK.declarations, [...all, decl]);
  return {
    declaration_id: decl.declaration_id,
    timestamp_token: decl.timestamp_token,
    blockchain_tx: decl.blockchain_tx,
    created_at: decl.created_at,
  };
}

export async function listDeclarations(): Promise<ListDeclarationsResponse> {
  if (!USE_MOCKS) {
    return request<ListDeclarationsResponse>("/declarations");
  }
  ensureSeeded();
  const decls = readArr<MockDeclaration>(MOCK.declarations).filter(d => d.is_public);
  const users = readArr<MockUser>(MOCK.users);
  return {
    declarations: decls
      .slice()
      .reverse()
      .map(d => {
        const user = users.find(u => u.user_id === d.user_id);
        return {
          id: d.declaration_id,
          user_display: user?.display_name ?? "Anónimo",
          domain: user?.domain ?? "otro",
          risk_level: user?.risk_level ?? "bajo",
          blockchain_confirmed: false,
          verification_count: d.verifications.filter(v => v.type !== "user").length,
          created_at: d.created_at,
        };
      }),
  };
}

export type BitcoinStatusResponse =
  | { status: "confirmed"; block_height: number }
  | { status: "pending"; error?: string }
  | { status: "none" };

export async function getBitcoinStatus(id: string): Promise<BitcoinStatusResponse> {
  if (!USE_MOCKS) {
    return request<BitcoinStatusResponse>(
      `/declarations/${encodeURIComponent(id)}/bitcoin-status`,
    );
  }
  return { status: "pending" };
}

export async function verifyDeclaration(
  id: string,
): Promise<VerifyDeclarationResponse> {
  if (!USE_MOCKS) {
    return request<VerifyDeclarationResponse>(
      `/declarations/${encodeURIComponent(id)}/verify`,
    );
  }
  ensureSeeded();
  const decls = readArr<MockDeclaration>(MOCK.declarations);
  const decl = decls.find((d) => d.declaration_id === id);
  if (!decl || !decl.is_public) {
    throw new ApiError(404, "Declaración no encontrada o privada.");
  }
  const users = readArr<MockUser>(MOCK.users);
  const user = users.find((u) => u.user_id === decl.user_id);
  return {
    declaration_id: decl.declaration_id,
    user_display: user?.display_name ?? "Anónimo",
    domain: user?.domain ?? "otro",
    content_hash: decl.content_hash,
    ipfs_cid: decl.ipfs_cid,
    timestamp_token: decl.timestamp_token,
    blockchain_tx: decl.blockchain_tx,
    blockchain_confirmed: false,
    created_at: decl.created_at,
    verifications: decl.verifications,
  };
}

export async function checkin(body: CheckinBody): Promise<CheckinResponse> {
  if (!USE_MOCKS) {
    return request<CheckinResponse>("/checkin", {
      method: "POST",
      body: JSON.stringify(body),
      auth: true,
    });
  }
  ensureSeeded();
  const userId = getCurrentUserId();
  if (!userId) throw new ApiError(401, "Sesión requerida.");
  const next = addDays(new Date(), body.interval_days).toISOString();
  const checkins = readMap<MockCheckin>(MOCK.checkins);
  checkins[userId] = {
    last_checkin: nowIso(),
    next_due: next,
    interval_days: body.interval_days,
  };
  writeMap(MOCK.checkins, checkins);
  return { next_checkin_due: next, alert_sent: false };
}

export async function createContact(
  body: CreateContactBody,
): Promise<CreateContactResponse> {
  if (!USE_MOCKS) {
    return request<CreateContactResponse>("/contacts", {
      method: "POST",
      body: JSON.stringify(body),
      auth: true,
    });
  }
  ensureSeeded();
  const userId = getCurrentUserId();
  if (!userId) throw new ApiError(401, "Sesión requerida.");
  const map = readMap<ContactItem[]>(MOCK.contacts);
  const list = map[userId] ?? [];
  const contact: ContactItem = {
    id: uuid(),
    contact_name: body.contact_name,
    contact_info: body.contact_info,
    confirmed: false,
    created_at: nowIso(),
  };
  map[userId] = [...list, contact];
  writeMap(MOCK.contacts, map);
  return { contact_id: contact.id, confirmed: false };
}

export async function listContacts(): Promise<ListContactsResponse> {
  if (!USE_MOCKS) {
    return request<ListContactsResponse>("/contacts", { auth: true });
  }
  ensureSeeded();
  const userId = getCurrentUserId();
  if (!userId) throw new ApiError(401, "Sesión requerida.");
  const map = readMap<ContactItem[]>(MOCK.contacts);
  return { contacts: map[userId] ?? [] };
}

export interface ConfirmContactResponse {
  confirmed: boolean;
  contact_name: string | null;
}

export async function confirmContact(
  token: string,
): Promise<ConfirmContactResponse> {
  return request<ConfirmContactResponse>("/contacts/confirm", {
    method: "POST",
    body: JSON.stringify({ token }),
  });
}

export async function getPublicProfile(
  id: string,
): Promise<PublicProfileResponse> {
  if (!USE_MOCKS) {
    return request<PublicProfileResponse>(
      `/users/${encodeURIComponent(id)}/public`,
    );
  }
  ensureSeeded();
  const users = readArr<MockUser>(MOCK.users);
  const user = users.find((u) => u.user_id === id);
  if (!user) throw new ApiError(404, "Usuario no encontrado.");
  const decls = readArr<MockDeclaration>(MOCK.declarations)
    .filter((d) => d.user_id === id && d.is_public)
    .map((d) => ({ id: d.declaration_id, created_at: d.created_at }));
  const checkins = readMap<MockCheckin>(MOCK.checkins);
  const ck = checkins[id];
  return {
    user_id: user.user_id,
    display_name: user.display_name,
    domain: user.domain,
    risk_level: user.risk_level,
    verified: user.verified,
    declarations: decls,
    last_checkin: ck?.last_checkin ?? null,
    next_due: ck?.next_due ?? null,
  };
}

export async function requestVerification(
  body: RequestVerificationBody,
): Promise<RequestVerificationResponse> {
  if (!USE_MOCKS) {
    return request<RequestVerificationResponse>("/verifications", {
      method: "POST",
      body: JSON.stringify(body),
      auth: true,
    });
  }
  ensureSeeded();
  const userId = getCurrentUserId();
  if (!userId) throw new ApiError(401, "Sesión requerida.");
  const map = readMap<MyVerificationItem[]>(MOCK.verifications);
  const list = map[userId] ?? [];
  const verifier_name =
    body.verifier_type === "org"
      ? (body.org_name ?? "Organización aliada")
      : "Verificación biométrica local";
  const item: MyVerificationItem = {
    id: uuid(),
    verifier_type: body.verifier_type,
    verifier_name,
    // El video queda inmediatamente "verificado" porque la verificación es la
    // propia grabación. Los demás quedan pendientes hasta que respondan.
    status: body.verifier_type === "video" ? "verified" : "pending",
    created_at: nowIso(),
  };
  map[userId] = [...list, item];
  writeMap(MOCK.verifications, map);
  return {
    verification_id: item.id,
    status: item.status,
    created_at: item.created_at,
  };
}

export async function getMyVerifications(): Promise<MyVerificationsResponse> {
  if (!USE_MOCKS) {
    return request<MyVerificationsResponse>("/verifications/mine", { auth: true });
  }
  ensureSeeded();
  const userId = getCurrentUserId();
  if (!userId) throw new ApiError(401, "Sesión requerida.");
  const map = readMap<MyVerificationItem[]>(MOCK.verifications);
  return { verifications: map[userId] ?? [] };
}

// Útil para que el demo arranque ya con un usuario y declaración sembrados.
export function ensureDemoSeeded() {
  ensureSeeded();
}

// A local "unlock" gate backed by the platform authenticator (Face ID / Touch ID /
// fingerprint) via WebAuthn. This is a VISIBILITY gate, not encryption — the data
// still reaches the browser. It stops someone glancing at or picking up your phone.

const CRED_KEY = "haru.reflock.cred";
const UID_KEY = "haru.reflock.uid";
const ON_KEY = "haru.reflock.on";
const SESSION_KEY = "haru.reflock.session";

function b64urlToBuf(s: string): ArrayBuffer {
  const pad = s.length % 4 ? "=".repeat(4 - (s.length % 4)) : "";
  const b64 = (s + pad).replace(/-/g, "+").replace(/_/g, "/");
  const bin = atob(b64);
  const out = new Uint8Array(bin.length);
  for (let i = 0; i < bin.length; i++) out[i] = bin.charCodeAt(i);
  return out.buffer;
}
function bufToB64url(buf: ArrayBuffer): string {
  const bin = String.fromCharCode(...new Uint8Array(buf));
  return btoa(bin).replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, "");
}
function randBuf(n: number): ArrayBuffer {
  const a = new Uint8Array(n);
  crypto.getRandomValues(a);
  return a.buffer;
}

export function biometricSupported(): boolean {
  return (
    typeof window !== "undefined" &&
    typeof window.PublicKeyCredential !== "undefined" &&
    !!navigator.credentials
  );
}

export function lockEnabled(): boolean {
  try {
    return localStorage.getItem(ON_KEY) === "1" && !!localStorage.getItem(CRED_KEY);
  } catch {
    return false;
  }
}

export function unlockedThisSession(): boolean {
  try {
    return sessionStorage.getItem(SESSION_KEY) === "1";
  } catch {
    return false;
  }
}

/** Register the platform authenticator and turn the lock on. */
export async function enableLock(): Promise<void> {
  let uid: ArrayBuffer;
  try {
    const existing = localStorage.getItem(UID_KEY);
    uid = existing ? b64urlToBuf(existing) : randBuf(16);
    if (!existing) localStorage.setItem(UID_KEY, bufToB64url(uid));
  } catch {
    uid = randBuf(16);
  }

  const cred = (await navigator.credentials.create({
    publicKey: {
      challenge: randBuf(32),
      rp: { name: "Haru", id: location.hostname },
      user: { id: uid, name: "haru-reference", displayName: "Haru Reference" },
      pubKeyCredParams: [
        { type: "public-key", alg: -7 },
        { type: "public-key", alg: -257 },
      ],
      authenticatorSelection: {
        authenticatorAttachment: "platform",
        userVerification: "required",
        residentKey: "preferred",
      },
      timeout: 60000,
    },
  })) as PublicKeyCredential | null;

  if (!cred) throw new Error("no credential");
  localStorage.setItem(CRED_KEY, bufToB64url(cred.rawId));
  localStorage.setItem(ON_KEY, "1");
  sessionStorage.setItem(SESSION_KEY, "1"); // just set it — count enrolling as unlocked
}

/** Prompt Face ID / Touch ID; on success, mark this session unlocked. */
export async function unlock(): Promise<boolean> {
  let id: ArrayBuffer;
  try {
    id = b64urlToBuf(localStorage.getItem(CRED_KEY) || "");
  } catch {
    return false;
  }
  if (!id.byteLength) return false;

  const assertion = await navigator.credentials.get({
    publicKey: {
      challenge: randBuf(32),
      allowCredentials: [{ type: "public-key", id }],
      userVerification: "required",
      timeout: 60000,
    },
  });
  if (!assertion) return false;
  try {
    sessionStorage.setItem(SESSION_KEY, "1");
  } catch {
    /* ignore */
  }
  return true;
}

export function disableLock(): void {
  try {
    localStorage.removeItem(CRED_KEY);
    localStorage.removeItem(ON_KEY);
    sessionStorage.removeItem(SESSION_KEY);
  } catch {
    /* ignore */
  }
}

export function relock(): void {
  try {
    sessionStorage.removeItem(SESSION_KEY);
  } catch {
    /* ignore */
  }
}

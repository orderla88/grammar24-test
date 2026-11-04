// JS/db.js

const DB_NAME = "grammar24idb";
const DB_VERSION = 1;
window.keyRefreshPromise = window.keyRefreshPromise || null;


// Set up IndexedDB
export async function initDB() {
  return new Promise((resolve, reject) => {
    const request = indexedDB.open(DB_NAME, DB_VERSION);

    request.onupgradeneeded = (event) => {
      const db = event.target.result;

      if (!db.objectStoreNames.contains("keys")) {
        db.createObjectStore("keys", { keyPath: "id" });
      }
      if (!db.objectStoreNames.contains("meta")) {
        db.createObjectStore("meta", { keyPath: "name" });
      }
    };

    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(request.error);
  });
}

// Save CryptoKey + Version
export async function saveKeyAndVersion(cryptoKey, version) {
  const db = await initDB();
  const tx = db.transaction(["keys", "meta"], "readwrite");

  tx.objectStore("keys").put({ id: "current", cryptoKey });
  tx.objectStore("meta").put({ name: "keyVersion", value: version });
  tx.objectStore("meta").put({ name: "timestamp", value: new Date().toISOString() });

  return new Promise((resolve, reject) => {
    tx.oncomplete = resolve;
    tx.onerror = reject;
  });
}

// Load CryptoKey + Version
export async function loadKeyAndVersion() {
  const db = await initDB();
  const tx = db.transaction(["keys", "meta"], "readonly");

  const keyReq = tx.objectStore("keys").get("current");
  const versionReq = tx.objectStore("meta").get("keyVersion");

  return new Promise((resolve) => {
    tx.oncomplete = () => {
      resolve({
        cryptoKey: keyReq.result?.cryptoKey || null,
        keyVersion: versionReq.result?.value || null
      });
    };
  });
}

// Get key version
export async function getKeyVersion() {
  const db = await initDB();
  return new Promise((resolve) => {
    const tx = db.transaction("meta", "readonly");
    const req = tx.objectStore("meta").get("keyVersion");
    tx.oncomplete = () => resolve(req.result?.value || null);
  });
}

// Get and check local JWT

function decodeJwtPayload(jwt) {
  const base64Url = jwt.split(".")[1];
  const base64 = base64Url
    .replace(/-/g, "+")
    .replace(/_/g, "/");
  return JSON.parse(atob(base64));
}

export function checkToken() {
  const jwt = localStorage.getItem("jwt");
  if (!jwt) return null;
  try {
    const payload = decodeJwtPayload(jwt);
    if (!payload.premium) return null;
    if (Date.now() / 1000 > payload.exp) return null;
    return jwt;
  }
  catch {
    return null;
  }
}

export async function refreshKey(jwt) {

  // somebody already refreshing?
  if (window.keyRefreshPromise) {
    console.log("Waiting for existing key refresh...");
    return window.keyRefreshPromise;
  }

  window.keyRefreshPromise = (async () => {
    try {
      const buffer = await fetch("/premium/key", {
        headers: {Authorization: `Bearer ${jwt}`}
      }).then(r => {
        if (!r.ok) {
          throw new Error(`HTTP ${r.status}`);
        }
        return r.arrayBuffer();
      });

      const bytes = new Uint8Array(buffer);
      const keyVersion = bytes[0];
      const keyBytes = bytes.slice(1);
      const cryptoKey = await crypto.subtle.importKey(
        "raw",
        keyBytes,
        { name: "AES-GCM" },
        false,
        ["decrypt"]
      );

      await saveKeyAndVersion(
        cryptoKey,
        keyVersion
      );

      console.log(
        `Updated to key version ${keyVersion}`
      );

      return cryptoKey;
    }
    finally {
      window.keyRefreshPromise = null;
    }
  })();

  return window.keyRefreshPromise;
}

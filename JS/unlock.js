// JS/unlock.js
// Import IndexDB functions
import { loadKeyAndVersion, refreshKey, checkToken, getKeyVersion } from "./utility.js";
// Global cache object
window.premiumCache = window.premiumCache || {};


async function unlockMain(url, jwt) {
// If cached, reuse
  const cached = window.premiumCache[url];
  const currentVersion = await getKeyVersion();

  if (
    cached &&
    cached.keyVersion === currentVersion
  ) {
    document.querySelector("main").innerHTML = cached.html;
    console.log(`Loaded cached content for ${url}`);
    return;
  }
  delete window.premiumCache[url];

  // Otherwise fetch + decrypt as before... 
  const res = await fetch(url);
  const blob = await res.arrayBuffer();
  const bytes = new Uint8Array(blob);
  const keyVersion = bytes[0];
  const iv = bytes.slice(1, 13);
  const ciphertext = blob.slice(13);

  // Load cached key + version
  const { cryptoKey: cachedKey, keyVersion: storedVersion } = await loadKeyAndVersion();
  let cryptoKey = cachedKey;
  try {
    if (!cryptoKey || storedVersion !== keyVersion) {
    console.log("Key mismatch or missing, requesting new key...");
    cryptoKey = await refreshKey(jwt);
  }
  // Attempt decryption
    const plaintext = await crypto.subtle.decrypt(
      { name: "AES-GCM", iv },
      cryptoKey,
      ciphertext
    );
    const dec = new TextDecoder();
    const mainContent = dec.decode(plaintext);
    window.premiumCache[url] = {keyVersion, html: mainContent};
    document.querySelector("main").innerHTML = mainContent;
  } catch (err) {
    console.error("Decryption failed:", err);
    document.querySelector("main").innerHTML =
      "<p>Check internet connection.</p>";
  }
}

async function autoUnlock() {
  
  const jwt = checkToken();
  if (!jwt) {
    console.log("User locked.");
    return;
  }

  // Detect current page filename → build .enc path
  const path = window.location.pathname;
  const filename = path.substring(path.lastIndexOf("/") + 1);
  const encFile = "/Premium-enc/" + filename.replace(".html", ".enc");

  await unlockMain(encFile, jwt);
}

document.addEventListener("DOMContentLoaded", autoUnlock);

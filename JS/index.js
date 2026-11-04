// JS/index.js
import { getKeyVersion, refreshKey, checkToken } from "./utility.js";

async function backgroundInit() {

  const jwt = checkToken();
  if (!jwt) {
    console.log("User locked.");
    return;
  }

  // Fetch one premium .enc file (e.g., glossary)
  const res = await fetch("/Premium-enc/glossary.enc");
  if (!res.ok) {
    console.warn("Could not check key version");
    return;
  }
  const blob = await res.arrayBuffer();
  // Read keyVersion (first byte)
  const keyVersion = new Uint8Array(blob)[0];

  // Compare with stored key version
  const storedVersion = await getKeyVersion();
  if (storedVersion !== keyVersion) {
    console.log("Rotation mismatch, requesting new key...");

  // Get new key
   await refreshKey(jwt);
  } else {
    console.log("Key version matches, no backend hit.");
  }
}

document.addEventListener("DOMContentLoaded", backgroundInit);

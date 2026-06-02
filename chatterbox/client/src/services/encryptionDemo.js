/**
 * Purpose: Browser Web Crypto demo helpers for non-production client-side encryption.
 */

const textEncoder = new TextEncoder();
const textDecoder = new TextDecoder();

const bytesToBase64 = (bytes) => btoa(String.fromCharCode(...bytes));
const base64ToBytes = (value) => Uint8Array.from(atob(value), (char) => char.charCodeAt(0));
const keyStorageName = (conversationId) => `chatterbox.demoKey.${conversationId}`;

const getSubtle = () => globalThis.crypto?.subtle;

export const hasDemoKey = (conversationId) => Boolean(localStorage.getItem(keyStorageName(conversationId)));

export const ensureDemoKey = async (conversationId) => {
  const existingKey = localStorage.getItem(keyStorageName(conversationId));

  if (existingKey) {
    return existingKey;
  }

  if (!getSubtle()) {
    const fallbackKey = bytesToBase64(crypto.getRandomValues(new Uint8Array(32)));
    localStorage.setItem(keyStorageName(conversationId), fallbackKey);
    return fallbackKey;
  }

  const key = await crypto.subtle.generateKey({ length: 256, name: 'AES-GCM' }, true, ['encrypt', 'decrypt']);
  const rawKey = new Uint8Array(await crypto.subtle.exportKey('raw', key));
  const encodedKey = bytesToBase64(rawKey);
  localStorage.setItem(keyStorageName(conversationId), encodedKey);
  return encodedKey;
};

const importDemoKey = async (encodedKey) =>
  crypto.subtle.importKey('raw', base64ToBytes(encodedKey), { name: 'AES-GCM' }, false, ['encrypt', 'decrypt']);

export const encryptDemoMessage = async (conversationId, plaintext) => {
  if (!plaintext.trim()) {
    return { ciphertext: plaintext, metadata: null };
  }

  const encodedKey = await ensureDemoKey(conversationId);

  if (!getSubtle()) {
    return {
      ciphertext: btoa(unescape(encodeURIComponent(plaintext))),
      metadata: {
        algorithm: 'base64-demo-fallback',
        demoWarning: 'Fallback demo encoding only; Web Crypto was unavailable.',
        iv: ''
      }
    };
  }

  const iv = crypto.getRandomValues(new Uint8Array(12));
  const key = await importDemoKey(encodedKey);
  const encrypted = await crypto.subtle.encrypt({ iv, name: 'AES-GCM' }, key, textEncoder.encode(plaintext));

  return {
    ciphertext: bytesToBase64(new Uint8Array(encrypted)),
    metadata: {
      algorithm: 'AES-GCM',
      demoWarning: 'Portfolio demo only; localStorage key storage is not production-grade E2EE.',
      iv: bytesToBase64(iv)
    }
  };
};

export const decryptDemoMessage = async (conversationId, message) => {
  if (!message?.isEncrypted || !message.content) {
    return message;
  }

  const encodedKey = localStorage.getItem(keyStorageName(conversationId));
  if (!encodedKey) {
    return { ...message, content: '[Encrypted message - key unavailable]' };
  }

  if (message.encryptionMetadata?.algorithm === 'base64-demo-fallback' || !getSubtle()) {
    return { ...message, content: decodeURIComponent(escape(atob(message.content))) };
  }

  const key = await importDemoKey(encodedKey);
  const decrypted = await crypto.subtle.decrypt(
    {
      iv: base64ToBytes(message.encryptionMetadata.iv),
      name: 'AES-GCM'
    },
    key,
    base64ToBytes(message.content)
  );

  return { ...message, content: textDecoder.decode(decrypted) };
};

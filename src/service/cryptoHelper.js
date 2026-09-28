const CryptoJS = require('crypto-js');
require('dotenv').config();

const secretKey =
  process.env.API_ENCRYPTION_KEY ||
  process.env.RESPONSE_ENCRYPTION_KEY ||
  process.env.CRYPTO_SECRET ||
  '';

if (!secretKey) {
}

/**
 * Standard AES-256-CBC encryption using dynamic salt & IV per invocation.
 */
function encrypt(data) {
  if (data === null || data === undefined) return data;
  if (!secretKey) {
    return typeof data === 'string' ? data : JSON.stringify(data);
  }
  try {
    const jsonString = typeof data === 'string' ? data : JSON.stringify(data);
    return CryptoJS.AES.encrypt(jsonString, secretKey).toString();
  } catch (err) {
    return '';
  }
}

/**
 * Decrypts AES-256-CBC ciphertext into original JSON object or string.
 */
function decrypt(cipherText) {
  if (cipherText === null || cipherText === undefined) return null;
  if (typeof cipherText === 'object') return cipherText;
  if (typeof cipherText !== 'string' || !cipherText.trim()) return cipherText;

  if (!secretKey) {
    try {
      return JSON.parse(cipherText);
    } catch {
      return cipherText;
    }
  }

  try {
    const bytes = CryptoJS.AES.decrypt(cipherText.trim(), secretKey);
    const decryptedString = bytes.toString(CryptoJS.enc.Utf8);
    if (!decryptedString) {
      try {
        return JSON.parse(cipherText);
      } catch {
        return null;
      }
    }
    try {
      return JSON.parse(decryptedString);
    } catch {
      return decryptedString;
    }
  } catch (err) {
    return null;
  }
}

module.exports = { encrypt, decrypt, secretKey };

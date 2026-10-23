
const crypto = require("crypto");

const ALGORITHM = "aes-256-gcm";
const KEY_VERSION = "v1";

function getEncryptionKey() {
  const keyHex = process.env.MESSAGE_ENCRYPTION_KEY;

  if (!keyHex || !/^[0-9a-fA-F]{64}$/.test(keyHex)) {
    throw new Error(
      "MESSAGE_ENCRYPTION_KEY must be a 64-character hexadecimal string."
    );
  }

  return Buffer.from(keyHex, "hex");
}

function encryptMessage(plaintext) {
  if (typeof plaintext !== "string" || plaintext.length === 0) {
    throw new Error("Message content must be a non-empty string.");
  }

  const key = getEncryptionKey();
  const iv = crypto.randomBytes(12);
  const cipher = crypto.createCipheriv(ALGORITHM, key, iv);

  const encrypted = Buffer.concat([
    cipher.update(plaintext, "utf8"),
    cipher.final(),
  ]);

  return {
    encryptedContent: encrypted.toString("base64"),
    iv: iv.toString("base64"),
    authTag: cipher.getAuthTag().toString("base64"),
    keyVersion: KEY_VERSION,
  };
}

function decryptMessage(encryptedData) {
  const key = getEncryptionKey();

  if (!encryptedData || encryptedData.keyVersion !== KEY_VERSION) {
    throw new Error("Unsupported encryption key version.");
  }

  const decipher = crypto.createDecipheriv(
    ALGORITHM,
    key,
    Buffer.from(encryptedData.iv, "base64")
  );

  decipher.setAuthTag(Buffer.from(encryptedData.authTag, "base64"));

  const decrypted = Buffer.concat([
    decipher.update(Buffer.from(encryptedData.encryptedContent, "base64")),
    decipher.final(),
  ]);

  return decrypted.toString("utf8");
}

module.exports = { encryptMessage, decryptMessage };

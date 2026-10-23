
require("dotenv").config();

const {
  encryptMessage,
  decryptMessage,
} = require("./src/utils/encryption");

const original = "Hello from the real-time chat application!";

const encrypted = encryptMessage(original);
const decrypted = decryptMessage(encrypted);

console.log("Encryption test:", encrypted.encryptedContent !== original);
console.log("Decryption test:", decrypted === original);
console.log("Encrypted fields:", Object.keys(encrypted));

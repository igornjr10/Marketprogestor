"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.encrypt = encrypt;
exports.decrypt = decrypt;
const crypto_1 = require("crypto");
const ALGORITHM = 'aes-256-gcm';
const IV_LENGTH = 12;
const TAG_LENGTH = 16;
function getKey() {
    const hex = process.env['ENCRYPTION_KEY'];
    if (!hex || hex.length !== 64) {
        throw new Error('ENCRYPTION_KEY must be set to 64 hex characters (32 bytes)');
    }
    return Buffer.from(hex, 'hex');
}
function encrypt(plaintext) {
    const key = getKey();
    const iv = (0, crypto_1.randomBytes)(IV_LENGTH);
    const cipher = (0, crypto_1.createCipheriv)(ALGORITHM, key, iv);
    const encrypted = Buffer.concat([cipher.update(plaintext, 'utf8'), cipher.final()]);
    const tag = cipher.getAuthTag();
    return `${iv.toString('hex')}:${tag.toString('hex')}:${encrypted.toString('hex')}`;
}
function decrypt(ciphertext) {
    const parts = ciphertext.split(':');
    if (parts.length !== 3)
        throw new Error('Invalid ciphertext format');
    const [ivHex, tagHex, dataHex] = parts;
    const key = getKey();
    const decipher = (0, crypto_1.createDecipheriv)(ALGORITHM, key, Buffer.from(ivHex, 'hex'));
    decipher.setAuthTag(Buffer.from(tagHex, 'hex'));
    const decrypted = Buffer.concat([
        decipher.update(Buffer.from(dataHex, 'hex')),
        decipher.final(),
    ]);
    return decrypted.toString('utf8');
}

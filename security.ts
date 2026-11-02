// crypto-demo.ts
// Run with:  npx ts-node crypto-demo.ts
// (or compile with tsc and run the JS)

import crypto from 'node:crypto';

/* =============================================================
 * 1. HASHING
 * ============================================================= */

// 1a. Hash WITHOUT salt — good for content integrity / checksums.
//     NEVER use this for passwords.
function hashSha256(input: string): string {
  return crypto.createHash('sha256').update(input, 'utf8').digest('hex');
}

// 1b. Hash WITH salt + configurable cost ("salt rounds").
//     Native Node has no bcrypt, so we use scrypt, which is stronger
//     and built-in. `saltRounds` here is the log2 of scrypt's cost N
//     (bcrypt-style naming, since that's the vocabulary you asked for).
//     In production, prefer argon2id or bcrypt if you want that exact API.
function hashPassword(password: string, saltRounds = 14): string {
  const salt = crypto.randomBytes(16);                 // unique per password
  const N = 2 ** saltRounds;                           // cost = 2^saltRounds
  const hash = crypto.scryptSync(password, salt, 64, { N, r: 8, p: 1 });
  // Store algorithm + params + salt + hash together:
  return `scrypt$${saltRounds}$${salt.toString('hex')}$${hash.toString('hex')}`;
}

function verifyPassword(password: string, stored: string): boolean {
  const [algo, roundsStr, saltHex, hashHex] = stored.split('$');
  if (algo !== 'scrypt') return false;

  const N = 2 ** Number(roundsStr);
  const salt = Buffer.from(saltHex, 'hex');
  const expected = Buffer.from(hashHex, 'hex');
  const actual = crypto.scryptSync(password, salt, expected.length, { N, r: 8, p: 1 });

  // Constant-time compare — prevents timing attacks
  return crypto.timingSafeEqual(actual, expected);
}

/* =============================================================
 * 2. SYMMETRIC ENCRYPTION (AES-256-GCM)
 *    GCM gives you confidentiality AND integrity (auth tag).
 * ============================================================= */

interface EncryptedPayload {
  iv: string;    // 12-byte initialization vector (hex)
  tag: string;   // 16-byte GCM auth tag (hex)
  data: string;  // ciphertext (hex)
}

function generateSymmetricKey(): Buffer {
  return crypto.randomBytes(32); // 256-bit key — store in KMS/env, never commit
}

function encryptSymmetric(plaintext: string, key: Buffer): EncryptedPayload {
  const iv = crypto.randomBytes(12); // 96-bit IV is the GCM standard
  const cipher = crypto.createCipheriv('aes-256-gcm', key, iv);
  const data = Buffer.concat([cipher.update(plaintext, 'utf8'), cipher.final()]);
  return {
    iv: iv.toString('hex'),
    tag: cipher.getAuthTag().toString('hex'),
    data: data.toString('hex'),
  };
}

function decryptSymmetric(payload: EncryptedPayload, key: Buffer): string {
  const decipher = crypto.createDecipheriv(
    'aes-256-gcm',
    key,
    Buffer.from(payload.iv, 'hex'),
  );
  decipher.setAuthTag(Buffer.from(payload.tag, 'hex')); // will throw if tampered
  const plaintext = Buffer.concat([
    decipher.update(Buffer.from(payload.data, 'hex')),
    decipher.final(),
  ]);
  return plaintext.toString('utf8');
}

/* =============================================================
 * 3. ASYMMETRIC KEY PAIR
 *    In practice use TWO key pairs: one for encryption, one for
 *    signing (different lifecycle and permissions).
 * ============================================================= */

interface KeyPair {
  publicKey: string;
  privateKey: string;
}

function generateRsaKeyPair(): KeyPair {
  const { publicKey, privateKey } = crypto.generateKeyPairSync('rsa', {
    modulusLength: 2048, // use 3072+ for new systems
    publicKeyEncoding:  { type: 'spki',  format: 'pem' },
    privateKeyEncoding: { type: 'pkcs8', format: 'pem' },
  });
  return { publicKey, privateKey };
}

/* =============================================================
 * 4. PUBLIC ENCRYPT  →  PRIVATE DECRYPT  (RSA-OAEP)
 *    NOTE: RSA can only encrypt ~ (keySize - 2*hashSize - 2) bytes,
 *    e.g. ~190 bytes with 2048-bit RSA + SHA-256. For larger data,
 *    use hybrid encryption (see note at the bottom).
 * ============================================================= */

function encryptWithPublicKey(plaintext: string, publicKeyPem: string): Buffer {
  return crypto.publicEncrypt(
    {
      key: publicKeyPem,
      padding: crypto.constants.RSA_PKCS1_OAEP_PADDING,
      oaepHash: 'sha256',
    },
    Buffer.from(plaintext, 'utf8'),
  );
}

function decryptWithPrivateKey(ciphertext: Buffer, privateKeyPem: string): string {
  return crypto
    .privateDecrypt(
      {
        key: privateKeyPem,
        padding: crypto.constants.RSA_PKCS1_OAEP_PADDING,
        oaepHash: 'sha256',
      },
      ciphertext,
    )
    .toString('utf8');
}

/* =============================================================
 * 5. SIGN A MESSAGE  /  6. VERIFY A SIGNATURE  (RSA-PSS)
 *    Signing gives authenticity + integrity, NOT confidentiality.
 * ============================================================= */

function signMessage(message: string, privateKeyPem: string): Buffer {
  return crypto.sign(
    'sha256',
    Buffer.from(message, 'utf8'),
    {
      key: privateKeyPem,
      padding: crypto.constants.RSA_PKCS1_PSS_PADDING,
      saltLength: crypto.constants.RSA_PSS_SALTLEN_DIGEST,
    },
  );
}

function verifySignature(
  message: string,
  signature: Buffer,
  publicKeyPem: string,
): boolean {
  return crypto.verify(
    'sha256',
    Buffer.from(message, 'utf8'),
    {
      key: publicKeyPem,
      padding: crypto.constants.RSA_PKCS1_PSS_PADDING,
      saltLength: crypto.constants.RSA_PSS_SALTLEN_DIGEST,
    },
    signature,
  );
}

/* =============================================================
 * DEMO
 * ============================================================= */

function main() {
  console.log('\n===== 1. HASHING =====');
  const password = 'S3cret-Passw0rd!';

  console.log('SHA-256 (no salt):', hashSha256(password));

  const stored = hashPassword(password, 14);
  console.log('Stored (salted):  ', stored);
  console.log('Verify correct pwd:', verifyPassword(password, stored));        // true
  console.log('Verify wrong pwd:  ', verifyPassword('wrong-password', stored)); // false

  // Same password hashed twice → different output (unique salt)
  console.log('Two hashes differ: ', hashPassword(password) !== hashPassword(password));

  console.log('\n===== 2. SYMMETRIC (AES-256-GCM) =====');
  const symKey = generateSymmetricKey();
  const secret = 'This is a confidential message.';
  const enc = encryptSymmetric(secret, symKey);
  console.log('Ciphertext:', enc);
  console.log('Decrypted: ', decryptSymmetric(enc, symKey));

  // Tampering demo — flip one hex nibble of the ciphertext
  const tampered: EncryptedPayload = {
    ...enc,
    data: (enc.data[0] === 'a' ? 'b' : 'a') + enc.data.slice(1),
  };
  try {
    decryptSymmetric(tampered, symKey);
    console.log('⚠️  tampering NOT detected (should not happen)');
  } catch {
    console.log('✅ tampering detected (GCM auth tag failed)');
  }

  console.log('\n===== 3–6. ASYMMETRIC =====');
  const { publicKey, privateKey } = generateRsaKeyPair();

  // --- Public encrypt → Private decrypt ---
  const privateMsg = 'Only the private key holder can read this.';
  const rsaCipher = encryptWithPublicKey(privateMsg, publicKey);
  console.log('RSA ciphertext (base64):', rsaCipher.toString('base64'));
  console.log('Private-key decrypt:    ', decryptWithPrivateKey(rsaCipher, privateKey));

  // --- Sign → Verify ---
  const message = 'Transfer $100 to Alice.';
  const signature = signMessage(message, privateKey);
  console.log('Signature (base64):', signature.toString('base64'));
  console.log('Verify original:    ', verifySignature(message, signature, publicKey)); // true
  console.log('Verify tampered:    ', verifySignature(
    'Transfer $10000 to Alice.', signature, publicKey,
  )); // false
}

main();

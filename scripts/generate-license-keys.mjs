#!/usr/bin/env node
// Generates the Ed25519 key pair for license signing.
//   PRIVATE key → Firebase secret:  firebase functions:secrets:set LICENSE_PRIVATE_KEY
//   PUBLIC key  → app builds:       VITE_LICENSE_PUBLIC_KEY=<hex> in .env.production
// Keep the private key out of git and out of the apps.
import { generateKeyPairSync } from 'node:crypto';
const { privateKey, publicKey } = generateKeyPairSync('ed25519');
const seed = privateKey.export({ format: 'der', type: 'pkcs8' }).subarray(16).toString('hex');
const pub = publicKey.export({ format: 'der', type: 'spki' }).subarray(12).toString('hex');
console.log(`LICENSE_PRIVATE_KEY (secret, 32-byte seed hex):\n${seed}\n`);
console.log(`VITE_LICENSE_PUBLIC_KEY (put in app .env):\n${pub}`);

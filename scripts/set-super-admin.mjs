#!/usr/bin/env node
// One-time bootstrap of the first Super Admin (later ones can be added from the panel).
// Usage: GOOGLE_APPLICATION_CREDENTIALS=service-account.json node scripts/set-super-admin.mjs owner@example.com
import { initializeApp, applicationDefault } from 'firebase-admin/app';
import { getAuth } from 'firebase-admin/auth';
const email = process.argv[2];
if (!email) { console.error('usage: set-super-admin.mjs <email>'); process.exit(1); }
initializeApp({ credential: applicationDefault() });
const user = await getAuth().getUserByEmail(email);
await getAuth().setCustomUserClaims(user.uid, { ...(user.customClaims || {}), superAdmin: true });
console.log(`${email} is now a super admin. Sign out and in again to refresh the token.`);

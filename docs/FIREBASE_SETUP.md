# Firebase setup — what you need to provide

The apps work fully offline without this. Do these steps to enable cloud sync, cloud backup, online
licensing, push notifications and the Super Admin panel.

1. **Create a Firebase project** (Blaze plan — required for Cloud Functions and scheduled jobs).
2. Enable **Authentication → Email/Password**, **Firestore** (production mode, region e.g. `asia-south1`),
   **Storage**, **Cloud Messaging**.
3. Add a **Web app** → copy its config into `.env.production` (`VITE_FIREBASE_*`) and into GitHub
   Actions variables.
4. **License keys** (once):
   ```bash
   node scripts/generate-license-keys.mjs
   firebase functions:secrets:set LICENSE_PRIVATE_KEY   # paste the private seed
   ```
   Put the public key in `VITE_LICENSE_PUBLIC_KEY`. Keep the private key only in the Firebase secret.
   ⚠️ Changing the key pair invalidates all issued tokens (devices must re-activate).
5. **Deploy**: `firebase use <project-id>` then
   `firebase deploy --only firestore:rules,firestore:indexes,storage,functions,hosting`
   (run `npm run build:admin` first for hosting).
6. **First Super Admin**: create your account (sign up in the admin panel's Firebase Auth, or the shop
   app's Cloud page), then with a service-account key:
   `GOOGLE_APPLICATION_CREDENTIALS=sa.json node scripts/set-super-admin.mjs you@example.com`
7. **Android push (optional)**: add an Android app with package `com.digitaltarget.fabricpos`, download
   `google-services.json` → `android/app/`, set `VITE_ENABLE_PUSH=true`, rebuild.

## Onboarding a shop
Admin panel → Businesses → *New business* (owner email) → *Issue license* (validity, max devices for
Windows + Android combined) → give the key to the shop.
In the shop app: Cloud & License → sign in/create account with that email → enter key → Activate →
set a device invoice series (W1, A1 …) → turn on Cloud sync. The second device (e.g. Android) activates
with the same key and chooses "Use the business's cloud data".

Shops without internet: send the Device ID to the admin → Licenses → *Offline token* → paste the token in
Cloud & License → Offline activation.

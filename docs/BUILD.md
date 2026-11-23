# Build & release

Requirements: Node 22, npm. Android: JDK 21 + Android SDK 36. Windows installer: build on Windows
(or Linux with a working Wine).

## Configuration
Copy `.env.example` to `.env.production` and fill in the Firebase/licensing values (see
FIREBASE_SETUP.md). With no values the apps build as fully offline single-shop editions.

## Web / tests
```bash
npm install
npm test            # 44 unit tests
npm run e2e         # 9 Playwright scenarios (desktop + Android-size)
npm run build       # → dist/
```

## Windows
```bash
npm run electron:dev     # run the desktop app locally
npm run electron:dist    # → release/DT-Fabric-POS-Setup-3.0.0.exe + portable ZIP
```
Optional code signing: set `CSC_LINK` (base64 .pfx) and `CSC_KEY_PASSWORD`. Unsigned installers trigger
a Windows SmartScreen warning on first run.

## Android
```bash
npm run android:sync          # build web + copy into android/
cd android && ./gradlew assembleRelease   # → android/app/build/outputs/apk/release/app-release.apk
```
**Signing:** create a release keystore once and keep it safe — every future update must be signed with it.
```bash
keytool -genkeypair -v -keystore release.jks -alias dtpos -keyalg RSA -keysize 2048 -validity 10000
```
Then create `android/keystore.properties` (git-ignored):
```
storeFile=/absolute/path/release.jks
storePassword=…
keyAlias=dtpos
keyPassword=…
```
Push notifications additionally need `android/app/google-services.json` and `VITE_ENABLE_PUSH=true`.
For Play Store upload use `./gradlew bundleRelease` (AAB).

## Super Admin panel
```bash
npm run build:admin       # → dist-admin/
firebase deploy --only hosting
```

## Cloud backend
```bash
cd functions && npm install && npm test && cd ..
firebase deploy --only firestore:rules,firestore:indexes,storage,functions
```

## CI (GitHub Actions)
`.github/workflows/build.yml` runs tests, builds the web app and admin panel, the Windows installer on
`windows-latest` and the APK on Ubuntu, and attaches both to a GitHub Release when you push a `v*` tag.
Repository settings → Secrets and variables → Actions:
- Variables: `VITE_FIREBASE_*`, `VITE_LICENSE_PUBLIC_KEY`, `VITE_ENABLE_PUSH`
- Secrets: `ANDROID_KEYSTORE_BASE64`, `ANDROID_KEYSTORE_PASSWORD`, `ANDROID_KEY_ALIAS`, `ANDROID_KEY_PASSWORD`,
  `GOOGLE_SERVICES_JSON`, optional `CSC_LINK`, `CSC_KEY_PASSWORD`

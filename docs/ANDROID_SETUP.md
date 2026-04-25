# Lerna Android Setup

## Required tools

- Node.js 24+
- npm 11+
- JDK 21
- Android Studio with Android SDK Platform, Build-Tools, and Platform Tools
- `adb` on `PATH`

## Expected environment

- `JAVA_HOME` points to JDK 21
- `ANDROID_HOME` or `ANDROID_SDK_ROOT` points to the Android SDK
- `%ANDROID_HOME%\platform-tools` is available on `PATH`

## First-time setup

```powershell
npm install
npm run build:mobile:web
npx cap add android
npm run android:assets
npm run android:sync
```

## Daily workflow

```powershell
npm run android:sync
npm run android:open
```

## Verification commands

```powershell
npm run android:doctor
java -version
adb version
```

## Versioning

Android release versions live in [android/gradle.properties](../android/gradle.properties):

- `lernaVersionCode`
- `lernaVersionName`

Increase both before every Play Store upload.

## Signing

Copy [android/keystore.properties.example](../android/keystore.properties.example) to `android/keystore.properties` and fill in real values before generating a production AAB.

Without `android/keystore.properties`, release builds fall back to the debug signing config for local validation only.

# Lerna Android Release

## Build outputs

- Debug APK: `npm run android:build:debug`
- Release AAB: `npm run android:build:aab`

Both commands rebuild the mobile web bundle before syncing the Android project.

## Production signing

1. Copy [android/keystore.properties.example](../android/keystore.properties.example) to `android/keystore.properties`
2. Fill in:
   - `storeFile`
   - `storePassword`
   - `keyAlias`
   - `keyPassword`
3. Keep the real keystore and `keystore.properties` out of git

## Release flow

1. Install the Android toolchain from [ANDROID_SETUP.md](./ANDROID_SETUP.md)
2. Run `npm install`
3. Run `npm run android:assets`
4. Run `npm run android:sync`
5. Update `lernaVersionCode` and `lernaVersionName` in [android/gradle.properties](../android/gradle.properties)
6. Add `android/keystore.properties`
7. Run `npm run android:build:aab`
8. Upload the AAB from `android/app/build/outputs/bundle/release/`

## Package identity

- App name: `Lerna`
- Package name: `app.lerna.mobile`
- Main entry: local Capacitor bundle from `dist/mobile-web`

## Notes

- Browser and PWA users keep their existing local data.
- Android migration uses in-app `Export backup` and `Import backup`.
- No backend, account sync, or remote host is required for the Android app build.

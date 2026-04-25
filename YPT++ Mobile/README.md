# YPT++ Mobile

Capacitor + PWA shell for `YPT++ v22.html`.

## Commands

```bash
npm install
python scripts/generate_branding.py
npm run prepare:web
npx cap add ios
npx cap add android
npm run assets
npm run sync
# then copy keystore.properties.example -> keystore.properties when preparing Android release signing
```

## Notes

- `www/index.html` is generated from `../YPT++ v22.html`; do not edit the source bundle in place.
- App state still uses `localStorage` keys `ypt_app_state_v6` and `lerna_ai_v1`.
- iOS `WKWebView` does not expose the Web Speech API used by the Voice tab. v1 should show a browser requirement message there instead of promising native speech input.
- Reinstalling the app clears local data. A future version should mirror critical state into `@capacitor/preferences`.
- Replace the `TODO` support and marketing URLs in `store-assets/store-listing.md` and `store-assets/privacy-policy.md` before submission.

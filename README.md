# Lerna (`YPT++ v18`)

Lerna is a calm, local-first study app built from the existing `YPT++ v18.html` single-file web app. The repo now supports three delivery surfaces from the same product code:

- Browser / desktop web
- Installable PWA
- Android app wrapper via Capacitor

## Product surfaces

| Surface | Description |
|---|---|
| **Focus** | Focus timer, study cycle, session reflection |
| **Plan** | Tasks, study blocks, countdowns |
| **Learn** | Decks, notes, active recall study modes |
| **Stats** | Progress tracking and review |
| **Groups** | Accountability spaces |
| **Profile** | Personal summary and settings entry point |
| **Settings** | Language, timer defaults, backup import/export |
| **Managed Focus** | Web-safe focus lock plus future managed-device configuration |

## Tech stack

- Single-file HTML React app (`YPT++ v18.html`)
- Local asset bundle in `assets/`
- `localStorage` persistence
- Bilingual `zh-TW / en` UI
- Capacitor Android wrapper using a generated `dist/mobile-web` bundle

## Web / PWA usage

Serve the project root locally instead of opening the HTML file directly:

```powershell
cd "C:\Users\hengy\OneDrive\Documents\Claude\Projects\Learning"
node -e "const http=require('http'),fs=require('fs'),path=require('path');const root=process.cwd();const mime={'.html':'text/html; charset=utf-8','.js':'text/javascript; charset=utf-8','.css':'text/css; charset=utf-8','.json':'application/json; charset=utf-8','.webmanifest':'application/manifest+json; charset=utf-8','.svg':'image/svg+xml','.png':'image/png','.ico':'image/x-icon'};http.createServer((req,res)=>{const clean=decodeURIComponent((req.url||'/').split('?')[0]);const rel=clean==='/'?'YPT++ v18.html':clean.replace(/^\\//,'');let file=path.join(root,rel);try{if(fs.existsSync(file)&&fs.statSync(file).isDirectory()) file=path.join(file,'index.html');const data=fs.readFileSync(file);res.writeHead(200,{'Content-Type':mime[path.extname(file)]||'application/octet-stream'});res.end(data);}catch{res.writeHead(404);res.end('Not found');}}).listen(8765,'127.0.0.1')"
```

Then open:

- `http://127.0.0.1:8765/YPT++%20v18.html`

## Android workflow

Install dependencies and generate the Android wrapper:

```powershell
npm install
npm run android:assets
npm run android:sync
```

Key files:

- Android wrapper config: [capacitor.config.json](./capacitor.config.json)
- Mobile web bundle builder: [scripts/build-mobile-web.js](./scripts/build-mobile-web.js)
- Native bridge: [mobile/capacitor-bridge.js](./mobile/capacitor-bridge.js)
- Android setup guide: [docs/ANDROID_SETUP.md](./docs/ANDROID_SETUP.md)
- Android release guide: [docs/ANDROID_RELEASE.md](./docs/ANDROID_RELEASE.md)
- Play Store asset guide: [docs/PLAY_STORE_ASSETS.md](./docs/PLAY_STORE_ASSETS.md)

## Data compatibility

- Existing persistence keys such as `ypt_app_state_v6` are preserved.
- Browser/PWA and Android share the same app-state shape.
- Cross-device migration is handled through in-app `Export backup` / `Import backup`.

## Historical files

Older `YPT++` HTML versions are kept in the repo as archive snapshots. The active source of truth for the product is:

- `YPT++ v18.html`

## License

Private project. Not for redistribution.

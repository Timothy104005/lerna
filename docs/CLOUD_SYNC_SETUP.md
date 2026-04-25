# Lerna Cloud Sync Setup

This build adds a static website/PWA and a Supabase-backed sync layer shared by the browser version and Android app.

## What Gets Synced

The first production-safe sync unit is a per-user JSON snapshot of the existing local data:

- `ypt_app_state_v6`
- `lerna_ai_v1`
- `ypt_v23_upgrade_v1`

This keeps the current offline-first app behavior intact. Downloads create a timestamped local backup before overwriting local data.

## Supabase Setup

1. Create a Supabase project.
2. Open SQL Editor.
3. Run [supabase/schema.sql](../supabase/schema.sql).
4. Open Project Settings > API.
5. Copy:
   - Project URL
   - `anon` public key
6. Open the Lerna website or Android app.
7. Tap `Cloud`, paste the URL/key, then sign up or sign in.

## Build

```powershell
npm install
npm run build:site
npm run android:build:debug
```

Website output:

```text
dist/site
```

Android debug APK:

```text
android/app/build/outputs/apk/debug/app-debug.apk
```

## Deploy Targets

Any static host works. Publish `dist/site`.

Netlify can use the included [netlify.toml](../netlify.toml).

Vercel can use the included [vercel.json](../vercel.json).

Cloudflare Pages settings:

```text
Build command: npm run build:site
Output directory: dist/site
```

## Web Agent Prompt

Use this prompt if a browser/web agent needs to create the Supabase project and deployment:

```text
Create a Supabase-backed deployment for the local Lerna project.

Local project path:
C:\Users\hengy\OneDrive\Documents\Claude\Projects\Learning

Tasks:
1. Create or open a Supabase project named "Lerna".
2. In Supabase SQL Editor, run the contents of:
   C:\Users\hengy\OneDrive\Documents\Claude\Projects\Learning\supabase\schema.sql
3. In Supabase Auth settings, enable Email/Password signups. Keep email confirmation enabled if the user wants stricter security; disable it only if the user explicitly asks for easier local testing.
4. Copy the Project URL and anon public key from Project Settings > API.
5. Deploy the static website from this repo using one of:
   - Netlify: build command "npm run build:site", publish directory "dist/site"
   - Vercel: build command "npm run build:site", output directory "dist/site"
   - Cloudflare Pages: build command "npm run build:site", output directory "dist/site"
6. Open the deployed site, click the "Cloud" button, paste the Supabase Project URL and anon key, create a test account, and run "Upload this device".
7. Confirm the Supabase table public.lerna_snapshots has one row for that authenticated user and that Row Level Security remains enabled.

Do not paste service role keys into the website. Use only the anon public key.
```

# Cloudflare R2 Upload Setup

DMS can upload patient files to Cloudflare R2 through a Supabase Edge Function. The mobile app never stores R2 secret keys.

## 1. Cloudflare R2

Create an R2 bucket and an R2 API token with S3 access for that bucket.

Enable public reads through an R2 public development URL or a custom public domain. Use that URL as `R2_PUBLIC_BASE_URL`.

Add this CORS policy to the R2 bucket:

```json
[
  {
    "AllowedOrigins": ["*"],
    "AllowedMethods": ["PUT", "GET", "HEAD"],
    "AllowedHeaders": ["Content-Type"],
    "ExposeHeaders": ["ETag"],
    "MaxAgeSeconds": 3600
  }
]
```

For production web, replace `"*"` with your real app domains. Native mobile uploads do not use browser CORS, but web testing does.

## 2. Supabase secrets

If the CLI shows `401 GET https://api.supabase.com/v1/projects`, log in again with a Supabase personal access token first.

Project ref for this app:

```text
mzjtdcpbvoximdukpukd
```

PowerShell:

```powershell
cd "C:\Users\mamat\OneDrive\Documents\dms-mobile-app"
npx.cmd supabase logout
npx.cmd supabase login --token "paste_your_supabase_personal_access_token_here"
npx.cmd supabase projects list --debug
npx.cmd supabase link --project-ref mzjtdcpbvoximdukpukd
```

`--debug` is a flag on the command. Do not run `--debug` by itself in PowerShell.

The token must be a Supabase personal access token from the Supabase dashboard account page. It is not the app anon key, service role key, database password, or Cloudflare R2 token.

If local CLI token storage keeps failing, use an environment variable for the current PowerShell window:

```powershell
$env:SUPABASE_ACCESS_TOKEN="paste_your_supabase_personal_access_token_here"
npx.cmd supabase projects list --debug
```

Set these secrets in Supabase:

```powershell
npx.cmd supabase secrets set --project-ref mzjtdcpbvoximdukpukd R2_ACCOUNT_ID="your_cloudflare_account_id"
npx.cmd supabase secrets set --project-ref mzjtdcpbvoximdukpukd R2_ACCESS_KEY_ID="your_r2_access_key_id"
npx.cmd supabase secrets set --project-ref mzjtdcpbvoximdukpukd R2_SECRET_ACCESS_KEY="your_r2_secret_access_key"
npx.cmd supabase secrets set --project-ref mzjtdcpbvoximdukpukd R2_BUCKET="your_bucket_name"
npx.cmd supabase secrets set --project-ref mzjtdcpbvoximdukpukd R2_PUBLIC_BASE_URL="https://your-public-r2-domain.example.com"
npx.cmd supabase secrets set --project-ref mzjtdcpbvoximdukpukd R2_UPLOAD_EXPIRES_SECONDS="600"
```

## 3. Deploy function

```powershell
npx.cmd supabase functions deploy create-r2-upload-url --project-ref mzjtdcpbvoximdukpukd --use-api
```

## 4. Enable R2 in the app

Add this to the app `.env` after the function is deployed:

```env
EXPO_PUBLIC_UPLOAD_PROVIDER=r2
```

Restart Expo after changing `.env`.

If `EXPO_PUBLIC_UPLOAD_PROVIDER` is missing or set to `supabase`, DMS keeps using Supabase Storage.

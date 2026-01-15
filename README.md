# Accio Imago 🖼️

A Chrome Extension to download high-quality images from Google Slides with ease.

## Features

- **Google Slides only**: Works exclusively on Google Slides presentations
- **Smart image detection**: Automatically detects SVG image elements used by Google Slides
- **One-click download**: Hover over images and click to download high-quality deeplinks
- **GIF support**: Downloads GIFs and animated images, unlike other extensions that only handle static images
- **Persistent stop button**: Always visible so you can stop at any time
- **Clean workflow**: Automatically injects and cleans up when done

## Installation

You can install Accio Imago in two ways:

### Option 1: Install from Chrome Web Store (Recommended)

1. Visit the [Chrome Web Store page](https://chromewebstore.google.com/detail/accio-imago-download-imag/geiiegcdagboeemhdlombhmapghbfbce)
2. Click **"Add to Chrome"**
3. Confirm the installation in the popup dialog
4. The extension will be automatically installed and ready to use

### Option 2: Install from Zip File (Manual Installation)

1. Download the `accio-imago-extension.zip` file from this repository
2. Extract the zip file to a folder on your computer
3. Open Chrome and navigate to `chrome://extensions/`
4. Enable **Developer mode** (toggle in the top right corner)
5. Click **"Load unpacked"** button
6. Select the extracted folder (the folder containing `manifest.json`, `popup.html`, etc.)
7. The "Accio Imago - Download images from Google Slides" extension should now appear in your extensions menu

## Usage

### Quick Start

1. **Open a Google Slides presentation**
2. **Click the Accio Imago extension icon** in your toolbar
3. **Click "Start Download Mode"** - the popup will close automatically
4. **Hover over images** - they will be highlighted with a cyan border
5. **Click any highlighted image** to download it
6. **Click the red "⊘ Stop Download Mode" button** when you're done

### Features

- **Automatic Google Slides detection**: Extension only activates on `docs.google.com/presentation/` URLs
- **Popup auto-closes**: After clicking "Start", the popup closes so you have full screen access
- **Persistent stop button**: Red button in bottom-right corner is always visible while downloading
- **Direct downloads**: High-quality image deeplinks download directly to your Downloads folder
- **GIF support**: Unlike other extensions, Accio Imago can download GIFs and animated images from Google Slides
- **No tab clutter**: Downloads happen in the background without opening new tabs

## How It Works

- The extension checks that you're on a Google Slides presentation
- When activated, it injects a content script that monitors mouse movements
- Only SVG `<image>` elements (how Google Slides renders images) are highlighted
- Clicking an image extracts its `xlink:href` deeplink and downloads it directly
- The `filesystem:` URLs used by Google Slides are handled directly by the content script
- When you click "Stop", all listeners are removed and the page returns to normal

## Development

### File Structure

- `extension/manifest.json` - Extension configuration and permissions
- `extension/popup.html` - Popup UI
- `extension/popup.js` - Popup logic, auth, and billing actions
- `extension/content.js` - Content script (image detection, highlighting, downloads, entitlement enforcement)
- `extension/sw.js` - Service worker (handles non-filesystem URL downloads)
- `build.sh` - Script to create distribution zip file
- `README.md` - User documentation
- `agent.md` - Developer/agent guide with detailed architecture and technical information

### Key Components

**Google Slides Detection** (`isGoogleSlidesUrl()`):
- Validates that current tab is a Google Slides presentation
- Disables start button if not on the right URL

**Image Detection** (`isImage()`):
- Detects SVG `<image>` elements with `filesystem:` URLs
- Only highlights actual image elements, ignores containers
- HTML `<img>` tags also supported for compatibility

**Download Handler** (`downloadImage()`):
- Handles `filesystem:` URLs directly from content script
- Delegates regular HTTP/HTTPS URLs to service worker
- No new tabs are opened - everything downloads silently

**Cleanup** (`cleanup()`):
- Removes all event listeners
- Hides overlay and stop button
- Resets extension state

### Building & Distribution

To create a distribution zip file for manual installation:

```bash
./build.sh
```

This creates `accio-imago-extension.zip` containing only the essential extension files:
- `content.js`
- `manifest.json`
- `popup.html`
- `popup.js`
- `sw.js`
- `logo.png`
- `icons/` (all icon files)

The zip file can be used for manual installation (see [Installation - Option 2](#option-2-install-from-zip-file-manual-installation) above). The script automatically excludes documentation files (`README.md`, `AGENT.md`) and other non-essential files.

## Monetization (Supabase + Stripe)

This project includes a Supabase + Stripe backend for multi-product subscriptions and per-product entitlements. Each Chrome extension/product sends a `product_id` with entitlement checks and checkout requests.

### Database Schema + Migrations

Migrations are stored under `supabase/migrations/`:

- `supabase/migrations/20241012000100_init.sql` (tables, indexes, RLS, RPC)
- `supabase/migrations/20241012000200_seed_products.sql` (seed product rows)
- `supabase/migrations/20241012000300_update_price.sql` (updates Stripe price for product)
- `supabase/migrations/20241012000400_add_product_prices.sql` (optional price mapping table for multiple prices)

Update the seed file with your product ID(s), then map Stripe prices in `product_prices`:

```
supabase/migrations/20241012000200_seed_products.sql
```

If you offer multiple prices (monthly/yearly) for the same product, use the
`public.product_prices` table (created by `20241012000400_add_product_prices.sql`)
to map each Stripe price ID back to a product. This lets the webhook resolve
admin-side changes even when metadata is missing.

### Required Environment Variables

Set these for local development and deployment:

- `SUPABASE_URL`
- `SUPABASE_ANON_KEY`
- `SUPABASE_SERVICE_ROLE_KEY`
- `STRIPE_SECRET_KEY`
- `STRIPE_WEBHOOK_SECRET`
- `SITE_URL`
- `STRIPE_PRICE_ID_MONTHLY` (optional)
- `STRIPE_PRICE_ID_YEARLY` (optional)

### Supabase CLI (Local Dev - Optional)

Local Supabase is optional. For Supabase Cloud, skip this section entirely.

Initialize and start Supabase locally (if needed):

```bash
supabase init
supabase start
supabase db reset
```

Create a local env file for edge functions (do not commit it):

```bash
cat <<'EOF' > supabase/.env.local
SUPABASE_URL=your_supabase_url
SUPABASE_ANON_KEY=your_supabase_anon_key
SUPABASE_SERVICE_ROLE_KEY=your_supabase_service_role_key
STRIPE_SECRET_KEY=your_stripe_secret_key
STRIPE_WEBHOOK_SECRET=your_stripe_webhook_secret
SITE_URL=http://localhost:3000
STRIPE_PRICE_ID_MONTHLY=your_monthly_stripe_price_id
STRIPE_PRICE_ID_YEARLY=your_yearly_stripe_price_id
EOF
```

Serve edge functions locally:

```bash
supabase functions serve --env-file supabase/.env.local
```

Deploy edge functions:

```bash
supabase functions deploy validate
supabase functions deploy consume_free_export
supabase functions deploy create_checkout_session
supabase functions deploy create_portal_session
supabase functions deploy stripe_webhook
```

### Supabase CLI (Cloud)

Supabase Cloud is the default for this project. Use the Supabase CLI with secrets from `.env` and skip `supabase start`:

```bash
supabase link --project-ref <your-project-ref>
supabase secrets set --env-file .env
supabase db push
supabase functions deploy validate
supabase functions deploy consume_free_export
supabase functions deploy create_checkout_session
supabase functions deploy create_portal_session
supabase functions deploy stripe_webhook
```

### Stripe CLI (Webhook Testing)

Load Stripe secrets from `.env` before using the CLI (for example, `export STRIPE_SECRET_KEY=$(grep STRIPE_SECRET_KEY .env | cut -d= -f2-)`).

Forward webhooks to Supabase local edge functions:

```bash
stripe listen --forward-to http://127.0.0.1:54321/functions/v1/stripe_webhook
```

Copy the webhook signing secret printed by the CLI into `STRIPE_WEBHOOK_SECRET`.

Trigger events for testing:

```bash
stripe trigger checkout.session.completed
stripe trigger invoice.paid
stripe trigger invoice.payment_failed
stripe trigger customer.subscription.created
stripe trigger customer.subscription.updated
stripe trigger customer.subscription.deleted
```

For a manual test flow, use the extension UI to open a real Checkout session and complete purchase using Stripe test mode.

### Webhook Entitlements Flow

Entitlements are written by the Stripe webhook and read by the extension via the
`validate` and `consume_free_export` functions. A subscription is treated as
**pro** when:

- `entitlements.status` is `active` or `trialing`
- `current_period_end` is in the future

The webhook handles these events:

- `checkout.session.completed`
- `invoice.paid`
- `invoice.payment_failed`
- `customer.subscription.created`
- `customer.subscription.updated`
- `customer.subscription.deleted`

On `customer.subscription.created` / `customer.subscription.updated`, the
webhook upserts entitlements using subscription metadata and the price mapping:

- `metadata.supabase_user_id` (preferred for user resolution)
- `metadata.product_id` (preferred for product resolution)
- `product_prices` (fallback via Stripe price ID)

Trialing subscriptions are stored as `plan = pro` and `status = trialing` so the
extension sees them as active during the trial window.

### Stripe Webhook Signature Verification

The webhook verifies Stripe signatures using the raw request body. Supabase JWT
verification is disabled for `stripe_webhook` because Stripe does not send a
Supabase JWT. Deploy with:

```bash
supabase functions deploy stripe_webhook --no-verify-jwt
```

To create a webhook endpoint in Stripe:

```bash
stripe webhook_endpoints create \
  --url https://YOUR_PROJECT.supabase.co/functions/v1/stripe_webhook \
  --enabled-events checkout.session.completed \
  --enabled-events invoice.paid \
  --enabled-events invoice.payment_failed \
  --enabled-events customer.subscription.created \
  --enabled-events customer.subscription.updated \
  --enabled-events customer.subscription.deleted
```

Then set `STRIPE_WEBHOOK_SECRET` to the generated `whsec_...` value and update Supabase secrets.

### Edge Function Endpoints

- `POST /functions/v1/validate`
- `POST /functions/v1/consume_free_export`
- `POST /functions/v1/create_checkout_session`
- `POST /functions/v1/create_portal_session`
- `POST /functions/v1/stripe_webhook`

All endpoints (except `stripe_webhook`) require a Supabase JWT in the `Authorization` header.

### Extension Integration (High-Level)

Example flow (pseudo-code) showing how the extension calls the new endpoints:

```js
const PRODUCT_ID = "slides_image_downloader";

async function callFunction(path, body) {
  const { accessToken } = await chrome.storage.local.get("accessToken");
  const res = await fetch(`https://YOUR_PROJECT.supabase.co/functions/v1/${path}`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "Authorization": `Bearer ${accessToken}`,
    },
    body: JSON.stringify(body),
  });
  return res.json();
}

async function refreshEntitlement() {
  return callFunction("validate", { product_id: PRODUCT_ID });
}

async function consumeExport() {
  return callFunction("consume_free_export", { product_id: PRODUCT_ID });
}

async function startCheckout() {
  const { url } = await callFunction("create_checkout_session", {
    product_id: PRODUCT_ID,
    billing_interval: "monthly", // or "yearly"
  });
  chrome.tabs.create({ url });
}

async function openPortal() {
  const { url } = await callFunction("create_portal_session", { product_id: PRODUCT_ID });
  chrome.tabs.create({ url });
}

// UI logic
// - After login, call refreshEntitlement() to render Free vs Pro
// - On export click: call consumeExport(), block if allowed=false
// - Show “Upgrade” button for free users, “Manage subscription” for pro users
// - Add a “Refresh status” button that calls refreshEntitlement()
```

### Extension Login (OTP)

The extension uses Supabase email OTP directly in the popup (no external website). Users enter their email, receive a code, and verify inside the popup to obtain a session token stored in `chrome.storage.local`.

## Future Improvements

- [ ] Support for other document types (Docs, Sheets)
- [ ] Batch download multiple images at once
- [ ] Save images to Google Drive directly
- [ ] Preview before downloading
- [ ] Settings panel for customization
- [ ] Download as different formats

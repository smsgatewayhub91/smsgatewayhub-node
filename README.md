# SMSGatewayHub Node.js SDK

Official Node.js library for [SMSGatewayHub](https://www.smsgatewayhub.com): classic SMS API, CPaaS unified messaging (WhatsApp, SMS, RCS and Email with automatic fallback), OneTap Verify and Email Verification.

- Zero dependencies (built-in `https` only), Node.js 14 or newer
- Promise / `async`-`await` API, TypeScript types included
- Safe automatic retries and one error type

> **Server-side only.** Your API keys must never ship inside a mobile app, a browser bundle or any code your users can download. Call SMSGatewayHub from your backend.

## Install

```bash
npm install smsgatewayhub
```

Direct download (no npm registry access):

```bash
npm install https://www.smsgatewayhub.com/sdk/smsgatewayhub-node-1.0.0.tgz
```

## Quick start

```js
const SmsGatewayHub = require('smsgatewayhub');
// or: const { SmsGatewayHub, SmsGatewayHubError } = require('smsgatewayhub');
// TypeScript: import SmsGatewayHub = require('smsgatewayhub');

const client = new SmsGatewayHub({
  apiKey: process.env.SGH_API_KEY,     // classic SMS API key (Panel > API)
  cpaasKey: process.env.SGH_CPAAS_KEY  // CPaaS key sghcp_... (Panel > CPaaS > API)
});

const sent = await client.sms.send({ senderId: 'SGHTST', to: '919800000001', text: 'Hello!' });
console.log(sent.jobId);
```

When an option is not given the constructor reads `SGH_API_KEY`, `SGH_CPAAS_KEY` and `SGH_BASE_URL` from the environment, so `new SmsGatewayHub()` is enough in most apps.

| Option | Default | Notes |
|---|---|---|
| `apiKey` | `SGH_API_KEY` | Needed for `sms` |
| `cpaasKey` | `SGH_CPAAS_KEY` | Needed for `messages`, `verifyLink`, `emailVerify` |
| `baseUrl` | `https://www.smsgatewayhub.com` | See White-label base URL |
| `timeout` | `30` | Seconds |
| `maxRetries` | `2` | See Errors and retries |
| `headers` | `{}` | Extra headers on every request |

## Classic SMS

```js
// Send (to: string, comma-separated string or array, max 100 numbers)
const r = await client.sms.send({
  senderId: 'SGHTST',
  to: ['919800000001', '919800000002'],
  text: 'Your OTP is 482913',
  channel: 'OTP',              // 1 / 'promotional', 2 / 'transactional' (default), 'OTP'
  route: 1,                    // default 1
  flash: false,
  // unicode: true,            // auto-detected when omitted (any non-ASCII char -> DCS=8)
  scheduleAt: new Date(Date.now() + 3600 * 1000), // or '2026/10/06 08:30:00 PM'
  entityId: '1201160000000000000',
  dltTemplateId: '1207160000000000000'
});
// r = { jobId: '20047', messages: [{ number, messageId }], raw }

const b = await client.sms.balance();
// b.balances = { Promo: 9988, Trans: 0 }

const d = await client.sms.delivery(r.jobId);
// d.reports = [{ messageId, status, deliveredAt }]
```

## CPaaS messages with fallback

One call, many channels: the message goes out on the first channel and falls back to the next one when it is not delivered within `fallbackAfter` seconds.

```js
const msg = await client.messages.send({
  channels: ['whatsapp', 'sms'],
  to: '919800000001',
  fallbackAfter: 300,
  ref: 'order-1234',
  callbackUrl: 'https://example.com/hooks/smsgatewayhub',
  whatsapp: { template: 'order_shipped', language: 'en', variables: ['Asha', '#1234'] },
  sms: { text: 'Hi Asha, your order #1234 has been shipped.', sender: 'SGHTST', templateId: '1207...', entityId: '1201...' }
}, { idempotencyKey: 'order-1234-shipped' }); // optional

console.log(msg.id, msg.status);            // 'cp_...'
const latest = await client.messages.get(msg.id);           // status + event timeline
const page = await client.messages.list({ status: 'delivered', ref: 'order-1234', limit: 50 });
```

Other channel blocks: `rcs: { template, bot, variables: {} }` and `email: { from, fromName, replyTo, subject, html, text, templateId, placeholders: {}, category }` (use `toEmail` for the address). The SDK passes the body through unchanged and returns the whole response object.

### Webhooks

Status callbacks to your `callbackUrl` are plain JSON POSTs. A minimal receiver:

```js
const http = require('http');
http.createServer((req, res) => {
  let body = '';
  req.on('data', (c) => { body += c; });
  req.on('end', () => {
    const event = JSON.parse(body || '{}');
    console.log('callback', event);
    res.statusCode = 200;
    res.end('ok');
  });
}).listen(8080);
```

## OneTap Verify

Passwordless sign-in: the user receives a one-time link on WhatsApp, SMS or Email, taps it and lands on your `redirectUrl` with `?vl_token=...`.

```js
const vl = await client.verifyLink.create({
  to: '919800000001',
  channels: ['whatsapp', 'sms', 'email'],
  toEmail: 'asha@example.com',
  fallbackAfter: 60,
  expiry: 600,
  redirectUrl: 'https://app.example.com/onetap/callback',
  state: 'session-abc123',
  appName: 'My App',
  sms: { text: 'Tap to sign in to My App: {{link}}' } // {{link}} is replaced server-side
});

// In your redirectUrl handler:
const token = SmsGatewayHub.getVerifyToken(fullRequestUrl); // or SmsGatewayHub.parseRedirect(...)
const result = await client.verifyLink.verify(token);        // valid once

await client.verifyLink.get(vl.id);    // created / sent / opened / confirmed / verified / expired / failed / cancelled
await client.verifyLink.cancel(vl.id);
```

## Email Verification

```js
const one = await client.emailVerify.check('someone@example.com');
// { result: 'valid'|'invalid'|'risky'|'unknown', reason, suggestion, disposable, roleBased, freeProvider, hasMx, domain }

const batch = await client.emailVerify.batch(['a@example.com', 'b@example.org'], { name: 'October signups' }); // max 1000
const status = await client.emailVerify.batchStatus(batch.batchId, { results: true, page: 1, pageSize: 100, filter: 'invalid' });
```

## Errors and retries

Every failure is a `SmsGatewayHubError`:

| Field | Meaning |
|---|---|
| `status` | HTTP status (`0` for network and configuration errors) |
| `code` | e.g. `bad_request`, `13` (classic API ErrorCode), `http_502`, `network_error`, `timeout`, `config_error` |
| `message` | Human readable message |
| `channel` | Channel that failed, when the API says so |
| `raw` | Response body text (max 2000 chars) |

```js
const { SmsGatewayHubError } = require('smsgatewayhub');
try {
  await client.sms.send({ senderId: 'SGHTST', to: '919800000001', text: 'Hi' });
} catch (err) {
  if (err instanceof SmsGatewayHubError) console.error(err.status, err.code, err.message);
}
```

- Missing keys or invalid input (for example more than 100 numbers) fail with `config_error` before any network call.
- Retries (default `maxRetries: 2`, backoff 0.5 s then 1 s) happen only on network errors, HTTP 429 (honours `Retry-After`, max 10 s) and HTTP 5xx.
- `sms.send` is never sent twice: the classic API has no idempotency, so it is retried only when the connection could not be opened (nothing was sent) or on HTTP 429 - never on a timeout, read error or 5xx. Check `sms.delivery()` before re-sending yourself. `sms.balance` / `sms.delivery` use the normal rules.
- `messages.send` always sends an `Idempotency-Key` (a random UUID when you do not pass one) and reuses it on every retry, so a retry never sends twice.
- OneTap Verify and Email Verification POSTs are retried only when the connection could not be opened.

## White-label base URL

Resellers and white-label partners point the SDK at their own domain:

```js
const client = new SmsGatewayHub({ baseUrl: 'https://sms.yourbrand.com' }); // or SGH_BASE_URL
```

## Security

- Use the SDK on your server only. Never put keys in mobile apps, browsers or public repositories.
- Keep keys in environment variables `SGH_API_KEY` and `SGH_CPAAS_KEY` (or your secret manager).
- The SDK never logs keys, keeps them out of `console.log(client)` and removes them from error messages.

## Support

- Email: support@smsgatewayhub.com
- Developer hub: https://www.smsgatewayhub.com/api-developer-hub

## Development

Run the tests against the SDK mock server (default `http://127.0.0.1:8765`, override with `SGH_BASE_URL`):

```bash
node test/run.js
```

MIT License.

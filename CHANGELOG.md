# Changelog

## 1.0.0 - 09-10-2026

First official release of the SMSGatewayHub Node.js SDK.

- `sms`: `send`, `balance`, `delivery` (classic SMS API, Unicode auto-detect, scheduling, DLT fields).
- `messages`: `send` (WhatsApp / SMS / RCS / Email with fallback, automatic Idempotency-Key), `get`, `list`.
- `verifyLink` (OneTap Verify): `create`, `verify`, `get`, `cancel`, plus `parseRedirect` / `getVerifyToken` helpers.
- `emailVerify`: `check`, `batch`, `batchStatus`.
- One error type `SmsGatewayHubError` (`status`, `code`, `message`, `channel`, `raw`).
- Safe retries: network errors, HTTP 429 (Retry-After honoured, max 10 s) and 5xx. Classic `sms.send` is retried only on connect failure or 429 (never on timeout / read error / 5xx), so an SMS is never sent twice.
- Zero dependencies, Node.js 14+, TypeScript types included.

'use strict';

/*
 * SMSGatewayHub official Node.js SDK v1.0.0
 * Zero dependencies (built-in http/https/url/crypto only). Server-side use only.
 * MIT License - Copyright (c) 2026 SMSGatewayHub
 */

const https = require('https');
const http = require('http');
const URL = require('url').URL;
const crypto = require('crypto');

const VERSION = '1.0.0';
const USER_AGENT = 'smsgatewayhub-node/' + VERSION;
const DEFAULT_BASE_URL = 'https://www.smsgatewayhub.com';
const RAW_LIMIT = 2000;
const MAX_RETRY_AFTER_SECONDS = 10;
const MAX_SMS_NUMBERS = 100;
const MAX_EMAIL_BATCH = 1000;

// ---------------------------------------------------------------------------
// Errors
// ---------------------------------------------------------------------------

class SmsGatewayHubError extends Error {
  constructor(message, options) {
    super(message);
    const o = options || {};
    this.name = 'SmsGatewayHubError';
    this.status = typeof o.status === 'number' ? o.status : 0;
    this.code = o.code ? String(o.code) : 'error';
    this.channel = o.channel !== undefined && o.channel !== null && o.channel !== '' ? String(o.channel) : null;
    this.raw = o.raw !== undefined && o.raw !== null ? clip(String(o.raw)) : null;
    if (typeof Error.captureStackTrace === 'function') {
      Error.captureStackTrace(this, SmsGatewayHubError);
    }
  }
}

function configError(message) {
  return new SmsGatewayHubError(message, { status: 0, code: 'config_error' });
}

// ---------------------------------------------------------------------------
// Small helpers
// ---------------------------------------------------------------------------

function clip(text) {
  return text.length > RAW_LIMIT ? text.slice(0, RAW_LIMIT) : text;
}

function isBlank(value) {
  return value === undefined || value === null || value === '';
}

function pick(primary, fallback) {
  if (!isBlank(primary)) return String(primary);
  if (!isBlank(fallback)) return String(fallback);
  return null;
}

function pad2(n) {
  return (n < 10 ? '0' : '') + n;
}

function sleep(ms) {
  return new Promise(function (resolve) { setTimeout(resolve, ms); });
}

function backoffMs(attempt) {
  // 0.5 s, 1 s, 2 s ... capped at 10 s
  return Math.min(500 * Math.pow(2, attempt), MAX_RETRY_AFTER_SECONDS * 1000);
}

function parseRetryAfter(value) {
  if (isBlank(value)) return null;
  const s = String(value).trim();
  const n = Number(s);
  if (s !== '' && isFinite(n) && n >= 0) return n;
  const when = Date.parse(s);
  if (!isNaN(when)) return Math.max(0, (when - Date.now()) / 1000);
  return null;
}

function tryJson(text) {
  if (typeof text !== 'string') return undefined;
  const t = text.charCodeAt(0) === 0xfeff ? text.slice(1) : text;
  if (t.trim() === '') return undefined;
  try {
    return JSON.parse(t);
  } catch (e) {
    return undefined;
  }
}

function buildQuery(pairs) {
  const parts = [];
  for (let i = 0; i < pairs.length; i++) {
    const k = pairs[i][0];
    const v = pairs[i][1];
    if (isBlank(v)) continue;
    parts.push(encodeURIComponent(k) + '=' + encodeURIComponent(String(v)));
  }
  return parts.join('&');
}

function uuid4() {
  const b = crypto.randomBytes(16);
  b[6] = (b[6] & 0x0f) | 0x40;
  b[8] = (b[8] & 0x3f) | 0x80;
  const h = b.toString('hex');
  return h.slice(0, 8) + '-' + h.slice(8, 12) + '-' + h.slice(12, 16) + '-' + h.slice(16, 20) + '-' + h.slice(20);
}

function hasNonAscii(text) {
  for (let i = 0; i < text.length; i++) {
    if (text.charCodeAt(i) > 0x7f) return true;
  }
  return false;
}

function normalizeChannel(channel) {
  if (isBlank(channel)) return '2';
  if (channel === 1 || channel === 2) return String(channel);
  const s = String(channel).trim().toLowerCase();
  if (s === '1' || s === 'promotional') return '1';
  if (s === '2' || s === 'transactional') return '2';
  if (s === 'otp') return 'OTP';
  throw configError('Invalid channel "' + String(channel) + '": use 1 (promotional), 2 (transactional) or "OTP"');
}

function formatScheduleTime(value) {
  if (value instanceof Date) {
    if (isNaN(value.getTime())) throw configError('scheduleAt is an invalid Date');
    let h = value.getHours();
    const ampm = h >= 12 ? 'PM' : 'AM';
    h = h % 12;
    if (h === 0) h = 12;
    return String(value.getFullYear()) + '/' + pad2(value.getMonth() + 1) + '/' + pad2(value.getDate()) +
      ' ' + pad2(h) + ':' + pad2(value.getMinutes()) + ':' + pad2(value.getSeconds()) + ' ' + ampm;
  }
  return String(value);
}

function normalizeNumbers(to) {
  let list;
  if (Array.isArray(to)) {
    list = to.filter(function (x) { return !isBlank(x); })
      .map(function (x) { return String(x).trim(); })
      .filter(function (x) { return x !== ''; });
  } else if (!isBlank(to)) {
    list = String(to).split(',').map(function (x) { return x.trim(); }).filter(function (x) { return x !== ''; });
  } else {
    list = [];
  }
  if (list.length === 0) throw configError('"to" is required (a mobile number or an array of numbers)');
  if (list.length > MAX_SMS_NUMBERS) throw configError('Max 100 numbers per request');
  return list.join(',');
}

function buildSendSmsParams(apiKey, options) {
  const o = options;
  if (!o || typeof o !== 'object') throw configError('sms.send() needs an options object: { senderId, to, text }');
  if (isBlank(o.senderId)) throw configError('senderId is required');
  if (isBlank(o.text)) throw configError('text is required');
  const number = normalizeNumbers(o.to);
  const text = String(o.text);
  const unicode = (o.unicode === undefined || o.unicode === null) ? hasNonAscii(text) : !!o.unicode;
  const params = [
    ['APIKey', apiKey],
    ['senderid', String(o.senderId)],
    ['channel', normalizeChannel(o.channel)],
    ['DCS', unicode ? '8' : '0'],
    ['flashsms', o.flash ? '1' : '0'],
    ['number', number],
    ['text', text],
    ['route', isBlank(o.route) ? '1' : String(o.route)]
  ];
  if (!isBlank(o.scheduleAt)) params.push(['schedtime', formatScheduleTime(o.scheduleAt)]);
  if (!isBlank(o.groupId)) params.push(['groupid', String(o.groupId)]);
  if (!isBlank(o.entityId)) params.push(['EntityId', String(o.entityId)]);
  if (!isBlank(o.dltTemplateId)) params.push(['dlttemplateid', String(o.dltTemplateId)]);
  return params;
}

function parseBalance(value) {
  const out = {};
  if (isBlank(value)) return out;
  String(value).split('|').forEach(function (part) {
    const p = part.trim();
    if (!p) return;
    const i = p.indexOf(':');
    const name = (i >= 0 ? p.slice(0, i) : p).trim();
    const v = i >= 0 ? p.slice(i + 1).trim() : '';
    const n = Number(v);
    out[name] = (v !== '' && isFinite(n)) ? n : v;
  });
  return out;
}

function strOrNull(value) {
  return value === undefined || value === null ? null : String(value);
}

/**
 * Returns the `vl_token` query value from a full OneTap Verify redirect URL, or null.
 */
function getVerifyToken(redirectUrl) {
  if (isBlank(redirectUrl)) return null;
  let parsed;
  try {
    parsed = new URL(String(redirectUrl), 'http://localhost');
  } catch (e) {
    return null;
  }
  const token = parsed.searchParams.get('vl_token');
  return token ? token : null;
}

function requireValue(value, name) {
  if (isBlank(value)) throw configError(name + ' is required');
  return String(value);
}

function requireObject(value, what) {
  if (!value || typeof value !== 'object' || Array.isArray(value)) {
    throw configError(what + ' needs a JSON object body');
  }
  return value;
}

// ---------------------------------------------------------------------------
// Client
// ---------------------------------------------------------------------------

class SmsGatewayHub {
  /**
   * @param {object} [options] { apiKey, cpaasKey, baseUrl, timeout, maxRetries, headers }
   */
  constructor(options) {
    const o = options || {};
    const env = (typeof process !== 'undefined' && process.env) ? process.env : {};
    // Keys are non-enumerable so console.log(client) / JSON.stringify(client) never print them.
    Object.defineProperty(this, '_apiKey', { value: pick(o.apiKey, env.SGH_API_KEY), enumerable: false, writable: true });
    Object.defineProperty(this, '_cpaasKey', { value: pick(o.cpaasKey, env.SGH_CPAAS_KEY), enumerable: false, writable: true });

    let base = pick(o.baseUrl, env.SGH_BASE_URL) || DEFAULT_BASE_URL;
    base = base.trim().replace(/\/+$/, '');
    if (!/^https?:\/\/[^/]+/i.test(base)) throw configError('baseUrl must start with http:// or https://');
    this.baseUrl = base;
    this.timeout = (typeof o.timeout === 'number' && o.timeout > 0) ? o.timeout : 30;
    this.maxRetries = (typeof o.maxRetries === 'number' && o.maxRetries >= 0) ? Math.floor(o.maxRetries) : 2;
    this.headers = Object.assign({}, o.headers || {});

    this.sms = new SmsApi(this);
    this.messages = new MessagesApi(this);
    this.verifyLink = new VerifyLinkApi(this);
    this.emailVerify = new EmailVerifyApi(this);
  }

  static parseRedirect(redirectUrl) {
    return getVerifyToken(redirectUrl);
  }

  static getVerifyToken(redirectUrl) {
    return getVerifyToken(redirectUrl);
  }

  _requireApiKey() {
    if (isBlank(this._apiKey)) {
      throw configError('Missing apiKey: pass { apiKey } or set SGH_API_KEY (get it from Panel > API)');
    }
    return this._apiKey;
  }

  _requireCpaasKey() {
    if (isBlank(this._cpaasKey)) {
      throw configError('Missing cpaasKey: pass { cpaasKey } or set SGH_CPAAS_KEY (get it from Panel > CPaaS > API)');
    }
    return this._cpaasKey;
  }

  _redact(text) {
    if (text === undefined || text === null) return text;
    let out = String(text);
    const secrets = [this._apiKey, this._cpaasKey];
    for (let i = 0; i < secrets.length; i++) {
      const s = secrets[i];
      if (isBlank(s)) continue;
      out = out.split(s).join('***');
      const enc = encodeURIComponent(s);
      if (enc !== s) out = out.split(enc).join('***');
    }
    return out;
  }

  _attempt(method, fullUrl, headers, body) {
    const self = this;
    return new Promise(function (resolve, reject) {
      let target;
      try {
        target = new URL(fullUrl);
      } catch (e) {
        reject(configError('Invalid baseUrl'));
        return;
      }
      const lib = target.protocol === 'https:' ? https : http;
      const reqOptions = {
        method: method,
        protocol: target.protocol,
        hostname: target.hostname.replace(/^\[|\]$/g, ''),
        port: target.port || undefined,
        path: target.pathname + target.search,
        headers: headers
      };

      let connected = false;
      let finished = false;
      let timedOut = false;
      let timer = null;
      let req = null;

      function fail(err) {
        if (finished) return;
        finished = true;
        if (timer) clearTimeout(timer);
        let e;
        if (timedOut) {
          e = new SmsGatewayHubError('Request timed out after ' + self.timeout + ' s', { status: 0, code: 'timeout' });
        } else {
          const msg = err && err.message ? err.message : String(err);
          e = new SmsGatewayHubError('Network error: ' + self._redact(msg), { status: 0, code: 'network_error' });
        }
        Object.defineProperty(e, '_connected', { value: connected, enumerable: false, configurable: true });
        reject(e);
      }

      try {
        req = lib.request(reqOptions, function (res) {
          const chunks = [];
          res.on('data', function (chunk) { chunks.push(chunk); });
          res.on('end', function () {
            if (finished) return;
            finished = true;
            if (timer) clearTimeout(timer);
            resolve({
              status: res.statusCode || 0,
              headers: res.headers || {},
              text: Buffer.concat(chunks).toString('utf8')
            });
          });
          res.on('aborted', function () { fail(new Error('response aborted')); });
          res.on('error', fail);
        });
      } catch (e) {
        fail(e);
        return;
      }

      req.on('socket', function (sock) {
        if (sock.connecting) {
          sock.once('connect', function () { connected = true; });
        } else {
          connected = true;
        }
      });
      req.on('error', fail);

      timer = setTimeout(function () {
        timedOut = true;
        fail(new Error('timeout'));
        try { req.destroy(); } catch (e) { /* ignore */ }
      }, self.timeout * 1000);

      if (body) req.write(body);
      req.end();
    });
  }

  /**
   * Low-level request with the retry policy from the SDK contract.
   * options: { query: [[k, v]], json, bearer, headers, retry }
   *   retry 'all'        - network errors, 429 and 5xx (GETs, messages.send with Idempotency-Key)
   *   retry 'connect'    - only when the connection could not be opened (non-idempotent POSTs)
   *   retry 'connect429' - connect failure or HTTP 429 only; never timeout/read error/5xx (classic SendSMS)
   */
  async _request(method, path, options) {
    const o = options || {};
    let fullUrl = this.baseUrl + path;
    const qs = buildQuery(o.query || []);
    if (qs) fullUrl += (path.indexOf('?') >= 0 ? '&' : '?') + qs;

    const headers = Object.assign({}, this.headers, {
      'User-Agent': USER_AGENT,
      'Accept': 'application/json'
    });
    if (o.bearer) headers['Authorization'] = 'Bearer ' + o.bearer;
    Object.assign(headers, o.headers || {});

    let body = null;
    if (o.json !== undefined) {
      body = Buffer.from(JSON.stringify(o.json), 'utf8');
      headers['Content-Type'] = 'application/json; charset=utf-8';
      headers['Content-Length'] = String(body.length);
    }

    const mode = o.retry === 'connect' || o.retry === 'connect429' ? o.retry : 'all';
    const retryAll = mode === 'all';
    let attempt = 0;
    for (;;) {
      let res = null;
      let err = null;
      try {
        res = await this._attempt(method, fullUrl, headers, body);
      } catch (e) {
        err = e;
      }

      if (err) {
        if (!(err instanceof SmsGatewayHubError) || err.code === 'config_error') throw err;
        const neverSent = err._connected === false && !(mode === 'connect429' && err.code === 'timeout');
        const canRetry = attempt < this.maxRetries && (retryAll || neverSent);
        if (!canRetry) throw err;
        await sleep(backoffMs(attempt));
        attempt++;
        continue;
      }

      const retryable = (res.status === 429 && mode !== 'connect') ||
        (retryAll && res.status >= 500 && res.status <= 599);
      if (retryable && attempt < this.maxRetries) {
        let waitMs = backoffMs(attempt);
        if (res.status === 429) {
          const ra = parseRetryAfter(res.headers['retry-after']);
          if (ra !== null) waitMs = Math.min(ra, MAX_RETRY_AFTER_SECONDS) * 1000;
        }
        await sleep(waitMs);
        attempt++;
        continue;
      }
      return res;
    }
  }

  async _classic(path, params, retry) {
    const res = await this._request('GET', path, { query: params, retry: retry || 'all' });
    const data = tryJson(res.text);
    const raw = this._redact(res.text);
    if (res.status < 200 || res.status >= 300) {
      const msg = data && typeof data === 'object' && data.ErrorMessage ? String(data.ErrorMessage) : 'HTTP ' + res.status;
      throw new SmsGatewayHubError(this._redact(msg), { status: res.status, code: 'http_' + res.status, raw: raw });
    }
    if (!data || typeof data !== 'object' || Array.isArray(data)) {
      throw new SmsGatewayHubError('Unexpected non-JSON response from the SMS API', { status: res.status, code: 'invalid_response', raw: raw });
    }
    const ec = data.ErrorCode === undefined || data.ErrorCode === null ? '' : String(data.ErrorCode).trim();
    if (ec !== '' && ec !== '000' && ec !== '0') {
      const msg = data.ErrorMessage ? String(data.ErrorMessage) : 'SMS API error ' + ec;
      throw new SmsGatewayHubError(this._redact(msg), { status: res.status, code: ec, raw: raw });
    }
    return data;
  }

  async _cpaas(method, path, options) {
    const key = this._requireCpaasKey();
    const res = await this._request(method, path, Object.assign({}, options || {}, { bearer: key }));
    const data = tryJson(res.text);
    if (res.status >= 200 && res.status < 300) {
      if (data === undefined) {
        if (res.text.trim() === '') return {};
        throw new SmsGatewayHubError('Unexpected non-JSON response', { status: res.status, code: 'invalid_response', raw: this._redact(res.text) });
      }
      return data;
    }
    throw this._cpaasError(res, data);
  }

  _cpaasError(res, data) {
    const raw = this._redact(res.text);
    if (data && typeof data === 'object' && data.error && typeof data.error === 'object') {
      const e = data.error;
      return new SmsGatewayHubError(this._redact(e.message ? String(e.message) : 'HTTP ' + res.status), {
        status: res.status,
        code: e.code ? String(e.code) : 'http_' + res.status,
        channel: e.channel,
        raw: raw
      });
    }
    let msg = 'HTTP ' + res.status;
    if (data && typeof data === 'object' && typeof data.message === 'string' && data.message) msg = data.message;
    return new SmsGatewayHubError(this._redact(msg), { status: res.status, code: 'http_' + res.status, raw: raw });
  }
}

// ---------------------------------------------------------------------------
// sms - classic SMS API
// ---------------------------------------------------------------------------

class SmsApi {
  constructor(client) {
    Object.defineProperty(this, '_client', { value: client, enumerable: false });
  }

  async send(options) {
    const c = this._client;
    const key = c._requireApiKey();
    const params = buildSendSmsParams(key, options);
    // SendSMS has no idempotency: retry only when the request never left (connect failure) or on HTTP 429.
    const data = await c._classic('/api/mt/SendSMS', params, 'connect429');
    const list = Array.isArray(data.MessageData) ? data.MessageData : [];
    return {
      jobId: strOrNull(data.JobId),
      messages: list.map(function (m) {
        return { number: strOrNull(m && m.Number), messageId: strOrNull(m && m.MessageId) };
      }),
      raw: data
    };
  }

  async balance() {
    const c = this._client;
    const key = c._requireApiKey();
    const data = await c._classic('/api/mt/GetBalance', [['APIKey', key]]);
    return { balances: parseBalance(data.Balance), raw: data };
  }

  async delivery(jobId) {
    const c = this._client;
    const key = c._requireApiKey();
    const id = requireValue(jobId, 'jobId');
    const data = await c._classic('/api/mt/GetDelivery', [['APIKey', key], ['jobid', id]]);
    const list = Array.isArray(data.DeliveryReports) ? data.DeliveryReports : [];
    return {
      reports: list.map(function (r) {
        return {
          messageId: strOrNull(r && r.MessageId),
          status: strOrNull(r && r.DeliveryStatus),
          deliveredAt: strOrNull(r && r.DeliveryDate)
        };
      }),
      raw: data
    };
  }
}

// ---------------------------------------------------------------------------
// messages - CPaaS unified API
// ---------------------------------------------------------------------------

const MESSAGES_PATH = '/cpaas/v1/messages.ashx';
const VERIFY_LINK_PATH = '/cpaas/v1/verify-link.ashx';
const EMAIL_VERIFY_PATH = '/cpaas/v1/email-verify.ashx';

class MessagesApi {
  constructor(client) {
    Object.defineProperty(this, '_client', { value: client, enumerable: false });
  }

  async send(body, options) {
    const c = this._client;
    c._requireCpaasKey();
    requireObject(body, 'messages.send(body)');
    const o = options || {};
    const idempotencyKey = isBlank(o.idempotencyKey) ? uuid4() : String(o.idempotencyKey);
    // Retried on network errors / 429 / 5xx: the same Idempotency-Key is reused on every attempt.
    return c._cpaas('POST', MESSAGES_PATH, {
      json: body,
      headers: { 'Idempotency-Key': idempotencyKey },
      retry: 'all'
    });
  }

  async get(id) {
    const c = this._client;
    c._requireCpaasKey();
    const v = requireValue(id, 'id');
    return c._cpaas('GET', MESSAGES_PATH, { query: [['id', v]], retry: 'all' });
  }

  async list(options) {
    const c = this._client;
    c._requireCpaasKey();
    const o = options || {};
    return c._cpaas('GET', MESSAGES_PATH, {
      query: [['action', 'list'], ['status', o.status], ['ref', o.ref], ['limit', o.limit]],
      retry: 'all'
    });
  }
}

// ---------------------------------------------------------------------------
// verifyLink - OneTap Verify
// ---------------------------------------------------------------------------

class VerifyLinkApi {
  constructor(client) {
    Object.defineProperty(this, '_client', { value: client, enumerable: false });
  }

  async create(body) {
    const c = this._client;
    c._requireCpaasKey();
    requireObject(body, 'verifyLink.create(body)');
    return c._cpaas('POST', VERIFY_LINK_PATH, { json: body, retry: 'connect' });
  }

  async verify(token) {
    const c = this._client;
    c._requireCpaasKey();
    const t = requireValue(token, 'token');
    return c._cpaas('POST', VERIFY_LINK_PATH, { query: [['action', 'verify']], json: { token: t }, retry: 'connect' });
  }

  async get(id) {
    const c = this._client;
    c._requireCpaasKey();
    const v = requireValue(id, 'id');
    return c._cpaas('GET', VERIFY_LINK_PATH, { query: [['id', v]], retry: 'all' });
  }

  async cancel(id) {
    const c = this._client;
    c._requireCpaasKey();
    const v = requireValue(id, 'id');
    return c._cpaas('POST', VERIFY_LINK_PATH, { query: [['action', 'cancel']], json: { id: v }, retry: 'connect' });
  }

  parseRedirect(redirectUrl) {
    return getVerifyToken(redirectUrl);
  }

  getVerifyToken(redirectUrl) {
    return getVerifyToken(redirectUrl);
  }
}

// ---------------------------------------------------------------------------
// emailVerify - Email Verification
// ---------------------------------------------------------------------------

class EmailVerifyApi {
  constructor(client) {
    Object.defineProperty(this, '_client', { value: client, enumerable: false });
  }

  async check(email) {
    const c = this._client;
    c._requireCpaasKey();
    const e = requireValue(email, 'email');
    return c._cpaas('POST', EMAIL_VERIFY_PATH, { json: { email: e }, retry: 'connect' });
  }

  async batch(emails, options) {
    const c = this._client;
    c._requireCpaasKey();
    if (!Array.isArray(emails) || emails.length === 0) throw configError('emails must be a non-empty array');
    if (emails.length > MAX_EMAIL_BATCH) throw configError('Max 1000 emails per batch');
    const o = options || {};
    const body = { emails: emails.map(function (x) { return String(x); }) };
    if (!isBlank(o.name)) body.name = String(o.name);
    const data = await c._cpaas('POST', EMAIL_VERIFY_PATH, { json: body, retry: 'connect' });
    const out = Object.assign({}, data);
    if (isBlank(out.batchId)) {
      out.batchId = !isBlank(data.batch) ? String(data.batch) : (!isBlank(data.id) ? String(data.id) : null);
    }
    return out;
  }

  async batchStatus(batchId, options) {
    const c = this._client;
    c._requireCpaasKey();
    const id = requireValue(batchId, 'batchId');
    const o = options || {};
    return c._cpaas('GET', EMAIL_VERIFY_PATH, {
      query: [
        ['batch', id],
        ['results', o.results ? '1' : null],
        ['page', o.page],
        ['pageSize', o.pageSize],
        ['filter', o.filter]
      ],
      retry: 'all'
    });
  }
}

// ---------------------------------------------------------------------------
// Exports
// ---------------------------------------------------------------------------

module.exports = SmsGatewayHub;
module.exports.SmsGatewayHub = SmsGatewayHub;
module.exports.default = SmsGatewayHub;
module.exports.SmsGatewayHubError = SmsGatewayHubError;
module.exports.parseRedirect = getVerifyToken;
module.exports.getVerifyToken = getVerifyToken;
module.exports.VERSION = VERSION;
// Internal helpers, exported for the SDK's own tests only (not part of the public API).
module.exports._internal = {
  buildSendSmsParams: buildSendSmsParams,
  normalizeChannel: normalizeChannel,
  normalizeNumbers: normalizeNumbers,
  formatScheduleTime: formatScheduleTime,
  parseBalance: parseBalance,
  parseRetryAfter: parseRetryAfter,
  buildQuery: buildQuery,
  uuid4: uuid4,
  USER_AGENT: USER_AGENT
};

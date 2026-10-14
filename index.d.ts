// Type definitions for smsgatewayhub 1.0.0 (official SMSGatewayHub Node.js SDK)
// MIT License - Copyright (c) 2026 SMSGatewayHub

declare namespace SmsGatewayHub {
  interface ClientOptions {
    /** Classic SMS API key (Panel > API). Falls back to env SGH_API_KEY. Needed for `sms`. */
    apiKey?: string;
    /** CPaaS key `sghcp_...` (Panel > CPaaS > API). Falls back to env SGH_CPAAS_KEY. Needed for `messages`, `verifyLink`, `emailVerify`. */
    cpaasKey?: string;
    /** Default https://www.smsgatewayhub.com (or env SGH_BASE_URL). Resellers / white-label: your own domain. */
    baseUrl?: string;
    /** Request timeout in seconds. Default 30. */
    timeout?: number;
    /** Retries on network errors, HTTP 429 and 5xx. Default 2. */
    maxRetries?: number;
    /** Extra headers sent on every request. */
    headers?: { [name: string]: string };
  }

  type SmsChannelInput = 1 | 2 | '1' | '2' | 'OTP' | 'otp' | 'promotional' | 'transactional';

  interface SendSmsOptions {
    senderId: string;
    /** One number, a comma-separated string, or an array (max 100 numbers). */
    to: string | number | Array<string | number>;
    text: string;
    /** 1 = promotional, 2 = transactional (default), "OTP". */
    channel?: SmsChannelInput;
    /** Default 1. */
    route?: number | string;
    /** true -> DCS=8. When omitted, auto-detected from the text (any char > 0x7F). */
    unicode?: boolean;
    flash?: boolean;
    /** String passed as-is, or a Date formatted `yyyy/MM/dd hh:mm:ss tt` (local time). */
    scheduleAt?: string | Date;
    groupId?: string | number;
    entityId?: string;
    dltTemplateId?: string;
  }

  interface ClassicResponse {
    ErrorCode?: string;
    ErrorMessage?: string;
    [key: string]: unknown;
  }

  interface SentSms {
    number: string | null;
    messageId: string | null;
  }

  interface SendSmsResult {
    jobId: string | null;
    messages: SentSms[];
    raw: ClassicResponse;
  }

  interface BalanceResult {
    /** e.g. { Promo: 9988, Trans: 0 } */
    balances: { [name: string]: number | string };
    raw: ClassicResponse;
  }

  interface DeliveryReport {
    messageId: string | null;
    status: string | null;
    deliveredAt: string | null;
  }

  interface DeliveryResult {
    reports: DeliveryReport[];
    raw: ClassicResponse;
  }

  type CpaasChannel = 'whatsapp' | 'sms' | 'rcs' | 'email';

  interface WhatsAppPart {
    template?: string;
    language?: string;
    variables?: string[];
    headerText?: string;
    media?: string;
    fileName?: string;
    buttonUrl?: string;
    coupon?: string;
    from?: string;
    text?: string;
    [key: string]: unknown;
  }

  interface SmsPart {
    text?: string;
    sender?: string;
    templateId?: string;
    entityId?: string;
    type?: string;
    [key: string]: unknown;
  }

  interface RcsPart {
    template?: string;
    bot?: string;
    variables?: { [name: string]: string };
    [key: string]: unknown;
  }

  interface EmailPart {
    from?: string;
    fromName?: string;
    replyTo?: string;
    subject?: string;
    html?: string;
    text?: string;
    templateId?: string;
    placeholders?: { [name: string]: string };
    category?: string;
    [key: string]: unknown;
  }

  interface MessageBody {
    channels: CpaasChannel[];
    to?: string;
    toEmail?: string;
    /** Seconds to wait before falling back to the next channel. */
    fallbackAfter?: number;
    ref?: string;
    callbackUrl?: string;
    whatsapp?: WhatsAppPart;
    sms?: SmsPart;
    rcs?: RcsPart;
    email?: EmailPart;
    [key: string]: unknown;
  }

  interface SendMessageOptions {
    /** Sent as Idempotency-Key. A random UUID is generated per call when omitted and reused on retries. */
    idempotencyKey?: string;
  }

  /** Whole parsed JSON response; only `id` and `status` are typed. */
  interface MessageResult {
    id?: string;
    status?: string;
    [key: string]: unknown;
  }

  interface ListMessagesOptions {
    status?: string;
    ref?: string;
    limit?: number;
  }

  interface VerifyLinkBody {
    to?: string;
    toEmail?: string;
    channels?: Array<'whatsapp' | 'sms' | 'email'>;
    fallbackAfter?: number;
    expiry?: number;
    redirectUrl?: string;
    state?: string;
    ref?: string;
    appName?: string;
    sms?: SmsPart;
    whatsapp?: WhatsAppPart;
    email?: EmailPart;
    [key: string]: unknown;
  }

  type VerifyLinkStatus = 'created' | 'sent' | 'opened' | 'confirmed' | 'verified' | 'expired' | 'failed' | 'cancelled';

  interface VerifyLinkResult {
    id?: string;
    status?: VerifyLinkStatus | string;
    [key: string]: unknown;
  }

  interface EmailCheckResult {
    email?: string;
    result?: 'valid' | 'invalid' | 'risky' | 'unknown' | string;
    reason?: string;
    suggestion?: string;
    disposable?: boolean;
    roleBased?: boolean;
    freeProvider?: boolean;
    hasMx?: boolean;
    domain?: string;
    [key: string]: unknown;
  }

  interface EmailBatchOptions {
    name?: string;
  }

  interface EmailBatchResult {
    batchId: string | null;
    [key: string]: unknown;
  }

  interface EmailBatchStatusOptions {
    results?: boolean;
    page?: number;
    pageSize?: number;
    filter?: string;
  }

  interface JsonObject {
    [key: string]: unknown;
  }

  interface SmsApi {
    send(options: SendSmsOptions): Promise<SendSmsResult>;
    balance(): Promise<BalanceResult>;
    delivery(jobId: string | number): Promise<DeliveryResult>;
  }

  interface MessagesApi {
    send(body: MessageBody, options?: SendMessageOptions): Promise<MessageResult>;
    get(id: string): Promise<MessageResult>;
    list(options?: ListMessagesOptions): Promise<JsonObject>;
  }

  interface VerifyLinkApi {
    create(body: VerifyLinkBody): Promise<VerifyLinkResult>;
    verify(token: string): Promise<VerifyLinkResult>;
    get(id: string): Promise<VerifyLinkResult>;
    cancel(id: string): Promise<VerifyLinkResult>;
    parseRedirect(redirectUrl: string): string | null;
    getVerifyToken(redirectUrl: string): string | null;
  }

  interface EmailVerifyApi {
    check(email: string): Promise<EmailCheckResult>;
    batch(emails: string[], options?: EmailBatchOptions): Promise<EmailBatchResult>;
    batchStatus(batchId: string, options?: EmailBatchStatusOptions): Promise<JsonObject>;
  }

  class SmsGatewayHubError extends Error {
    constructor(message: string, options?: { status?: number; code?: string; channel?: string | null; raw?: string | null });
    /** HTTP status, 0 for network/config errors. */
    status: number;
    /** e.g. "bad_request", "13", "http_502", "network_error", "timeout", "config_error". */
    code: string;
    channel: string | null;
    /** Response body text, clipped to 2000 chars. */
    raw: string | null;
  }

  /** Returns the `vl_token` query value from a full redirect URL, or null. */
  function parseRedirect(redirectUrl: string): string | null;
  /** Returns the `vl_token` query value from a full redirect URL, or null. */
  function getVerifyToken(redirectUrl: string): string | null;

  const VERSION: string;
  /** Same class as the module export, for `const { SmsGatewayHub } = require('smsgatewayhub')`. */
  const SmsGatewayHub: SmsGatewayHubConstructor;
}

interface SmsGatewayHubConstructor {
  new (options?: SmsGatewayHub.ClientOptions): SmsGatewayHub;
  parseRedirect(redirectUrl: string): string | null;
  getVerifyToken(redirectUrl: string): string | null;
}

declare class SmsGatewayHub {
  constructor(options?: SmsGatewayHub.ClientOptions);
  readonly baseUrl: string;
  readonly timeout: number;
  readonly maxRetries: number;
  readonly headers: { [name: string]: string };
  readonly sms: SmsGatewayHub.SmsApi;
  readonly messages: SmsGatewayHub.MessagesApi;
  readonly verifyLink: SmsGatewayHub.VerifyLinkApi;
  readonly emailVerify: SmsGatewayHub.EmailVerifyApi;
  static parseRedirect(redirectUrl: string): string | null;
  static getVerifyToken(redirectUrl: string): string | null;
}

export = SmsGatewayHub;

// OneTap Verify: passwordless login with a one-time link sent over WhatsApp, SMS or Email.
// Run: SGH_CPAAS_KEY=sghcp_xxxx node examples/onetap_verify_flow.js
'use strict';

const http = require('http');
const SmsGatewayHub = require('..'); // in your app: require('smsgatewayhub')

const client = new SmsGatewayHub();

async function startLogin(mobile) {
  // 1. Create the verification. {{link}} is replaced server-side by the one-time link.
  const vl = await client.verifyLink.create({
    to: mobile,
    channels: ['whatsapp', 'sms'],
    fallbackAfter: 60,
    expiry: 600,
    redirectUrl: 'http://localhost:3000/onetap/callback',
    state: 'session-abc123',
    appName: 'My App',
    sms: { text: 'Tap to sign in to My App: {{link}}', sender: 'SGHTST' }
  });
  console.log('Created', vl.id, vl.status);
  return vl;
}

// 2. The user taps the link and lands on your redirectUrl with ?vl_token=...
http.createServer(async function (req, res) {
  if (req.url.indexOf('/onetap/callback') !== 0) {
    res.statusCode = 404;
    res.end();
    return;
  }
  const token = SmsGatewayHub.getVerifyToken('http://localhost:3000' + req.url);
  if (!token) {
    res.statusCode = 400;
    res.end('Missing token');
    return;
  }
  try {
    // 3. Confirm the token server-side (valid once).
    const result = await client.verifyLink.verify(token);
    res.end('Signed in: ' + JSON.stringify(result));
  } catch (err) {
    res.statusCode = 401;
    res.end('Verification failed: ' + err.code);
  }
}).listen(3000, function () {
  startLogin(process.env.MOBILE || '919800000001').catch(function (err) {
    console.error(err.code, err.message);
  });
});

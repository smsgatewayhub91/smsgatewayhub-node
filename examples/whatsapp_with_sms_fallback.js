// Send a WhatsApp template and fall back to SMS if it is not delivered within 5 minutes.
// Run: SGH_CPAAS_KEY=sghcp_xxxx node examples/whatsapp_with_sms_fallback.js
'use strict';

const SmsGatewayHub = require('..'); // in your app: require('smsgatewayhub')

async function main() {
  const client = new SmsGatewayHub(); // reads SGH_CPAAS_KEY

  const msg = await client.messages.send({
    channels: ['whatsapp', 'sms'],
    to: '919800000001',
    fallbackAfter: 300,
    ref: 'order-1234',
    callbackUrl: 'https://example.com/hooks/smsgatewayhub',
    whatsapp: {
      template: 'order_shipped',
      language: 'en',
      variables: ['Asha', '#1234']
    },
    sms: {
      text: 'Hi Asha, your order #1234 has been shipped.',
      sender: 'SGHTST',
      templateId: '1207160000000000000',
      entityId: '1201160000000000000'
    }
  }, { idempotencyKey: 'order-1234-shipped' }); // optional; one is generated when omitted

  console.log('Message id:', msg.id, 'status:', msg.status);

  const latest = await client.messages.get(msg.id);
  console.log(JSON.stringify(latest, null, 2));
}

main().catch(function (err) {
  console.error(err.status, err.code, err.message, err.channel || '');
  process.exitCode = 1;
});

// Send an SMS with the classic SMS API.
// Run: SGH_API_KEY=xxxx node examples/send_sms.js
'use strict';

const SmsGatewayHub = require('..'); // in your app: require('smsgatewayhub')

async function main() {
  const client = new SmsGatewayHub(); // reads SGH_API_KEY from the environment

  try {
    const result = await client.sms.send({
      senderId: 'SGHTST',
      to: ['919800000001', '919800000002'],
      text: 'Your order #1234 has been shipped.',
      channel: 'transactional',
      entityId: '1201160000000000000',
      dltTemplateId: '1207160000000000000'
    });
    console.log('JobId:', result.jobId);
    result.messages.forEach(function (m) {
      console.log(m.number, '->', m.messageId);
    });
  } catch (err) {
    if (err instanceof SmsGatewayHub.SmsGatewayHubError) {
      console.error('Failed:', err.code, err.message);
    } else {
      throw err;
    }
  }
}

main();

// Verify one email address, then a small batch.
// Run: SGH_CPAAS_KEY=sghcp_xxxx node examples/email_verify.js
'use strict';

const SmsGatewayHub = require('..'); // in your app: require('smsgatewayhub')

function wait(ms) {
  return new Promise(function (resolve) { setTimeout(resolve, ms); });
}

async function main() {
  const client = new SmsGatewayHub();

  const one = await client.emailVerify.check('someone@example.com');
  console.log(one.result, one.reason || '', one.suggestion || '');

  const batch = await client.emailVerify.batch(
    ['a@example.com', 'b@example.org', 'info@example.net'],
    { name: 'October signups' }
  );
  console.log('Batch', batch.batchId);

  for (let i = 0; i < 10; i++) {
    const status = await client.emailVerify.batchStatus(batch.batchId, { results: true, page: 1, pageSize: 100 });
    console.log(JSON.stringify(status));
    if (status.status === 'completed' || status.status === 'done') break;
    await wait(3000);
  }
}

main().catch(function (err) {
  console.error(err.code, err.message);
  process.exitCode = 1;
});

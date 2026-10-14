// Fetch delivery reports for a job.
// Run: SGH_API_KEY=xxxx node examples/delivery.js 20047
'use strict';

const SmsGatewayHub = require('..'); // in your app: require('smsgatewayhub')

async function main() {
  const jobId = process.argv[2];
  if (!jobId) {
    console.error('Usage: node examples/delivery.js <jobId>');
    process.exitCode = 1;
    return;
  }
  const client = new SmsGatewayHub();
  const result = await client.sms.delivery(jobId);
  result.reports.forEach(function (r) {
    console.log(r.messageId, r.status, r.deliveredAt);
  });
}

main().catch(function (err) {
  console.error(err.code, err.message);
  process.exitCode = 1;
});

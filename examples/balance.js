// Check your SMS balance.
// Run: SGH_API_KEY=xxxx node examples/balance.js
'use strict';

const SmsGatewayHub = require('..'); // in your app: require('smsgatewayhub')

async function main() {
  const client = new SmsGatewayHub();
  const result = await client.sms.balance();
  // e.g. { Promo: 9988, Trans: 0 }
  Object.keys(result.balances).forEach(function (name) {
    console.log(name + ':', result.balances[name]);
  });
}

main().catch(function (err) {
  console.error(err.code, err.message);
  process.exitCode = 1;
});

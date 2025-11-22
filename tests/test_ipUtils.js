const { ip2long, long2ip } = require('../src/ipUtils');
const assert = require('assert');

console.log('Testing ipUtils...');

const testCases = [
    { ip: '0.0.0.0', long: 0 },
    { ip: '127.0.0.1', long: 2130706433 },
    { ip: '255.255.255.255', long: 4294967295 },
    { ip: '192.168.1.1', long: 3232235777 },
    { ip: '10.0.0.1', long: 167772161 }
];

testCases.forEach(({ ip, long }) => {
    const l = ip2long(ip);
    const i = long2ip(long);

    console.log(`IP: ${ip} -> Long: ${l} (Expected: ${long})`);
    console.log(`Long: ${long} -> IP: ${i} (Expected: ${ip})`);

    assert.strictEqual(l, long, `ip2long failed for ${ip}`);
    assert.strictEqual(i, ip, `long2ip failed for ${long}`);
});

console.log('ipUtils tests passed!');

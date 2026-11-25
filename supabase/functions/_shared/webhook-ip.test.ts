import { isPublicIpv4, isPublicIpv6 } from './webhook-ip.ts';

Deno.test('IPv4 public and special-use ranges', () => {
  for (const address of ['8.8.8.8', '1.1.1.1', '203.1.2.3']) {
    if (!isPublicIpv4(address)) throw new Error(`Expected public IPv4: ${address}`);
  }
  for (const address of [
    '0.0.0.0', '10.1.2.3', '127.0.0.1', '100.64.0.1', '169.254.1.1',
    '172.16.0.1', '192.0.0.1', '192.0.2.10', '192.168.1.1', '192.88.99.1',
    '198.18.0.1', '198.51.100.1', '203.0.113.1', '224.0.0.1', '255.255.255.255',
    'not-an-ip', '1.2.3.999',
  ]) {
    if (isPublicIpv4(address)) throw new Error(`Expected blocked IPv4: ${address}`);
  }
});

Deno.test('IPv6 global-unicast and special-use ranges', () => {
  for (const address of ['2606:4700:4700::1111', '2001:4860:4860::8888', '2001:200::1']) {
    if (!isPublicIpv6(address)) throw new Error(`Expected public IPv6: ${address}`);
  }
  for (const address of [
    '::', '::1', 'fc00::1', 'fd00::1', 'fe80::1', 'ff02::1',
    '2001::1', '2001:10::1', '2001:80::1', '2001:1ff::1', '2001:db8::1', '2002::1', '3fff::1',
    '::ffff:8.8.8.8', '4fff::1', 'invalid',
  ]) {
    if (isPublicIpv6(address)) throw new Error(`Expected blocked IPv6: ${address}`);
  }
});

// Conservative IP-address screening for webhook SSRF defense-in-depth.
// DNS validation is not connection pinning: production egress must also be restricted.
export function isPublicIpv4(address: string) {
  const parts = address.split('.').map(Number);
  if (parts.length !== 4 || parts.some(value => !Number.isInteger(value) || value < 0 || value > 255)) return false;
  const [a, b, c] = parts;
  return a !== 0 && a !== 10 && a !== 127 && a < 224
    && !(a === 100 && b >= 64 && b <= 127)
    && !(a === 169 && b === 254)
    && !(a === 172 && b >= 16 && b <= 31)
    && !(a === 192 && (b === 0 || b === 168))
    && !(a === 192 && b === 88 && c === 99)
    && !(a === 198 && (b === 18 || b === 19 || (b === 51 && c === 100)))
    && !(a === 203 && b === 0 && c === 113);
}

function parseIPv6Groups(address: string): number[] | null {
  let value = address.toLowerCase();
  if (!value || value.includes('%')) return null;

  // Convert a trailing IPv4 address into two hexadecimal groups.
  if (value.includes('.')) {
    const lastColon = value.lastIndexOf(':');
    if (lastColon < 0) return null;
    const ipv4 = value.slice(lastColon + 1);
    const octets = ipv4.split('.').map(Number);
    if (octets.length !== 4 || octets.some(o => !Number.isInteger(o) || o < 0 || o > 255)) return null;
    value = value.slice(0, lastColon) + ':' + ((octets[0] << 8) | octets[1]).toString(16)
      + ':' + ((octets[2] << 8) | octets[3]).toString(16);
  }

  if (value.includes(':::') || (value.match(/::/g)?.length ?? 0) > 1) return null;
  const hasCompression = value.includes('::');
  const [leftRaw, rightRaw = ''] = hasCompression ? value.split('::') : [value, ''];
  const left = leftRaw ? leftRaw.split(':') : [];
  const right = rightRaw ? rightRaw.split(':') : [];
  const parse = (part: string) => /^[0-9a-f]{1,4}$/.test(part) ? Number.parseInt(part, 16) : null;
  const leftGroups = left.map(parse);
  const rightGroups = right.map(parse);
  if (leftGroups.includes(null) || rightGroups.includes(null)) return null;
  const groups = [...leftGroups as number[], ...rightGroups as number[]];
  if (hasCompression) {
    const zeros = 8 - groups.length;
    if (zeros < 1) return null;
    return [...leftGroups as number[], ...Array(zeros).fill(0), ...rightGroups as number[]];
  }
  return groups.length === 8 ? groups : null;
}

export function isPublicIpv6(address: string) {
  const groups = parseIPv6Groups(address);
  if (!groups) return false;
  const [first, second] = groups;
  // Restrict to global-unicast 2000::/3 and exclude special-use/documentation/tunnel ranges.
  return first >= 0x2000 && first <= 0x3fff
    && !(first === 0x2001 && second <= 0x007f) // protocol assignments, transition and special-purpose ranges
    && !(first === 0x2001 && second === 0x0db8) // documentation
    && first !== 0x2002 // 6to4
    && !(first === 0x3fff && second <= 0x0fff); // documentation
}

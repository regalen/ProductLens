/**
 * SSRF protection — returns true if the URL resolves to a private/loopback address
 * that should not be reachable from the server.
 */
export function isPrivateUrl(urlStr: string): boolean {
  let parsed: URL;
  try {
    parsed = new URL(urlStr);
  } catch {
    // Unparseable URL — treat as unsafe
    return true;
  }

  const hostname = parsed.hostname.toLowerCase();

  // Strip IPv6 brackets
  const host = hostname.startsWith("[") && hostname.endsWith("]")
    ? hostname.slice(1, -1)
    : hostname;

  // Loopback / localhost
  if (host === "localhost" || host === "127.0.0.1" || host === "::1") {
    return true;
  }

  // 0.0.0.0
  if (host === "0.0.0.0") {
    return true;
  }

  // IPv6 loopback variants
  if (host === "0:0:0:0:0:0:0:1" || host === "::1") {
    return true;
  }

  // IPv6 Unique Local (fc00::/7 — fc00:: and fd00::)
  if (/^f[cd][0-9a-f]{2}:/i.test(host)) {
    return true;
  }

  // IPv4 private ranges
  const ipv4Match = host.match(
    /^(\d{1,3})\.(\d{1,3})\.(\d{1,3})\.(\d{1,3})$/
  );
  if (ipv4Match) {
    const [, a, b, c] = ipv4Match.map(Number);

    // 127.x.x.x
    if (a === 127) return true;

    // 10.x.x.x
    if (a === 10) return true;

    // 172.16.x.x – 172.31.x.x
    if (a === 172 && b !== undefined && b >= 16 && b <= 31) return true;

    // 192.168.x.x
    if (a === 192 && b === 168) return true;

    // 169.254.x.x (link-local)
    if (a === 169 && b === 254) return true;
  }

  return false;
}

import axios, { AxiosRequestConfig, AxiosResponse } from "axios";
import dns from "dns";
import http from "http";
import https from "https";

/**
 * Returns true if the given IP address (not hostname) falls within a
 * private, loopback, or link-local range.
 */
export function isPrivateIp(ip: string): boolean {
  const host = ip.toLowerCase();

  // Loopback
  if (host === "127.0.0.1" || host === "::1" || host === "0:0:0:0:0:0:0:1") {
    return true;
  }

  // 0.0.0.0
  if (host === "0.0.0.0") {
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
    const [, a, b] = ipv4Match.map(Number);

    if (a === 127) return true;
    if (a === 10) return true;
    if (a === 172 && b !== undefined && b >= 16 && b <= 31) return true;
    if (a === 192 && b === 168) return true;
    if (a === 169 && b === 254) return true;
  }

  return false;
}

/**
 * SSRF protection — returns true if the URL's hostname is a known
 * private/loopback address. This catches literal-IP URLs; DNS-resolved
 * addresses are validated separately by the SSRF-safe HTTP agents.
 */
export function isPrivateUrl(urlStr: string): boolean {
  let parsed: URL;
  try {
    parsed = new URL(urlStr);
  } catch {
    return true;
  }

  const hostname = parsed.hostname.toLowerCase();
  const host = hostname.startsWith("[") && hostname.endsWith("]")
    ? hostname.slice(1, -1)
    : hostname;

  if (host === "localhost") return true;

  return isPrivateIp(host);
}

/**
 * Custom DNS lookup that rejects resolutions to private IPs.
 * Passed as the `lookup` option to http(s).Agent so that every connection
 * (including redirect hops) is validated after DNS resolution.
 *
 * Must mirror the caller's `options.all` shape: Node's HTTP agent (Node 20+
 * with autoSelectFamily / HappyEyeballs) calls lookup with `all: true` and
 * expects an array of `{address, family}` back; older callers may use
 * `all: false` and expect a single (address, family) pair. Returning the
 * wrong shape causes Node to throw ERR_INVALID_IP_ADDRESS: undefined.
 */
function ssrfSafeLookup(
  hostname: string,
  options: dns.LookupOptions,
  // The agent's lookup callback signature is overloaded depending on options.all.
  callback: (err: NodeJS.ErrnoException | null, ...args: unknown[]) => void,
): void {
  if (options.all === true) {
    dns.lookup(hostname, { ...options, all: true }, (err, addresses) => {
      if (err) return callback(err);
      for (const entry of addresses) {
        if (isPrivateIp(entry.address)) {
          return callback(
            new Error(
              `URL resolves to a private/internal address (${entry.address})`,
            ) as NodeJS.ErrnoException,
          );
        }
      }
      callback(null, addresses);
    });
    return;
  }

  dns.lookup(hostname, { ...options, all: false }, (err, address, family) => {
    if (err) return callback(err);
    if (isPrivateIp(address)) {
      return callback(
        new Error(
          `URL resolves to a private/internal address (${address})`,
        ) as NodeJS.ErrnoException,
      );
    }
    callback(null, address, family);
  });
}

const ssrfSafeHttpAgent = new http.Agent({ lookup: ssrfSafeLookup } as http.AgentOptions);
const ssrfSafeHttpsAgent = new https.Agent({ lookup: ssrfSafeLookup } as https.AgentOptions);

const ALLOWED_PROTOCOLS = new Set(["http:", "https:"]);

export async function safeAxiosGet(
  url: string,
  config?: AxiosRequestConfig
): Promise<AxiosResponse> {
  let parsed: URL;
  try {
    parsed = new URL(url);
  } catch {
    throw new Error("Invalid URL");
  }
  if (!ALLOWED_PROTOCOLS.has(parsed.protocol)) {
    throw new Error("Only http(s) URLs are allowed");
  }
  if (isPrivateUrl(parsed.href)) {
    throw new Error("URL points to a private/internal address");
  }
  return axios.get(parsed.href, {
    ...config,
    httpAgent: ssrfSafeHttpAgent,
    httpsAgent: ssrfSafeHttpsAgent,
  });
}

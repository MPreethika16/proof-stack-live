import { lookup } from "node:dns/promises";
import { isIP } from "node:net";
import { EvaluationServiceError } from "@/lib/errors";

const BLOCKED_HOSTNAMES = new Set([
  "localhost",
  "metadata.google.internal",
  "metadata.google.com",
  "kubernetes.default",
  "kubernetes.default.svc",
]);

const BLOCKED_HOSTNAME_SUFFIXES = [
  ".localhost",
  ".local",
  ".internal",
  ".lan",
  ".home",
  ".corp",
];

export interface PublicUrl {
  href: string;
  hostname: string;
  addresses: string[];
}

function ipv4ToInt(ip: string): number | null {
  const parts = ip.split(".");
  if (parts.length !== 4) return null;
  const nums = parts.map((part) => Number(part));
  if (nums.some((n) => !Number.isInteger(n) || n < 0 || n > 255)) return null;
  return ((nums[0] << 24) >>> 0) + (nums[1] << 16) + (nums[2] << 8) + nums[3];
}

function ipv4InCidr(ip: number, base: string, bits: number): boolean {
  const baseInt = ipv4ToInt(base);
  if (baseInt == null) return false;
  const mask = bits === 0 ? 0 : (~0 << (32 - bits)) >>> 0;
  return (ip & mask) === (baseInt & mask);
}

function isBlockedIPv4(ip: string): boolean {
  const value = ipv4ToInt(ip);
  if (value == null) return true;
  return (
    ipv4InCidr(value, "0.0.0.0", 8) ||
    ipv4InCidr(value, "10.0.0.0", 8) ||
    ipv4InCidr(value, "100.64.0.0", 10) ||
    ipv4InCidr(value, "127.0.0.0", 8) ||
    ipv4InCidr(value, "169.254.0.0", 16) ||
    ipv4InCidr(value, "172.16.0.0", 12) ||
    ipv4InCidr(value, "192.0.0.0", 24) ||
    ipv4InCidr(value, "192.0.2.0", 24) ||
    ipv4InCidr(value, "192.168.0.0", 16) ||
    ipv4InCidr(value, "198.18.0.0", 15) ||
    ipv4InCidr(value, "198.51.100.0", 24) ||
    ipv4InCidr(value, "203.0.113.0", 24) ||
    ipv4InCidr(value, "224.0.0.0", 4) ||
    ipv4InCidr(value, "240.0.0.0", 4)
  );
}

function isBlockedIPv6(ip: string): boolean {
  const normalized = ip.toLowerCase();
  if (normalized === "::" || normalized === "::1") return true;
  if (normalized.startsWith("fc") || normalized.startsWith("fd")) return true;
  if (normalized.startsWith("fe80")) return true;
  if (normalized.startsWith("ff")) return true;
  if (normalized.startsWith("::ffff:")) {
    const mapped = normalized.slice("::ffff:".length);
    if (mapped.includes(".")) return isBlockedIPv4(mapped);
  }
  return false;
}

function isBlockedAddress(address: string): boolean {
  const version = isIP(address);
  if (version === 4) return isBlockedIPv4(address);
  if (version === 6) return isBlockedIPv6(address);
  return true;
}

function hostnameLooksUnsafe(hostname: string): boolean {
  const host = hostname.replace(/^\[|\]$/g, "").toLowerCase();
  if (BLOCKED_HOSTNAMES.has(host)) return true;
  if (BLOCKED_HOSTNAME_SUFFIXES.some((suffix) => host.endsWith(suffix))) return true;
  if (host.endsWith(".onion")) return true;
  const ipVersion = isIP(host);
  if (ipVersion === 4) return isBlockedIPv4(host);
  if (ipVersion === 6) return isBlockedIPv6(host);
  return false;
}

export async function assertPublicHttpUrl(raw: string): Promise<PublicUrl> {
  let parsed: URL;
  try {
    parsed = new URL(raw.trim());
  } catch {
    throw new EvaluationServiceError("The supplied URL is not valid.", 400);
  }

  if (parsed.protocol !== "http:" && parsed.protocol !== "https:") {
    throw new EvaluationServiceError("Only http and https URLs are allowed.", 400);
  }
  if (parsed.username || parsed.password) {
    throw new EvaluationServiceError("URLs with credentials are not allowed.", 400);
  }
  if (hostnameLooksUnsafe(parsed.hostname)) {
    throw new EvaluationServiceError(
      "That URL targets a private or non-public host and cannot be inspected.",
      400
    );
  }

  let records: Array<{ address: string }>;
  try {
    records = await lookup(parsed.hostname, { all: true, verbatim: true });
  } catch {
    throw new EvaluationServiceError("The hostname could not be resolved.", 400);
  }

  if (records.length === 0) {
    throw new EvaluationServiceError("The hostname could not be resolved.", 400);
  }

  const addresses = records.map((record) => record.address);
  if (addresses.some(isBlockedAddress)) {
    throw new EvaluationServiceError(
      "That URL resolves to a private or link-local address and cannot be inspected.",
      400
    );
  }

  // DNS-rebinding check: resolve again and require the same public set.
  let again: Array<{ address: string }>;
  try {
    again = await lookup(parsed.hostname, { all: true, verbatim: true });
  } catch {
    throw new EvaluationServiceError("The hostname could not be re-validated.", 400);
  }
  const second = again.map((record) => record.address).sort().join(",");
  const first = [...addresses].sort().join(",");
  if (second !== first || again.some((record) => isBlockedAddress(record.address))) {
    throw new EvaluationServiceError(
      "The hostname failed DNS rebinding checks and cannot be inspected.",
      400
    );
  }

  parsed.hash = "";
  return {
    href: parsed.toString(),
    hostname: parsed.hostname,
    addresses,
  };
}

export async function assertRequestUrlPublic(raw: string): Promise<boolean> {
  try {
    await assertPublicHttpUrl(raw);
    return true;
  } catch {
    return false;
  }
}

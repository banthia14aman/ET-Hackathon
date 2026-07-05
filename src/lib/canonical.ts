// FROZEN — canonical serialization + hashing for the audit chain. Owned by TEAM LEAD.
// All input_hash/output_hash values MUST be sha256Hex(canonicalJson(x)).

/** Deterministic JSON: recursively sorted keys, undefined-valued keys dropped, stable numbers. */
export function canonicalJson(value: unknown): string {
  return stringify(value);
}

function stringify(v: unknown): string {
  if (v === null) return 'null';
  switch (typeof v) {
    case 'string':
      return JSON.stringify(v);
    case 'boolean':
      return v ? 'true' : 'false';
    case 'number':
      if (!Number.isFinite(v)) throw new Error('canonicalJson: non-finite number');
      return Object.is(v, -0) ? '0' : String(v);
    case 'object':
      break;
    default:
      throw new Error(`canonicalJson: unsupported type ${typeof v}`);
  }
  if (Array.isArray(v)) return `[${v.map(stringify).join(',')}]`;
  const o = v as Record<string, unknown>;
  const keys = Object.keys(o).filter((k) => o[k] !== undefined).sort();
  return `{${keys.map((k) => `${JSON.stringify(k)}:${stringify(o[k])}`).join(',')}}`;
}

/** SHA-256 hex digest via WebCrypto. Async is unavoidable — arbiter is therefore async. */
export async function sha256Hex(input: string): Promise<string> {
  const buf = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(input));
  return Array.from(new Uint8Array(buf), (b) => b.toString(16).padStart(2, '0')).join('');
}

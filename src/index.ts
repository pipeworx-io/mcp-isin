interface McpToolDefinition {
  name: string;
  description: string;
  /** Human-facing one-liner (fleet #1967). Optional; consumers fall back to
   *  description. Kept in step with shared/src/types.ts — scripts/lib/
   *  check-inlined-types.mjs reports drift at publish time. */
  summary?: string;
  inputSchema: {
    type: 'object';
    properties: Record<string, unknown>;
    required?: string[];
    anyOf?: Array<{ required: string[] }>;
    oneOf?: Array<{ required: string[] }>;
    allOf?: Array<{ required: string[] }>;
  };
  outputSchema?: Record<string, unknown>;
}

interface McpToolExport {
  tools: McpToolDefinition[];
  callTool: (name: string, args: Record<string, unknown>) => Promise<unknown>;
  meter?: { credits: number };
  cost?: Record<string, unknown>;
  provider?: string;
}

/**
 * Securities-identifier validation MCP (ISIN / CUSIP).
 *
 * Keyless, offline check-digit validation for the identifiers used across
 * financial data: ISIN (ISO 6166, 12 chars), CUSIP (9 chars, US/Canada), and
 * CUSIP→ISIN conversion. Pure algorithm — no API, no key. Validates the
 * FORMAT/checksum; it does not look up the issuer (use a securities data pack
 * for that).
 */


// ISIN check digit: expand letters (A=10..Z=35) to digits, then Luhn.
function isinCheckDigit(first11: string): number {
  let s = '';
  for (const ch of first11) s += /[0-9]/.test(ch) ? ch : (ch.charCodeAt(0) - 55).toString();
  let sum = 0, dbl = true;
  for (let i = s.length - 1; i >= 0; i--) {
    let d = s.charCodeAt(i) - 48;
    if (dbl) { d *= 2; if (d > 9) d -= 9; }
    sum += d; dbl = !dbl;
  }
  return (10 - (sum % 10)) % 10;
}

// CUSIP check digit (mod-10 with alternate doubling; letters A=10.., *=36 @=37 #=38).
function cusipCheckDigit(first8: string): number | null {
  let sum = 0;
  for (let i = 0; i < 8; i++) {
    const c = first8[i];
    let v: number;
    if (/[0-9]/.test(c)) v = +c;
    else if (/[A-Z]/.test(c)) v = c.charCodeAt(0) - 55;
    else if (c === '*') v = 36;
    else if (c === '@') v = 37;
    else if (c === '#') v = 38;
    else return null;
    if (i % 2 === 1) v *= 2;
    sum += Math.floor(v / 10) + (v % 10);
  }
  return (10 - (sum % 10)) % 10;
}

const tools: McpToolExport['tools'] = [
  {
    name: 'validate_isin',
    description: 'Validate an ISIN (International Securities Identification Number, ISO 6166 — 12 chars, e.g. "US0378331005"). Checks structure + the mod-10 check digit and returns the ISO country prefix and NSIN. Keyless/offline; does NOT resolve the issuer.',
    inputSchema: { type: 'object', properties: { isin: { type: 'string', description: 'A 12-character ISIN, e.g. "US0378331005".' } }, required: ['isin'] },
  },
  {
    name: 'validate_cusip',
    description: 'Validate a CUSIP (9-char US/Canada securities identifier, e.g. "037833100"). Checks structure + the check digit.',
    inputSchema: { type: 'object', properties: { cusip: { type: 'string', description: 'A 9-character CUSIP, e.g. "037833100".' } }, required: ['cusip'] },
  },
  {
    name: 'cusip_to_isin',
    description: 'Convert a CUSIP to its ISIN by prefixing the country code (default "US") and appending the computed ISIN check digit. E.g. CUSIP "037833100" -> "US0378331005".',
    inputSchema: {
      type: 'object',
      properties: {
        cusip: { type: 'string', description: 'A 9-character CUSIP.' },
        country: { type: 'string', description: 'ISO country prefix (default "US"; use "CA" for Canadian CUSIPs).' },
      },
      required: ['cusip'],
    },
  },
];

async function callTool(name: string, args: Record<string, unknown>): Promise<unknown> {
  switch (name) {
    case 'validate_isin': {
      const isin = reqStr(args, 'isin', '"US0378331005"').toUpperCase().replace(/\s/g, '');
      if (!/^[A-Z]{2}[A-Z0-9]{9}[0-9]$/.test(isin)) return { input: isin, valid: false, reason: 'Not a well-formed ISIN (expected 2 letters + 9 alphanumerics + 1 check digit).' };
      const expect = isinCheckDigit(isin.slice(0, 11));
      const ok = expect === +isin[11];
      return { input: isin, valid: ok, country_prefix: isin.slice(0, 2), nsin: isin.slice(2, 11), check_digit: +isin[11], expected_check_digit: expect, reason: ok ? 'Valid ISIN check digit.' : `Check digit ${isin[11]} is wrong; expected ${expect}.` };
    }
    case 'validate_cusip': {
      const cusip = reqStr(args, 'cusip', '"037833100"').toUpperCase().replace(/\s/g, '');
      if (!/^[0-9A-Z*@#]{9}$/.test(cusip)) return { input: cusip, valid: false, reason: 'Not a well-formed 9-character CUSIP.' };
      const expect = cusipCheckDigit(cusip.slice(0, 8));
      if (expect === null) return { input: cusip, valid: false, reason: 'Contains an invalid character.' };
      const ok = expect === +cusip[8];
      return { input: cusip, valid: ok, base: cusip.slice(0, 8), check_digit: +cusip[8], expected_check_digit: expect, reason: ok ? 'Valid CUSIP check digit.' : `Check digit ${cusip[8]} is wrong; expected ${expect}.` };
    }
    case 'cusip_to_isin': {
      const cusip = reqStr(args, 'cusip', '"037833100"').toUpperCase().replace(/\s/g, '');
      const country = (typeof args.country === 'string' ? args.country : 'US').toUpperCase();
      if (!/^[0-9A-Z*@#]{9}$/.test(cusip)) return { input: cusip, valid: false, reason: 'Not a well-formed 9-character CUSIP.' };
      if (!/^[A-Z]{2}$/.test(country)) return { input: cusip, valid: false, reason: `Invalid country prefix "${country}" (expected 2 letters like "US").` };
      const first11 = country + cusip;
      const check = isinCheckDigit(first11);
      return { cusip, country, isin: first11 + check };
    }
    default:
      throw new Error(`Unknown tool: ${name}`);
  }
}

function reqStr(args: Record<string, unknown>, key: string, ex: string): string {
  const v = args[key];
  if (typeof v !== 'string' || !v.trim()) throw new Error(`Required argument "${key}" is missing. Pass a string like ${ex}.`);
  return v;
}

export default { tools, callTool, meter: { credits: 1 } } satisfies McpToolExport;

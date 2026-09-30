// Extracts the actual campaign-attribution code shipped inside "HTML SITE"
// (the __bundler/template JSON string) and runs it in a sandboxed VM with a
// mocked browser environment. This tests the real shipped code — not a copy —
// so there is no risk of the test drifting from what ships to production.

const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');
const test = require('node:test');
const assert = require('node:assert/strict');

const SITE_PATH = path.join(__dirname, '..', 'HTML SITE');

function decodeTemplate() {
  const content = fs.readFileSync(SITE_PATH, 'utf8');
  const lines = content.split('\n');
  const line = lines[216]; // line 217, 0-indexed
  const startTag = '<script type="__bundler/template">';
  const startIdx = line.indexOf(startTag);
  const jsonStart = startIdx + startTag.length;
  const endIdx = line.lastIndexOf('</script>');
  const jsonStr = line.slice(jsonStart, endIdx);
  return JSON.parse(jsonStr);
}

function extractAttributionSource(decoded) {
  const startMarker = '// Campaign attribution: last non-direct click';
  const endMarker = 'class Component extends DCLogic {';
  const start = decoded.indexOf(startMarker);
  const end = decoded.indexOf(endMarker);
  assert.ok(start !== -1, 'attribution block start marker not found in HTML SITE');
  assert.ok(end !== -1, 'Component class marker not found in HTML SITE');
  return decoded.slice(start, end);
}

// Minimal in-memory localStorage + location mock, fresh per test.
function makeSandbox(search, now) {
  const store = new Map();
  const sandbox = {
    localStorage: {
      getItem: (k) => (store.has(k) ? store.get(k) : null),
      setItem: (k, v) => store.set(k, String(v)),
      removeItem: (k) => store.delete(k),
    },
    window: { location: { search } },
    URLSearchParams,
    JSON,
    Date: class extends Date {
      static now() {
        return now;
      }
    },
    console,
  };
  sandbox.window.localStorage = sandbox.localStorage;
  vm.createContext(sandbox);
  return sandbox;
}

function loadAttribution(source, search, now) {
  const sandbox = makeSandbox(search, now);
  vm.runInContext(source, sandbox);
  return sandbox;
}

const decoded = decodeTemplate();
const ATTRIBUTION_SOURCE = extractAttributionSource(decoded);
const DAY_MS = 24 * 60 * 60 * 1000;

test('captures all four allowlisted params from the URL on load', () => {
  const sandbox = loadAttribution(
    ATTRIBUTION_SOURCE,
    '?utm_source=google&utm_medium=cpc&utm_campaign=orlando_deep_clean&gclid=TEST123',
    1000
  );
  sandbox.captureAttribution();
  const stored = JSON.parse(sandbox.localStorage.getItem('ezcleaning_lead_attribution'));
  assert.equal(stored.utm_source, 'google');
  assert.equal(stored.utm_medium, 'cpc');
  assert.equal(stored.utm_campaign, 'orlando_deep_clean');
  assert.equal(stored.gclid, 'TEST123');
  assert.equal(stored.captured_at, 1000);
});

test('persists during navigation to a page with no query params', () => {
  const store = new Map();
  const sandboxA = makeSandbox('?utm_source=google&utm_medium=cpc&utm_campaign=spring&gclid=abc', 1000);
  vm.runInContext(ATTRIBUTION_SOURCE, sandboxA);
  sandboxA.captureAttribution();
  const savedRaw = sandboxA.localStorage.getItem('ezcleaning_lead_attribution');

  // Simulate navigating to a second page: fresh sandbox, but same underlying storage value carried over.
  const sandboxB = makeSandbox('', 2000);
  sandboxB.localStorage.setItem('ezcleaning_lead_attribution', savedRaw);
  vm.runInContext(ATTRIBUTION_SOURCE, sandboxB);
  sandboxB.captureAttribution(); // no params on this page — should be a no-op

  const attribution = sandboxB.getStoredAttributionForSubmit();
  assert.equal(attribution.utm_source, 'google');
  assert.equal(attribution.utm_campaign, 'spring');
});

test('a later direct visit (no params) does not erase stored campaign', () => {
  const sandbox = loadAttribution(ATTRIBUTION_SOURCE, '?utm_source=google&utm_campaign=spring', 1000);
  sandbox.captureAttribution();

  // Direct visit later, no query string at all.
  sandbox.window.location.search = '';
  sandbox.captureAttribution();

  const attribution = sandbox.getStoredAttributionForSubmit();
  assert.equal(attribution.utm_source, 'google');
  assert.equal(attribution.utm_campaign, 'spring');
});

test('a new campaign click replaces the previous one', () => {
  const sandbox = loadAttribution(ATTRIBUTION_SOURCE, '?utm_source=google&utm_campaign=spring&gclid=old', 1000);
  sandbox.captureAttribution();

  sandbox.window.location.search = '?utm_source=facebook&utm_campaign=summer';
  sandbox.captureAttribution();

  const attribution = sandbox.getStoredAttributionForSubmit();
  assert.equal(attribution.utm_source, 'facebook');
  assert.equal(attribution.utm_campaign, 'summer');
  // Per-field merge: a field absent from the new click keeps its last known
  // value rather than being blanked — "não substitua dados existentes por
  // valores vazios" applies field-by-field, not as an all-or-nothing swap.
  assert.equal(attribution.gclid, 'old');
});

test('a partial new click keeps unrelated previously stored fields (does not blank them with empty values)', () => {
  const sandbox = loadAttribution(ATTRIBUTION_SOURCE, '?utm_source=google&utm_medium=cpc&utm_campaign=spring&gclid=abc', 1000);
  sandbox.captureAttribution();

  // Second click only carries utm_source — must not blank the other stored fields.
  sandbox.window.location.search = '?utm_source=newsletter';
  sandbox.captureAttribution();

  const attribution = sandbox.getStoredAttributionForSubmit();
  assert.equal(attribution.utm_source, 'newsletter');
  assert.equal(attribution.utm_medium, 'cpc');
  assert.equal(attribution.utm_campaign, 'spring');
  assert.equal(attribution.gclid, 'abc');
});

test('attribution older than 90 days is discarded', () => {
  const capturedAt = 0;
  const now = 91 * DAY_MS;
  const sandbox = loadAttribution(ATTRIBUTION_SOURCE, '', now);
  sandbox.localStorage.setItem(
    'ezcleaning_lead_attribution',
    JSON.stringify({ utm_source: 'google', utm_medium: 'cpc', utm_campaign: 'spring', gclid: 'abc', captured_at: capturedAt })
  );

  // Spread into a plain object literal in this (main) realm before comparing —
  // objects built inside the vm sandbox are a different realm and fail
  // deepStrictEqual's prototype check even when structurally identical.
  const attribution = { ...sandbox.getStoredAttributionForSubmit() };
  assert.deepEqual(attribution, { utm_source: '', utm_medium: '', utm_campaign: '', gclid: '' });
});

test('attribution within 90 days is still valid', () => {
  const capturedAt = 0;
  const now = 89 * DAY_MS;
  const sandbox = loadAttribution(ATTRIBUTION_SOURCE, '', now);
  sandbox.localStorage.setItem(
    'ezcleaning_lead_attribution',
    JSON.stringify({ utm_source: 'google', utm_medium: '', utm_campaign: '', gclid: '', captured_at: capturedAt })
  );

  const attribution = sandbox.getStoredAttributionForSubmit();
  assert.equal(attribution.utm_source, 'google');
});

test('empty query values are ignored', () => {
  const sandbox = loadAttribution(ATTRIBUTION_SOURCE, '?utm_source=&utm_medium=cpc', 1000);
  sandbox.captureAttribution();
  const attribution = sandbox.getStoredAttributionForSubmit();
  assert.equal(attribution.utm_source, '');
  assert.equal(attribution.utm_medium, 'cpc');
});

test('unknown query params are never captured', () => {
  const sandbox = loadAttribution(ATTRIBUTION_SOURCE, '?utm_source=google&fbclid=shouldnotcapture&ref=other', 1000);
  sandbox.captureAttribution();
  const stored = JSON.parse(sandbox.localStorage.getItem('ezcleaning_lead_attribution'));
  assert.equal('fbclid' in stored, false);
  assert.equal('ref' in stored, false);
});

test('no attribution stored when the URL has no campaign params at all (first-ever direct visit)', () => {
  const sandbox = loadAttribution(ATTRIBUTION_SOURCE, '', 1000);
  sandbox.captureAttribution();
  assert.equal(sandbox.localStorage.getItem('ezcleaning_lead_attribution'), null);
  // Spread into a plain object literal in this (main) realm before comparing —
  // objects built inside the vm sandbox are a different realm and fail
  // deepStrictEqual's prototype check even when structurally identical.
  const attribution = { ...sandbox.getStoredAttributionForSubmit() };
  assert.deepEqual(attribution, { utm_source: '', utm_medium: '', utm_campaign: '', gclid: '' });
});

test('values longer than 500 characters are capped when captured', () => {
  const longValue = 'a'.repeat(600);
  const sandbox = loadAttribution(ATTRIBUTION_SOURCE, `?utm_campaign=${longValue}`, 1000);
  sandbox.captureAttribution();
  const attribution = sandbox.getStoredAttributionForSubmit();
  assert.equal(attribution.utm_campaign.length, 500);
});

test('a corrupted localStorage value is treated as no attribution instead of throwing', () => {
  const sandbox = loadAttribution(ATTRIBUTION_SOURCE, '', 1000);
  sandbox.localStorage.setItem('ezcleaning_lead_attribution', 'not-json{{{');
  assert.doesNotThrow(() => sandbox.getStoredAttributionForSubmit());
  // Spread into a plain object literal in this (main) realm before comparing —
  // objects built inside the vm sandbox are a different realm and fail
  // deepStrictEqual's prototype check even when structurally identical.
  const attribution = { ...sandbox.getStoredAttributionForSubmit() };
  assert.deepEqual(attribution, { utm_source: '', utm_medium: '', utm_campaign: '', gclid: '' });
});

test('onSubmit wires the stored attribution into the /api/lead payload', () => {
  assert.ok(decoded.includes('const attribution = getStoredAttributionForSubmit();'));
  assert.ok(decoded.includes('payload.utm_source = attribution.utm_source;'));
  assert.ok(decoded.includes('payload.utm_medium = attribution.utm_medium;'));
  assert.ok(decoded.includes('payload.utm_campaign = attribution.utm_campaign;'));
  assert.ok(decoded.includes('payload.gclid = attribution.gclid;'));
});

test('captureAttribution runs on page load via componentDidMount, not only on submit', () => {
  const componentDidMountIdx = decoded.indexOf('componentDidMount() {');
  const captureCallIdx = decoded.indexOf('captureAttribution();', componentDidMountIdx);
  const onSubmitIdx = decoded.indexOf('onSubmit: (e) => {');
  assert.ok(componentDidMountIdx !== -1);
  assert.ok(captureCallIdx !== -1 && captureCallIdx < onSubmitIdx, 'captureAttribution() must be called in componentDidMount, before onSubmit is ever wired');
});

test('no CRM or Resend API key appears anywhere in the shipped client template', () => {
  // Defense in depth: the browser bundle must never contain server secrets.
  assert.equal(decoded.includes('ck_live_'), false);
  assert.equal(decoded.includes('re_'), false, 'no Resend-style key prefix should appear in client code');
});

import assert from 'node:assert/strict';
import { createClient } from '@supabase/supabase-js';

const base = new URL(process.argv[2] || 'http://localhost:3000');
const admin = createClient(process.env.SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY);
const anon = createClient(process.env.SUPABASE_URL, process.env.SUPABASE_ANON_KEY);
const email = `runoot-qa-${Date.now()}@example.com`;
const fields = { race: 'Tokyo', firstName: 'Runoot QA', lastName: 'Temporary', email, preference: 'bib', consent: 'on' };
async function post(path, overrides = {}, origin = base.origin) {
  const body = new URLSearchParams();
  for (const [key, value] of Object.entries({ ...fields, ...overrides })) {
    for (const item of Array.isArray(value) ? value : [value]) body.append(key, item);
  }
  return fetch(new URL(path, base), { method: 'POST', headers: { Origin: origin }, body });
}
try {
  for (const path of ['/', '/go', '/en']) {
    const response = await fetch(new URL(path, base));
    assert.equal(response.status, 200, path);
    assert.ok((await response.text()).includes('Where do you want to run?'), path);
  }
  assert.equal((await post('/go', { consent: '' })).status, 400);
  // React Router can reject cross-origin form posts before the route action.
  assert.ok([400, 403].includes((await post('/go', {}, 'https://example.com')).status));
  assert.equal((await post('/go')).status, 200);
  assert.equal((await post('/?index', { preference: 'package' })).status, 200);
  assert.equal((await post('/?index', { race: 'Chicago' })).status, 200);
  assert.equal((await post('/en?index', { race: 'Another race', otherRace: 'Valencia Marathon' })).status, 200);
  assert.equal((await post('/go', { race: ['Tokyo', 'Cardiff', 'Another race'], otherRace: 'São Paulo Trail / 50K', preference: ['bib', 'package'] })).status, 200);
  assert.equal((await post('/go', { race: ['London', 'Another race'], otherRace: '', preference: ['bib', 'package'] })).status, 400);
  assert.equal((await post('/go', { race: [] })).status, 400);
  assert.equal((await post('/go', { preference: [] })).status, 400);
  const { data, error } = await admin.from('bib_requests').select('*').eq('email', email);
  assert.ifError(error);
  assert.equal(data.length, 5);
  const tokyo = data.find(row => row.race === 'Tokyo');
  assert.equal(tokyo.source, 'qr');
  assert.equal(tokyo.preference, 'bib');
  assert.equal(tokyo.landing_path, '/go');
  assert.equal(tokyo.email_verified, false);
  assert.ok(tokyo.consent_text && tokyo.consent_version);
  assert.equal(data.find(row => row.race === 'Chicago').source, 'site');
  assert.equal(data.find(row => row.race === 'Valencia Marathon').source, 'site');
  assert.equal(data.find(row => row.race === 'Cardiff').preference, 'both');
  assert.equal(data.find(row => row.race === 'São Paulo Trail / 50K').preference, 'both');
  assert.equal(data.find(row => row.race === 'São Paulo Trail / 50K').source, 'qr');
  assert.equal(data.some(row => row.race === 'London'), false, 'Invalid batches must not partially save');
  const denied = await anon.from('bib_requests').select('id').eq('email', email);
  assert.ok(denied.error || denied.data.length === 0);
  const restricted = await fetch(new URL('/admin/bib-requests', base), { redirect: 'manual' });
  assert.ok([302, 303, 401, 403].includes(restricted.status));
  const privacy = await fetch(new URL('/privacy-policy', base));
  assert.equal(privacy.status, 200);
  assert.ok((await privacy.text()).includes('Privacy, in plain language.'));
  console.log(`PASS ${base.origin}: real submissions, source, deduplication, custom race, validation, privacy, access controls.`);
} finally {
  const { error } = await admin.from('bib_requests').delete().eq('email', email).eq('first_name', 'Runoot QA').eq('last_name', 'Temporary');
  assert.ifError(error);
  console.log('Disposable test requests removed.');
}

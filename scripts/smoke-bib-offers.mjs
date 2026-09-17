import assert from 'node:assert/strict';
import { createClient } from '@supabase/supabase-js';
const base = new URL(process.argv[2] || 'http://127.0.0.1:3001');
const admin = createClient(process.env.SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY);
const anon = createClient(process.env.SUPABASE_URL, process.env.SUPABASE_ANON_KEY);
const email = `runoot-offer-qa-${Date.now()}@example.com`;
const fields = { firstName: 'Runoot Offer QA', lastName: 'Temporary', email, phone: '+44 7700 900123', race: 'Valencia QA', raceDate: '2027-12-05', entryType: 'bib', transferStatus: 'unknown', price: '150', currency: 'EUR', notes: 'Disposable verification record', consent: 'on' };
const post = (overrides = {}) => fetch(new URL('/offer-entry', base), { method: 'POST', headers: { Origin: base.origin }, body: new URLSearchParams({ ...fields, ...overrides }) });
try {
  for (const path of ['/', '/en']) {
    const response = await fetch(new URL(path, base));
    assert.equal(response.status, 200);
    assert.ok((await response.text()).includes('href="/offer-entry"'));
  }
  assert.ok(!(await (await fetch(new URL('/go', base))).text()).includes('href="/offer-entry"'));
  assert.equal((await fetch(new URL('/offer-entry', base))).status, 200);
  assert.equal((await post({ consent: '' })).status, 400);
  assert.equal((await post({ phone: '' })).status, 400);
  assert.equal((await post({ transferStatus: 'unassigned' })).status, 400);
  assert.equal((await post()).status, 200);
  const { data, error } = await admin.from('bib_offers').select('*').eq('email', email);
  assert.ifError(error);
  assert.equal(data.length, 1);
  assert.equal(data[0].transfer_status, 'unknown');
  assert.equal(data[0].price, 150);
  assert.equal(data[0].phone, '+44 7700 900123');
  assert.equal(data[0].race_date, '2027-12-05');
  assert.ok(data[0].consent_text && data[0].consent_version);
  const denied = await anon.from('bib_offers').select('id').eq('email', email);
  assert.ok(denied.error || denied.data.length === 0);
  const restricted = await fetch(new URL('/admin/bib-offers', base), { redirect: 'manual' });
  assert.ok([302, 303, 401, 403].includes(restricted.status));
  console.log('PASS: home-only offer link, dedicated page, real save, validation and private admin access.');
} finally {
  const { error } = await admin.from('bib_offers').delete().eq('email', email).eq('first_name', 'Runoot Offer QA').eq('last_name', 'Temporary');
  assert.ifError(error);
  console.log('Disposable offer removed.');
}

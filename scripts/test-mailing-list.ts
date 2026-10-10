import assert from "node:assert/strict";
import { randomUUID } from "node:crypto";
import { createClient } from "@supabase/supabase-js";
import type { Database } from "../app/lib/database.types";
import type { ActionFunctionArgs, LoaderFunctionArgs } from "react-router";
import { parseCampaign, parseMailingContact } from "../app/lib/mailing-list";
import { renderMailingCampaign } from "../app/lib/email/templates/mailingList";

// Disposable HTTP fixtures exercise the real Supabase query builder and provider
// adapter. Every outbound request is intercepted; no real addresses or sends.
Object.assign(process.env, { SUPABASE_URL: "https://mailing-test.invalid", SUPABASE_ANON_KEY: "fake", SUPABASE_SERVICE_ROLE_KEY: "fake", SESSION_SECRET: "mailing-test-secret", RESEND_API_KEY: "fake-send", RESEND_MARKETING_API_KEY: "fake-marketing", RESEND_LAST_MINUTE_SEGMENT_ID: "test-segment", RESEND_FROM_EMAIL: "Runoot <test@example.com>" });
type Row = Record<string, any>;
const tables: Record<string, Row[]> = { mailing_list_signups: [], mailing_list_campaigns: [], email_logs: [] };
const members: Row[] = [], broadcasts: Row[] = [], emails: Row[] = [];
let postSends = 0, ambiguousSend = false, failCreate = false, failActivation = false;
const originalFetch = globalThis.fetch;
const json = (value: unknown, status = 200) => new Response(JSON.stringify(value), { status, headers: { "content-type": "application/json" } });
globalThis.fetch = async (input, init) => {
  const url = new URL(String(input));
  const method = init?.method || "GET";
  const body = init?.body ? JSON.parse(String(init.body)) : {};
  if (url.hostname === "mailing-test.invalid") {
    const name = url.pathname.split('/').at(-1)!;
    assert.ok(tables[name], `Unexpected table ${name}`);
    let selected = tables[name].filter(row => [...url.searchParams].every(([key, filter]) => {
      if (["select", "on_conflict", "order", "limit", "offset"].includes(key)) return true;
      const dot = filter.indexOf('.'), op = filter.slice(0, dot), value = filter.slice(dot + 1);
      if (op === 'eq') return String(row[key]) === value;
      if (op === 'is') return value === 'null' && row[key] == null;
      if (op === 'gt') return row[key] != null && row[key] > value;
      if (op === 'lt') return row[key] != null && row[key] < value;
      throw new Error(`Unsupported test filter ${filter}`);
    }));
    const headers = new Headers(init?.headers);
    if (method === 'POST') {
      const existing = url.searchParams.has('on_conflict') ? tables[name].find(row => row.email === body.email) : undefined;
      if (existing && headers.get('prefer')?.includes('ignore-duplicates')) selected = [];
      else if (existing) { Object.assign(existing, body); selected = [existing]; }
      else {
        const row = { id: randomUUID(), state: 'draft', updated_at: new Date().toISOString(), created_at: new Date().toISOString(), confirmed_at: null, token_hash: null, token_expires_at: null, resend_broadcast_id: null, last_error: null, ...body };
        tables[name].push(row); selected = [row];
      }
    } else if (method === 'PATCH') selected.forEach(row => Object.assign(row, body));
    else assert.equal(method, 'GET');
    if (headers.get('accept')?.includes('vnd.pgrst.object')) return selected.length === 1 ? json(selected[0]) : json({ code: 'PGRST116', details: `The result contains ${selected.length} rows`, message: 'Object requested' }, 406);
    return json(selected);
  }
  assert.equal(url.hostname, 'api.resend.com', 'Unexpected external request');
  if (url.pathname === '/emails') { emails.push(body); return json({ id: randomUUID() }); }
  assert.equal(new Headers(init?.headers).get('Authorization'), 'Bearer fake-marketing');
  if (url.pathname === '/contacts' && method === 'POST') {
    assert.deepEqual(Object.keys(body).sort(), ['email', 'first_name', 'last_name', 'segments', 'unsubscribed'], 'Local consent/token metadata must not be sent to the provider');
    if (failActivation) return json({}, 503);
    const member = { id: randomUUID(), created_at: new Date().toISOString(), ...body };
    members.push(member); return json({ id: member.id });
  }
  if (url.pathname.startsWith('/segments/')) { assert.equal(url.pathname, '/segments/test-segment/contacts'); return json({ data: members, has_more: false }); }
  if (url.pathname.startsWith('/contacts/')) {
    const parts = url.pathname.split('/');
    const member = members.find(row => row.email === decodeURIComponent(parts[2]) || row.id === parts[2]);
    if (!member) return json({}, 404);
    if (method === 'PATCH') Object.assign(member, body);
    if (parts[3] === 'segments') {
      if (method === 'GET') return json({ data: member.segments || [], has_more: false });
      assert.equal(method, 'POST');
      if (!(member.segments || []).some((item: { id: string }) => item.id === parts[4])) member.segments = [...(member.segments || []), { id: parts[4] }];
    }
    return json(member);
  }
  if (url.pathname === '/broadcasts') {
    assert.equal(method, 'POST'); assert.equal(body.send, false, 'Create must never send');
    assert.equal(body.segment_id, 'test-segment');
    assert.ok(body.html.includes('{{{RESEND_UNSUBSCRIBE_URL}}}'));
    if (failCreate) return json({}, 503);
    const broadcast = { ...body, id: randomUUID(), status: 'draft' }; broadcasts.push(broadcast); return json({ id: broadcast.id });
  }
  if (url.pathname.startsWith('/broadcasts/')) {
    const parts = url.pathname.split('/'), broadcast = broadcasts.find(row => row.id === parts[2]);
    assert.ok(broadcast);
    if (parts[3] === 'send') {
      assert.ok(tables.mailing_list_campaigns.some(row => row.resend_broadcast_id === broadcast.id && row.state === 'sending'), 'Save broadcast ID before any send');
      postSends++; broadcast.status = 'queued';
      if (ambiguousSend) throw new Error('Response lost after provider accepted');
    }
    return json(broadcast);
  }
  throw new Error(`Unexpected URL ${url.pathname}`);
};
const client = createClient<Database>(process.env.SUPABASE_URL!, 'fake', { auth: { persistSession: false, autoRefreshToken: false } });
const form = (values: Record<string, string>) => { const data = new FormData(); Object.entries(values).forEach(([key, value]) => data.set(key, value)); return data; };
const contact = { email: 'runner@example.com', first_name: 'Runner', last_name: 'Test' };
const content = { subject: 'Last-minute updates for the weekend', preview_text: 'Bibs and hotels', body: 'Hello <script>bad()</script>\n\nOffers & news', button_label: 'View offers', button_url: 'https://www.runoot.com/?a=1&b=2' };
try {
  const signup = await import('../app/lib/mailing-list.server');
  const provider = await import('../app/lib/mailing-provider.server');
  const campaign = await import('../app/lib/mailing-campaigns.server');
  process.env.RESEND_MARKETING_API_KEY = ' fake-marketing\r\n';
  process.env.RESEND_LAST_MINUTE_SEGMENT_ID = ' test-segment\n';
  await provider.listMailingMembers();
  process.env.RESEND_MARKETING_API_KEY = 'fake\nmarketing';
  await assert.rejects(async () => provider.listMailingMembers(), /unexpected characters/);
  process.env.RESEND_MARKETING_API_KEY = 'fake-marketing';
  process.env.RESEND_LAST_MINUTE_SEGMENT_ID = 'test-segment';
  assert.equal(parseMailingContact(form({ email: ' RUNNER@EXAMPLE.COM ' })).email, contact.email);
  assert.throws(() => parseMailingContact(form({ email: 'bad\naddress' })));
  assert.deepEqual(parseCampaign(form(content)), content);
  for (const invalid of [{ button_url: 'javascript:alert(1)' }, { button_url: 'https://user:pass@example.com' }, { subject: 'Hi\r\nBcc: someone' }, { body: '{{{RESEND_UNSUBSCRIBE_URL}}}' }, { button_label: '' }]) assert.throws(() => parseCampaign(form({ ...content, ...invalid })));
  const rendered = renderMailingCampaign(content);
  assert.ok(!rendered.html.includes('<script>'));
  assert.ok(rendered.html.includes('&lt;script&gt;'));
  assert.ok(rendered.html.includes('{{{RESEND_UNSUBSCRIBE_URL}}}'));
  assert.ok(rendered.text.includes('{{{RESEND_UNSUBSCRIBE_URL}}}'));
  const offer = signup.createMailingOffer(contact, 1000)!;
  assert.deepEqual(signup.readMailingOffer(offer, 2000), contact);
  assert.equal(signup.readMailingOffer(offer, 1801000), null);
  assert.equal(signup.readMailingOffer(offer + 'tampered', 2000), null);

  const popupContact = { ...contact, email: 'popup@example.com' };
  const emailCount = emails.length;
  await signup.activateMailingFromPopup(client, popupContact);
  assert.equal(emails.length, emailCount, 'The popup click sends no extra confirmation email');
  const popupMember = members.find(row => row.email === popupContact.email)!;
  const popupConsent = tables.mailing_list_signups.find(row => row.email === popupContact.email)!;
  assert.ok(popupMember && !popupMember.unsubscribed, 'The popup click activates the subscriber immediately');
  assert.equal(popupConsent.source, 'popup');
  assert.ok(popupConsent.confirmed_at && !popupConsent.token_hash, 'Consent is recorded without an email token');
  await signup.activateMailingFromPopup(client, popupContact);
  assert.equal(members.filter(row => row.email === popupContact.email).length, 1, 'A repeated click remains idempotent');
  await provider.unsubscribeMailingMember(popupMember.id);
  await assert.rejects(() => signup.activateMailingFromPopup(client, popupContact), /support@runoot.com/);
  assert.equal(popupMember.unsubscribed, true, 'A popup click cannot reverse an opt-out');

  failActivation = true;
  await assert.rejects(() => signup.activateMailingFromPopup(client, { ...contact, email: 'popup-failure@example.com' }));
  assert.equal(tables.mailing_list_signups.find(row => row.email === 'popup-failure@example.com')?.confirmed_at, null);
  failActivation = false;
  await signup.activateMailingFromPopup(client, { ...contact, email: 'popup-failure@example.com' });
  assert.ok(tables.mailing_list_signups.find(row => row.email === 'popup-failure@example.com')?.confirmed_at);
  assert.equal(emails.length, emailCount, 'Retries also send no confirmation email');

  await signup.addMailingMemberManually(client, { ...contact, email: 'manual@example.com' }, randomUUID());
  const manualConsent = tables.mailing_list_signups.find(row => row.email === 'manual@example.com')!;
  assert.equal(manualConsent.source, 'admin');
  assert.ok(manualConsent.confirmed_at);
  await assert.rejects(() => signup.addMailingMemberManually(client, popupContact, randomUUID()), /previously unsubscribed/);
  assert.equal(popupMember.unsubscribed, true, 'Manual addition cannot reverse an opt-out');

  const adminId = randomUUID();
  const id = await campaign.saveMailingDraft(client, content, adminId);
  const saved = tables.mailing_list_campaigns.find(row => row.id === id)!;
  const initialVersion = saved.updated_at;
  await campaign.saveMailingDraft(client, content, adminId, { id, version: initialVersion });
  await assert.rejects(() => campaign.saveMailingDraft(client, content, adminId, { id, version: initialVersion }));
  const version = saved.updated_at;
  const sends = await Promise.allSettled([campaign.sendMailingCampaign(client, id, version), campaign.sendMailingCampaign(client, id, version)]);
  assert.equal(sends.filter(result => result.status === 'fulfilled').length, 1);
  assert.equal(postSends, 1, 'Repeated/concurrent sends use one broadcast');
  assert.equal(saved.state, 'submitted');
  await assert.rejects(() => campaign.sendMailingCampaign(client, id, saved.updated_at));
  const copiedId = await campaign.saveMailingDraft(client, saved as any, adminId);
  const copied = tables.mailing_list_campaigns.find(row => row.id === copiedId)!;
  assert.notEqual(copiedId, id); assert.equal(copied.state, 'draft'); assert.equal(copied.resend_broadcast_id, null);

  ambiguousSend = true;
  await assert.rejects(() => campaign.sendMailingCampaign(client, copiedId, copied.updated_at));
  assert.equal(copied.state, 'sending');
  await assert.rejects(() => campaign.sendMailingCampaign(client, copiedId, copied.updated_at));
  assert.equal(postSends, 2, 'Unknown outcomes stay locked, never resent');
  await campaign.refreshMailingCampaign(client, { ...copied } as any);
  assert.equal(copied.state, 'submitted', 'Refresh recovers the accepted provider result');
  ambiguousSend = false;
  const failedId = await campaign.saveMailingDraft(client, content, adminId);
  const failed = tables.mailing_list_campaigns.find(row => row.id === failedId)!;
  failCreate = true;
  await assert.rejects(() => campaign.sendMailingCampaign(client, failedId, failed.updated_at));
  assert.equal(failed.state, 'draft'); assert.equal(postSends, 2);
  failCreate = false;

  const subscribeRoute = await import('../app/routes/api.mailing-list.subscribe');
  const requestArgs = (origin: string, values: Record<string, string>) => ({ request: new Request('https://www.runoot.com/api/mailing-list/subscribe', { method: 'POST', headers: { origin }, body: form(values) }), params: {}, context: {} } as ActionFunctionArgs);
  const signed = signup.createMailingOffer(contact)!;
  assert.equal((await subscribeRoute.action(requestArgs('https://evil.invalid', { consent: 'yes', offer: signed }))).init?.status, 403);
  assert.equal((await subscribeRoute.action(requestArgs('https://www.runoot.com', { consent: 'no', offer: signed }))).data.success, false);
  assert.equal((await subscribeRoute.action(requestArgs('https://www.runoot.com', { consent: 'yes', offer: 'forged' }))).data.success, false);
  const routeContact = { ...contact, email: 'popup-route@example.com' };
  const routeOffer = signup.createMailingOffer(routeContact)!;
  assert.equal((await subscribeRoute.action(requestArgs('https://www.runoot.com', { consent: 'yes', offer: routeOffer }))).data.success, true);
  assert.ok(members.some(row => row.email === routeContact.email), 'The public endpoint activates the member');
  assert.equal(emails.length, emailCount, 'The public endpoint sends no confirmation email');
  const oldRoute = await import('../app/routes/mailing-list.confirm');
  const redirected = oldRoute.loader();
  assert.equal(redirected.status, 302);
  assert.equal(redirected.headers.get('location'), '/?mailing=old-link#request');
  for (const route of [await import('../app/routes/admin.mailing-list._index'), await import('../app/routes/admin.mailing-list.campaigns'), await import('../app/routes/admin.mailing-list.campaigns.$id')]) {
    const args = { request: new Request('https://www.runoot.com/admin/mailing-list'), params: {}, context: {} };
    await assert.rejects(() => route.loader(args as LoaderFunctionArgs), error => error instanceof Response && error.status === 302);
    await assert.rejects(() => route.action(args as ActionFunctionArgs), error => error instanceof Response && error.status === 302);
  }
  console.log('Mailing list checks passed: signed offers, single-click activation, no extra confirmation email, old-link redirect, opt-out, manual consent, admin guards, draft locking and ambiguous delivery. No real emails sent.');
} finally { globalThis.fetch = originalFetch; }

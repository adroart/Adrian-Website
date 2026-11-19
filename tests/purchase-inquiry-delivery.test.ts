import assert from 'node:assert/strict';
import { it } from 'node:test';
import { onRequestPost } from '../functions/api/inquire.js';

it('includes the exact artwork and optional shipping destination in the studio email', async (t) => {
  const send = t.mock.method(globalThis, 'fetch', async () => Response.json({ id: 'fixture-email' }));
  const response = await onRequestPost({
    request: new Request('https://adrianrasmussen.com/api/inquire', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'CF-Connecting-IP': '192.0.2.48' },
      body: JSON.stringify({
        inquiryType: 'purchase', name: 'Test Collector', email: 'buyer@example.test',
        pieceId: 'UL-102', pieceTitle: 'Doorways Of The Unknown - 48', purchaseSize: '90 cm',
        source: 'mandalacodes', cardNumber: 48,
        location: 'Toronto, Canada M5V & nearby',
      }),
    }),
    env: { RESEND_API_KEY: 're_test_fixture', INQUIRY_TO_EMAIL: 'studio@example.test' },
  });
  assert.equal(response.status, 200);
  assert.equal(send.mock.callCount(), 1);
  const delivery = send.mock.calls[0].arguments as unknown as [string, RequestInit];
  const email = JSON.parse(String(delivery[1].body));
  assert.equal(email.reply_to, 'buyer@example.test');
  assert.match(email.html, /Artwork ID.*UL-102/);
  assert.match(email.html, /Source.*Mandala Codes.*Card 48/);
  assert.match(email.html, /Shipping destination.*Toronto, Canada M5V &amp; nearby/);
});

it('keeps a canonical reference on a similar-artwork inquiry and ignores unsupported referrals', async (t) => {
  const send = t.mock.method(globalThis, 'fetch', async () => Response.json({ id: 'fixture-email' }));
  const submit = async (body: object) => onRequestPost({
    request: new Request('https://adrianrasmussen.com/api/inquire', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'CF-Connecting-IP': '192.0.2.51' },
      body: JSON.stringify({
        name: 'Test Collector', email: 'buyer@example.test', commissionType: 'personal', vision: 'A similar piece.',
        ...body,
      }),
    }),
    env: { RESEND_API_KEY: 're_test_fixture' },
  });

  for (const body of [
    { pieceId: 'UL-102', pieceTitle: 'Unverified title' },
    { pieceId: 'UL-102', source: 'mandalacodes', cardNumber: 49 },
    { pieceId: 'UL-999', source: 'mandalacodes', cardNumber: 48 },
    { pieceId: 'UL-102', source: 'unsupported', cardNumber: 48 },
    {},
  ]) {
    assert.equal((await submit(body)).status, 200);
  }
  const html = send.mock.calls.map(call => {
    const delivery = call.arguments as unknown as [string, RequestInit];
    return JSON.parse(String(delivery[1].body)).html as string;
  });
  assert.match(html[0], /Reference artwork.*Doorways Of The Unknown - 48.*Reference artwork ID.*UL-102/);
  assert.doesNotMatch(html[0], /Unverified title/);
  for (const message of html.slice(1)) assert.doesNotMatch(message, /Mandala Codes|Card 48|Card 49|UL-999/);
  assert.doesNotMatch(html.at(-1)!, /Reference artwork/);
});

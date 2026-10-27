import test from 'node:test';
import assert from 'node:assert/strict';
import { authDestination } from '../src/utils/navigation.js';

test('both sign-in paths retain the chosen service, day and slot', () => {
  const target = '/services/service-id?day=2026-11-02&slot=slot-id';
  assert.equal(authDestination({ role: 'attendee' }, target), target);
  assert.equal(authDestination({ role: 'organizer' }, target), target);
});

test('normal account entry goes to the appropriate workspace', () => {
  assert.equal(authDestination({ role: 'attendee' }), '/browse');
  assert.equal(authDestination({ role: 'organizer' }), '/organizer');
  assert.equal(authDestination({ role: 'admin' }), '/admin');
});

test('external and malformed return destinations use the account workspace', () => {
  for (const target of ['https://example.com', '//example.com', {}, 123, 'browse']) {
    assert.equal(authDestination({ role: 'attendee' }, target), '/browse');
  }
});

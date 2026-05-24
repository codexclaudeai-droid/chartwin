import assert from 'node:assert/strict';
import test from 'node:test';
import {
  AUTH_SESSION_CHANGED_EVENT,
  dispatchAuthSessionChangedEvent,
  subscribeAuthSessionChangedEvent,
} from '../app/auth-events.ts';

test('auth session changed event notifies subscribed session navigation and supports cleanup', () => {
  const target = new EventTarget();
  let refreshCount = 0;
  const unsubscribe = subscribeAuthSessionChangedEvent(() => {
    refreshCount += 1;
  }, target);

  dispatchAuthSessionChangedEvent(target);
  unsubscribe();
  dispatchAuthSessionChangedEvent(target);

  assert.equal(AUTH_SESSION_CHANGED_EVENT, 'chart-service-auth-session-changed');
  assert.equal(refreshCount, 1);
});

test('auth session changed event helpers are safe without a browser target', () => {
  let refreshCount = 0;
  const unsubscribe = subscribeAuthSessionChangedEvent(() => {
    refreshCount += 1;
  }, null);

  dispatchAuthSessionChangedEvent(null);
  unsubscribe();

  assert.equal(refreshCount, 0);
});

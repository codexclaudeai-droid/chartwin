import assert from 'node:assert/strict';
import test from 'node:test';
import {
  filterSupportThreads,
  getSupportThreadFilterPreset,
  SUPPORT_THREAD_FILTER_PRESETS,
} from '../app/admin/support-thread-filters.ts';

const threads = [
  { thread: { id: 'support_waiting_private', status: 'waiting', visibility: 'private' } },
  { thread: { id: 'support_answered_private', status: 'answered', visibility: 'private' } },
  { thread: { id: 'support_waiting_public', status: 'waiting', visibility: 'public' } },
];

test('support thread filter presets cover common admin queues', () => {
  assert.deepEqual(SUPPORT_THREAD_FILTER_PRESETS.map((preset) => preset.label), [
    '전체',
    '답변 대기',
    '답변 완료',
    '비공개',
  ]);

  assert.deepEqual(getSupportThreadFilterPreset('waiting'), {
    key: 'waiting',
    label: '답변 대기',
    status: 'waiting',
    visibility: '',
  });
});

test('support thread filters narrow threads by status and visibility', () => {
  assert.deepEqual(filterSupportThreads(threads, 'waiting').map((item) => item.thread.id), [
    'support_waiting_private',
    'support_waiting_public',
  ]);
  assert.deepEqual(filterSupportThreads(threads, 'answered').map((item) => item.thread.id), [
    'support_answered_private',
  ]);
  assert.deepEqual(filterSupportThreads(threads, 'private').map((item) => item.thread.id), [
    'support_waiting_private',
    'support_answered_private',
  ]);
});

test('unknown support thread filter falls back to all threads', () => {
  assert.deepEqual(filterSupportThreads(threads, 'missing').map((item) => item.thread.id), [
    'support_waiting_private',
    'support_answered_private',
    'support_waiting_public',
  ]);
});

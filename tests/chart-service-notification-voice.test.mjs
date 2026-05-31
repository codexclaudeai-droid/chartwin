import assert from 'node:assert/strict';
import test from 'node:test';

test('notification voice formats signal messages and speaks with softer Korean settings', async () => {
  const {
    formatSignalVoiceMessage,
    getStoredNotificationAudioPath,
    playNotificationVoice,
    speakNotificationVoice,
    STORED_NOTIFICATION_AUDIO_PATHS,
  } = await import('../src/domain/chart-service/notification-voice.ts');

  assert.equal(formatSignalVoiceMessage('LONG'), '매수신호발생');
  assert.equal(formatSignalVoiceMessage('SHORT'), '매도신호발생');
  assert.equal(getStoredNotificationAudioPath('매수신호발생'), STORED_NOTIFICATION_AUDIO_PATHS.signalBuy);
  assert.equal(getStoredNotificationAudioPath('매도신호발생'), STORED_NOTIFICATION_AUDIO_PATHS.signalSell);

  const calls = [];
  const spoken = [];
  const voices = [
    { name: 'English Voice', lang: 'en-US' },
    { name: 'Microsoft Heami Online (Natural) - Korean', lang: 'ko-KR' },
  ];
  class FakeUtterance {
    constructor(text) {
      this.text = text;
    }
  }

  const didSpeak = speakNotificationVoice('새 알림이 도착했어요.', {
    speechSynthesis: {
      cancel() {
        calls.push('cancel');
      },
      getVoices() {
        return voices;
      },
      speak(utterance) {
        calls.push('speak');
        spoken.push(utterance);
      },
    },
    Utterance: FakeUtterance,
  });

  assert.equal(didSpeak, true);
  assert.deepEqual(calls, ['cancel', 'speak']);
  assert.equal(spoken[0].text, '새 알림이 도착했어요.');
  assert.equal(spoken[0].lang, 'ko-KR');
  assert.equal(spoken[0].rate, 0.86);
  assert.equal(spoken[0].pitch, 1.18);
  assert.equal(spoken[0].volume, 0.95);
  assert.equal(spoken[0].voice, voices[1]);

  const audioCalls = [];
  class FakeAudio {
    constructor(src) {
      this.src = src;
      audioCalls.push(['audio', src]);
    }

    async play() {
      audioCalls.push(['play', this.src]);
    }
  }
  const didPlayStoredAudio = await playNotificationVoice('매수신호발생', {
    Audio: FakeAudio,
    fetch: async (url, init) => {
      audioCalls.push(['fetch', url, init.method]);
      return { ok: true };
    },
  });

  assert.equal(didPlayStoredAudio, true);
  assert.deepEqual(audioCalls, [
    ['fetch', STORED_NOTIFICATION_AUDIO_PATHS.signalBuy, 'HEAD'],
    ['audio', STORED_NOTIFICATION_AUDIO_PATHS.signalBuy],
    ['play', STORED_NOTIFICATION_AUDIO_PATHS.signalBuy],
  ]);
});

test('notification voice reads service notifications by situation', async () => {
  const {
    formatNotificationVoiceMessage,
  } = await import('../src/domain/chart-service/notification-voice.ts');

  assert.equal(formatNotificationVoiceMessage({
    category: 'payment',
    title: '입금확인 요청이 접수되었습니다',
  }), '입금 확인 요청이 접수되었어요. 관리자가 입금 내역을 확인할 예정이에요.');

  assert.equal(formatNotificationVoiceMessage({
    category: 'payment',
    title: '입금 확인이 완료되었습니다',
  }), '입금 확인이 완료되었어요. 구독 승인 절차로 이어질 예정이에요.');

  assert.equal(formatNotificationVoiceMessage({
    category: 'subscription',
    title: '구독이 활성화되었습니다',
  }), '구독 승인이 완료되었어요. 이제 차트를 이용할 수 있어요.');

  assert.equal(formatNotificationVoiceMessage({
    category: 'support_reply',
    title: '고객센터 답변이 등록되었습니다',
  }), '문의 답변이 등록되었어요. 고객센터에서 확인해 주세요.');

  assert.equal(formatNotificationVoiceMessage({
    category: 'support_request',
    title: '입금확인 요청',
  }), '새 입금 확인 요청 게시글이 도착했어요.');
});

test('notification voice prefers Korean female-style voices and avoids empty speech', async () => {
  const {
    speakNotificationVoice,
  } = await import('../src/domain/chart-service/notification-voice.ts');
  assert.equal(speakNotificationVoice('   ', {
    speechSynthesis: {
      cancel() {
        throw new Error('should not be called');
      },
      getVoices() {
        return [];
      },
      speak() {
        throw new Error('should not be called');
      },
    },
    Utterance: class {},
  }), false);
});

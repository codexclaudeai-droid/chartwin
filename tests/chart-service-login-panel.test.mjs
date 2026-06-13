import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import test from 'node:test';

test('login panel uses email and password instead of userId-only demo login', () => {
  const source = readFileSync(new URL('../app/login/login-panel.tsx', import.meta.url), 'utf8');

  assert.match(source, /name="email"/);
  assert.match(source, /name="password"/);
  assert.doesNotMatch(source, /name="userId"/);
  assert.doesNotMatch(source, /JSON\.stringify\(\{ userId/);
});

test('login panel lets users reveal and hide the password input', () => {
  const source = readFileSync(new URL('../app/login/login-panel.tsx', import.meta.url), 'utf8');
  const styleSource = readFileSync(new URL('../app/globals.css', import.meta.url), 'utf8');

  assert.match(source, /import \{ Eye, EyeOff \} from 'lucide-react';/);
  assert.match(source, /const \[isPasswordVisible, setIsPasswordVisible\] = useState\(false\);/);
  assert.match(source, /type=\{isPasswordVisible \? 'text' : 'password'\}/);
  assert.match(source, /aria-label=\{isPasswordVisible \? '비밀번호 숨기기' : '비밀번호 보기'\}/);
  assert.match(source, /aria-pressed=\{isPasswordVisible\}/);
  assert.match(source, /className="password-input-shell"/);
  assert.match(source, /className="password-visibility-toggle"/);
  assert.match(source, /isPasswordVisible \? <EyeOff aria-hidden="true" \/> : <Eye aria-hidden="true" \/>/);
  assert.match(styleSource, /\.password-input-shell/);
  assert.match(styleSource, /\.password-visibility-toggle/);
});

test('login panel does not expose demo account shortcuts or default credentials', () => {
  const source = readFileSync(new URL('../app/login/login-panel.tsx', import.meta.url), 'utf8');

  assert.match(source, /useState\(''\)/);
  assert.doesNotMatch(source, /demo/i);
  assert.doesNotMatch(source, /Demo1234!/);
  assert.doesNotMatch(source, /<select/);
});

test('login panel form does not leak credentials through a default GET fallback', () => {
  const source = readFileSync(new URL('../app/login/login-panel.tsx', import.meta.url), 'utf8');

  assert.match(source, /<form className="form" method="post" onSubmit=\{login\}>/);
});

test('login panel returns users to a safe redirect after authentication', () => {
  const panelSource = readFileSync(new URL('../app/login/login-panel.tsx', import.meta.url), 'utf8');
  const redirectSource = readFileSync(new URL('../app/auth-redirect.ts', import.meta.url), 'utf8');

  assert.match(panelSource, /navigateToSafeRedirect/);
  assert.match(panelSource, /new URLSearchParams\(window\.location\.search\)/);
  assert.match(redirectSource, /redirect\.startsWith\('\/'\)/);
  assert.match(redirectSource, /redirect\.startsWith\('\/\/'\)/);
  assert.match(redirectSource, /window\.location\.assign\(redirect\)/);
});

test('login panel sends admin operators to the admin dashboard after authentication', () => {
  const source = readFileSync(new URL('../app/login/login-panel.tsx', import.meta.url), 'utf8');

  assert.match(source, /primeAuthSession/);
  assert.match(source, /isAdminRole/);
  assert.match(source, /payload\.user\?\.role/);
  assert.match(source, /window\.location\.assign\('\/admin'\)/);
});

test('login panel prompts withdrawn users to rejoin instead of continuing login', () => {
  const source = readFileSync(new URL('../app/login/login-panel.tsx', import.meta.url), 'utf8');
  const pageSource = readFileSync(new URL('../app/login/page.tsx', import.meta.url), 'utf8');

  assert.match(pageSource, /withdrawn/);
  assert.match(pageSource, /<LoginPanel showWithdrawnPrompt=\{showWithdrawnPrompt\} \/>/);
  assert.match(source, /showWithdrawnPrompt/);
  assert.match(source, /Account suspended/);
  assert.match(source, /회원탈퇴로 로그인이 불가합니다/);
  assert.match(source, /회원가입을 다시 하시겠습니까/);
  assert.match(source, /window\.location\.assign\('\/signup'\)/);
  assert.match(source, /아니오/);
});

test('login panel returns normal landing logins to the landing page', () => {
  const source = readFileSync(new URL('../app/login/login-panel.tsx', import.meta.url), 'utf8');

  assert.match(source, /navigateToSafeRedirect\(new URLSearchParams\(window\.location\.search\)\)/);
  assert.match(source, /window\.location\.assign\('\/main'\)/);
});

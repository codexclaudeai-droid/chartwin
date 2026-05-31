'use client';

import { useEffect, useRef, useState } from 'react';
import { FreeTrialRequestButton } from '../shared/free-trial-request-button';

declare global {
  interface Window {
    THREE?: any;
  }
}

type ChartAccessPreviewProps = {
  signupHref?: string;
  loginHref?: string;
};

const THREE_SRC = 'https://cdnjs.cloudflare.com/ajax/libs/three.js/r128/three.min.js';

export function ChartAccessPreview({
  signupHref = '/signup?redirect=/chart',
  loginHref = '/login?redirect=/chart',
}: ChartAccessPreviewProps) {
  const mountRef = useRef<HTMLDivElement | null>(null);
  const cleanupRef = useRef<(() => void) | null>(null);
  const [ready, setReady] = useState(false);

  useEffect(() => {
    let cancelled = false;

    async function startPreview() {
      try {
        await loadScriptOnce(THREE_SRC, 'tc-three-preview-script');
        if (cancelled || !mountRef.current || !window.THREE) return;
        cleanupRef.current = mountParticlePreview(mountRef.current, window.THREE, () => {
          if (!cancelled) setReady(true);
        });
      } catch {
        setReady(true);
      }
    }

    void startPreview();

    return () => {
      cancelled = true;
      cleanupRef.current?.();
      cleanupRef.current = null;
    };
  }, []);

  return (
    <main className={`chart-preview-page${ready ? ' ready' : ''}`} aria-label="TC Chart preview">
      <div className="chart-preview-canvas" ref={mountRef} aria-hidden="true" />
      <section className="chart-preview-content" aria-labelledby="chart-preview-title">
        <img className="chart-preview-logo" src="/images/logo.png" alt="TradingCore" />
        <h1 id="chart-preview-title">TC Chart를 무료로 먼저 경험해보세요</h1>
        <p>회원가입 후 무료체험을 신청하면 실시간 차트와 전략 도구를 바로 확인할 수 있습니다.</p>
      </section>
      <div className="chart-preview-actions" aria-label="Chart preview actions">
        <FreeTrialRequestButton
          className="button chart-preview-primary"
          confirmTitle="무료체험 신청을 진행할까요?"
          confirmDescription="이미 가입된 경우 로그인 후 무료체험을 신청할 수 있습니다. 아직 회원가입 전이라면 가입을 완료한 뒤 무료체험을 바로 자동 접수해드립니다."
          confirmActionLabel="다음 절차로 진행"
          confirmCancelLabel="나중에"
          loginHref={loginHref}
          signupHref={signupHref}
          returnHref="/chart"
        >
          무료체험 신청
        </FreeTrialRequestButton>
      </div>
    </main>
  );
}

function loadScriptOnce(src: string, id: string): Promise<void> {
  if (window.THREE) return Promise.resolve();

  const existing = document.getElementById(id) as HTMLScriptElement | null;
  if (existing?.dataset.loaded === 'true') return Promise.resolve();

  return new Promise((resolve, reject) => {
    const script = existing ?? document.createElement('script');
    script.id = id;
    script.src = src;
    script.async = true;
    script.onload = () => {
      script.dataset.loaded = 'true';
      resolve();
    };
    script.onerror = () => reject(new Error('Three.js preview script failed to load'));
    if (!existing) document.head.appendChild(script);
  });
}

function mountParticlePreview(
  container: HTMLDivElement,
  THREE: any,
  onReady: () => void,
): () => void {
  const scene = new THREE.Scene();
  const camera = new THREE.PerspectiveCamera(72, 1, 0.1, 2000);
  camera.position.z = 500;

  const renderer = new THREE.WebGLRenderer({ antialias: true, alpha: true });
  renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, 2));
  container.appendChild(renderer.domElement);

  const particleCount = window.matchMedia('(max-width: 720px)').matches ? 7000 : 12000;
  const geometry = new THREE.BufferGeometry();
  const positions = new Float32Array(particleCount * 3);
  const targets = new Float32Array(particleCount * 3);
  const progress = { value: 0 };

  for (let particle = 0; particle < particleCount; particle += 1) {
    const offset = particle * 3;
    positions[offset] = (Math.random() - 0.5) * 1500;
    positions[offset + 1] = (Math.random() - 0.5) * 1500;
    positions[offset + 2] = (Math.random() - 0.5) * 1500;

    const radius = 150 + Math.random() * 54;
    const theta = Math.random() * Math.PI * 2;
    const phi = Math.acos((Math.random() * 2) - 1);
    targets[offset] = radius * Math.sin(phi) * Math.cos(theta);
    targets[offset + 1] = radius * Math.sin(phi) * Math.sin(theta);
    targets[offset + 2] = radius * Math.cos(phi);
  }

  const startPositions = positions.slice();
  geometry.setAttribute('position', new THREE.BufferAttribute(positions, 3));

  const material = new THREE.PointsMaterial({
    size: 3,
    map: createParticleTexture(THREE),
    transparent: true,
    blending: THREE.AdditiveBlending,
    depthWrite: false,
  });

  const particles = new THREE.Points(geometry, material);
  scene.add(particles);

  let frameId = 0;
  let introFrameId = 0;
  let startedAt = performance.now();
  let mouseX = 0;
  let mouseY = 0;

  function resize() {
    const width = Math.max(1, container.clientWidth);
    const height = Math.max(1, container.clientHeight);
    camera.aspect = width / height;
    camera.updateProjectionMatrix();
    renderer.setSize(width, height, false);
  }

  function updateIntro(now: number) {
    const elapsed = Math.min(1, (now - startedAt) / 3600);
    progress.value = easeInOutCubic(elapsed);
    for (let index = 0; index < positions.length; index += 1) {
      positions[index] = startPositions[index] + (targets[index] - startPositions[index]) * progress.value;
    }
    geometry.attributes.position.needsUpdate = true;
    if (elapsed < 1) {
      introFrameId = window.requestAnimationFrame(updateIntro);
    } else {
      onReady();
    }
  }

  function render() {
    frameId = window.requestAnimationFrame(render);
    particles.rotation.y += 0.002;
    particles.rotation.x += 0.001;
    camera.position.x += (mouseX - camera.position.x) * 0.04;
    camera.position.y += (-mouseY - camera.position.y) * 0.04;
    camera.lookAt(scene.position);
    renderer.render(scene, camera);
  }

  function onPointerMove(event: PointerEvent) {
    mouseX = (event.clientX - window.innerWidth / 2) * 0.05;
    mouseY = (event.clientY - window.innerHeight / 2) * 0.05;
  }

  resize();
  window.addEventListener('resize', resize);
  window.addEventListener('pointermove', onPointerMove);
  introFrameId = window.requestAnimationFrame((now) => {
    startedAt = now;
    updateIntro(now);
  });
  render();

  return () => {
    window.cancelAnimationFrame(frameId);
    window.cancelAnimationFrame(introFrameId);
    window.removeEventListener('resize', resize);
    window.removeEventListener('pointermove', onPointerMove);
    geometry.dispose();
    material.map?.dispose?.();
    material.dispose();
    renderer.dispose();
    renderer.domElement.remove();
  };
}

function createParticleTexture(THREE: any) {
  const canvas = document.createElement('canvas');
  canvas.width = 64;
  canvas.height = 64;
  const context = canvas.getContext('2d');
  if (!context) return null;

  const gradient = context.createRadialGradient(32, 32, 0, 32, 32, 32);
  gradient.addColorStop(0, 'rgba(255,255,255,1)');
  gradient.addColorStop(0.22, 'rgba(86,240,255,0.86)');
  gradient.addColorStop(0.52, 'rgba(76,141,255,0.32)');
  gradient.addColorStop(1, 'rgba(0,0,0,0)');
  context.fillStyle = gradient;
  context.fillRect(0, 0, 64, 64);
  return new THREE.CanvasTexture(canvas);
}

function easeInOutCubic(value: number): number {
  return value < 0.5
    ? 4 * value * value * value
    : 1 - Math.pow(-2 * value + 2, 3) / 2;
}

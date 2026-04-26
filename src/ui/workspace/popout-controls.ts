type CreatePopoutControlsArgs = {
  app: HTMLElement;
  onSaveScreenshot: () => void;
  onToggleFullscreen: () => void;
};

type SetupPopoutViewArgs = {
  app: HTMLElement;
  paneNo: number;
  onSaveScreenshot: () => void;
  onToggleFullscreen: () => void;
};

export function createPopoutControls({
  app,
  onSaveScreenshot,
  onToggleFullscreen,
}: CreatePopoutControlsArgs): HTMLDivElement {
  const popoutControls = document.createElement('div');
  popoutControls.style.cssText = `position:absolute;top:8px;right:10px;display:flex;gap:6px;z-index:2200;
    background:rgba(19,23,34,0.55);backdrop-filter:blur(3px);padding:4px;border-radius:8px;border:1px solid rgba(58,65,80,0.7);`;

  const mkBtn = (icon: string, title: string, onClick: () => void) => {
    const btn = document.createElement('button');
    btn.type = 'button';
    btn.title = title;
    btn.textContent = icon;
    btn.style.cssText = `background:transparent;color:#9aa3b8;border:1px solid #2f3546;cursor:pointer;
      width:28px;height:24px;border-radius:6px;font-size:14px;line-height:1;
      display:flex;align-items:center;justify-content:center;transition:all 0.15s ease;`;
    btn.addEventListener('mouseenter', () => {
      btn.style.background = '#253452';
      btn.style.color = '#ffffff';
      btn.style.borderColor = '#46618f';
    });
    btn.addEventListener('mouseleave', () => {
      btn.style.background = 'transparent';
      btn.style.color = '#9aa3b8';
      btn.style.borderColor = '#2f3546';
    });
    btn.addEventListener('click', onClick);
    return btn;
  };

  popoutControls.appendChild(mkBtn('📷', '이미지 저장 (Ctrl+S)', onSaveScreenshot));
  popoutControls.appendChild(mkBtn('⛶', '전체화면 (F)', onToggleFullscreen));
  app.appendChild(popoutControls);
  return popoutControls;
}

export function setupPopoutView({
  app,
  paneNo,
  onSaveScreenshot,
  onToggleFullscreen,
}: SetupPopoutViewArgs): void {
  document.title = `SIGMA Chart - Pane ${paneNo}`;
  createPopoutControls({
    app,
    onSaveScreenshot,
    onToggleFullscreen,
  });
}

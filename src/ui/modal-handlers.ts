import { INDICATOR_STYLE_TARGETS, createDefaultPanelState, getLineStyle } from '../indicator-panel-module';
import { INDICATOR_CATALOG } from '../catalog/indicators';
import { CUSTOM_SYMBOLS, SYMBOL_CATALOG, createSymbolIconElement, getAllSymbolCatalog, getSymbolIconUrl, persistSymbolRegistry, type SymbolCatalogItem } from '../catalog/symbols';
import { TIMEZONE_OPTIONS, UTC_OFFSET_OPTIONS, type TimezoneOption } from '../catalog/time';
import { toRgba } from '../chart/color-utils';
import { buildStrategyDefinition, type StrategyDefinition, type StrategyLang } from '../strategy/strategy-service';

function createModal(title: string, options: { anchorTop?: boolean } = {}) {
  const overlay = document.createElement('div');
  overlay.style.cssText = `position:fixed;inset:0;background:rgba(0,0,0,0.75);
    display:flex;align-items:center;justify-content:center;z-index:9000;backdrop-filter:blur(3px);`;

  const modal = document.createElement('div');
  modal.style.cssText = `background:#1c2030;border:1px solid #363a45;border-radius:10px;
    min-width:460px;max-width:640px;width:90vw;max-height:80vh;
    display:flex;flex-direction:column;color:white;overflow:hidden;
    box-shadow:0 20px 60px rgba(0,0,0,0.6);font-family:'Segoe UI',Arial,sans-serif;`;

  const header = document.createElement('div');
  header.style.cssText = `padding:16px 20px;border-bottom:1px solid #363a45;
    display:flex;justify-content:space-between;align-items:center;flex-shrink:0;`;
  header.innerHTML = `<span style="font-size:15px;font-weight:700;">${title}</span>`;

  const applyModalLayout = () => {
    const mobile = window.innerWidth <= 760;
    if (mobile) {
      overlay.style.alignItems = 'stretch';
      overlay.style.justifyContent = 'stretch';
      modal.style.minWidth = '0';
      modal.style.maxWidth = '100vw';
      modal.style.width = '100vw';
      modal.style.maxHeight = '100vh';
      modal.style.height = '100vh';
      modal.style.borderRadius = '0';
      modal.style.borderLeft = 'none';
      modal.style.borderRight = 'none';
      modal.style.borderTop = 'none';
      modal.style.marginTop = '0';
      header.style.padding = '14px 14px';
      body.style.padding = '12px 14px';
    } else {
      overlay.style.alignItems = options.anchorTop ? 'flex-start' : 'center';
      overlay.style.justifyContent = 'center';
      modal.style.minWidth = '460px';
      modal.style.maxWidth = '640px';
      modal.style.width = '90vw';
      modal.style.maxHeight = '80vh';
      modal.style.height = '';
      modal.style.marginTop = options.anchorTop ? '56px' : '0';
      modal.style.borderRadius = '10px';
      modal.style.borderLeft = '1px solid #363a45';
      modal.style.borderRight = '1px solid #363a45';
      modal.style.borderTop = '1px solid #363a45';
      header.style.padding = '16px 20px';
      body.style.padding = '16px 20px';
    }
  };

  let mounted = true;
  const onResize = () => {
    if (!mounted) return;
    applyModalLayout();
  };
  window.addEventListener('resize', onResize);

  const close = () => {
    if (!mounted) return;
    mounted = false;
    window.removeEventListener('resize', onResize);
    overlay.remove();
  };
  const xBtn  = document.createElement('button');
  xBtn.textContent = '×';
  xBtn.style.cssText = 'background:none;border:none;color:#84898e;font-size:18px;cursor:pointer;line-height:1;';
  xBtn.addEventListener('click', close);
  overlay.addEventListener('click', e => { if (e.target === overlay) close(); });
  header.appendChild(xBtn);

  const body = document.createElement('div');
  body.style.cssText = 'padding:16px 20px;overflow-y:auto;flex:1;';

  applyModalLayout();

  modal.appendChild(header); modal.appendChild(body);
  overlay.appendChild(modal); document.body.appendChild(overlay);
  return { overlay, modal, body, close };
}

export function openStrategyModal(chart: any, onApply: () => void) {
  const { body, close } = createModal('전략시그널 관리', { anchorTop: true });

  const info = document.createElement('div');
  info.style.cssText = 'font-size:12px;color:#9aa0ab;line-height:1.5;margin-bottom:12px;';
  info.textContent = '전략 목록에서 바로 적용할 수 있습니다. 전략 등록 탭에서 JS/Pine 전략을 저장하면 Pine은 JS로 변환되어 Worker에서 실행됩니다.';
  body.appendChild(info);

  const topMenu = document.createElement('div');
  topMenu.style.cssText = 'display:flex;gap:8px;margin-bottom:10px;';
  const listMenuBtn = document.createElement('button');
  listMenuBtn.textContent = '전략 목록';
  listMenuBtn.style.cssText = 'padding:7px 12px;border-radius:999px;border:none;background:#2a2e3e;color:#fff;font-size:12px;cursor:pointer;';
  const registerMenuBtn = document.createElement('button');
  registerMenuBtn.textContent = '전략 등록';
  registerMenuBtn.style.cssText = 'padding:7px 12px;border-radius:999px;border:none;background:#ffffff;color:#3b4252;font-size:12px;cursor:pointer;';
  topMenu.appendChild(listMenuBtn);
  topMenu.appendChild(registerMenuBtn);
  body.appendChild(topMenu);

  const listPanel = document.createElement('div');
  listPanel.style.cssText = 'display:block;';
  body.appendChild(listPanel);

  const listWrap = document.createElement('div');
  listWrap.style.cssText = 'display:flex;flex-direction:column;gap:8px;max-height:360px;overflow-y:auto;padding-right:2px;margin-bottom:12px;';
  listPanel.appendChild(listWrap);

  const registerPanel = document.createElement('div');
  registerPanel.style.cssText = 'display:none;';
  body.appendChild(registerPanel);

  const form = document.createElement('div');
  form.style.cssText = 'display:grid;grid-template-columns:1fr 1fr;gap:8px;margin-top:4px;';
  registerPanel.appendChild(form);

  const createField = (labelText: string, placeholder: string, full = false) => {
    const wrap = document.createElement('label');
    wrap.style.cssText = `display:flex;flex-direction:column;gap:6px;${full ? 'grid-column:1 / -1;' : ''}`;
    const label = document.createElement('span');
    label.textContent = labelText;
    label.style.cssText = 'font-size:12px;color:#c0c4cc;';
    const input = document.createElement('input');
    input.placeholder = placeholder;
    input.style.cssText = 'background:#131722;border:1px solid #363a45;border-radius:6px;padding:8px;color:white;font-size:12px;';
    wrap.appendChild(label);
    wrap.appendChild(input);
    return { wrap, input };
  };

  const nameField = createField('전략 이름', '예: EMA 12/26');
  const langWrap = document.createElement('label');
  langWrap.style.cssText = 'display:flex;flex-direction:column;gap:6px;';
  const langLabel = document.createElement('span');
  langLabel.textContent = '스크립트 언어';
  langLabel.style.cssText = 'font-size:12px;color:#c0c4cc;';
  const langSel = document.createElement('select');
  langSel.style.cssText = 'background:#131722;border:1px solid #363a45;border-radius:6px;padding:8px;color:white;font-size:12px;';
  langSel.innerHTML = '<option value="javascript">JavaScript</option><option value="pine">Pine Script</option>';
  langWrap.appendChild(langLabel);
  langWrap.appendChild(langSel);

  const descField = createField('설명', '예: MA 교차 전략', true);
  const srcWrap = document.createElement('label');
  srcWrap.style.cssText = 'display:flex;flex-direction:column;gap:6px;grid-column:1 / -1;';
  const srcLabel = document.createElement('span');
  srcLabel.textContent = '전략 스크립트';
  srcLabel.style.cssText = 'font-size:12px;color:#c0c4cc;';
  const srcInput = document.createElement('textarea');
  srcInput.style.cssText = 'min-height:130px;background:#131722;border:1px solid #363a45;border-radius:6px;padding:8px;color:white;font-size:12px;font-family:Consolas, monospace;resize:vertical;';
  srcWrap.appendChild(srcLabel);
  srcWrap.appendChild(srcInput);

  form.appendChild(nameField.wrap);
  form.appendChild(langWrap);
  form.appendChild(descField.wrap);
  form.appendChild(srcWrap);

  const doubleBreakBox = document.createElement('div');
  doubleBreakBox.style.cssText = 'display:none;margin-top:12px;padding:12px;border:1px solid #33415f;border-radius:8px;background:#151c2c;';
  const dbTitle = document.createElement('div');
  dbTitle.textContent = 'Double Break 설정';
  dbTitle.style.cssText = 'font-size:13px;font-weight:700;color:#e5edf9;margin-bottom:8px;';
  doubleBreakBox.appendChild(dbTitle);
  const dbGrid = document.createElement('div');
  dbGrid.style.cssText = 'display:grid;grid-template-columns:repeat(3,minmax(120px,1fr));gap:8px;';
  doubleBreakBox.appendChild(dbGrid);
  listPanel.appendChild(doubleBreakBox);

  const createDbField = (key: string, labelText: string, step = '1') => {
    const wrap = document.createElement('label');
    wrap.style.cssText = 'display:flex;flex-direction:column;gap:5px;';
    const label = document.createElement('span');
    label.textContent = labelText;
    label.style.cssText = 'font-size:11px;color:#aeb9cf;';
    const input = document.createElement('input');
    input.type = 'number';
    input.step = step;
    input.min = key === 'bbStd' || key === 'envPct' || key.includes('Multi') || key === 'crossTol' ? '0' : '1';
    input.style.cssText = 'background:#101827;border:1px solid #3a4864;border-radius:6px;padding:7px;color:white;font-size:12px;';
    input.addEventListener('change', () => {
      const value = Number(input.value);
      if (!Number.isFinite(value)) return;
      chart.setDoubleBreakConfig?.({ [key]: value });
      onApply();
    });
    wrap.appendChild(label);
    wrap.appendChild(input);
    dbGrid.appendChild(wrap);
    return input;
  };

  const dbInputs = {
    bbPeriod: createDbField('bbPeriod', 'BB 기간'),
    bbStd: createDbField('bbStd', 'BB 표준편차', '0.1'),
    envPeriod: createDbField('envPeriod', 'ENV 기간'),
    envPct: createDbField('envPct', 'ENV 폭 (%)', '0.1'),
    atrPeriod: createDbField('atrPeriod', 'ATR 기간'),
    tp1Multi: createDbField('tp1Multi', 'TP1 ATR 배수', '0.1'),
    tp2Multi: createDbField('tp2Multi', 'TP2 ATR 배수', '0.1'),
    slMulti: createDbField('slMulti', 'SL ATR 배수', '0.1'),
    crossTol: createDbField('crossTol', '교차 허용값', '0.001'),
    minBarGap: createDbField('minBarGap', '신호 간격'),
  };

  const bollingerRiskBox = document.createElement('div');
  bollingerRiskBox.style.cssText = 'display:none;margin-top:12px;padding:12px;border:1px solid #3d4d33;border-radius:8px;background:#162114;';
  const bbRiskTitle = document.createElement('div');
  bbRiskTitle.textContent = 'Bollinger 리스크 보정 (4시간 권장)';
  bbRiskTitle.style.cssText = 'font-size:13px;font-weight:700;color:#e6f6de;margin-bottom:8px;';
  bollingerRiskBox.appendChild(bbRiskTitle);
  const bbRiskGrid = document.createElement('div');
  bbRiskGrid.style.cssText = 'display:grid;grid-template-columns:repeat(3,minmax(120px,1fr));gap:8px;';
  bollingerRiskBox.appendChild(bbRiskGrid);
  listPanel.appendChild(bollingerRiskBox);

  const bbRiskEnableWrap = document.createElement('label');
  bbRiskEnableWrap.style.cssText = 'display:flex;flex-direction:column;gap:5px;';
  const bbRiskEnableLabel = document.createElement('span');
  bbRiskEnableLabel.textContent = '리스크 보정 적용';
  bbRiskEnableLabel.style.cssText = 'font-size:11px;color:#b7d1b1;';
  const bbRiskEnableSel = document.createElement('select');
  bbRiskEnableSel.style.cssText = 'background:#10210d;border:1px solid #456341;border-radius:6px;padding:7px;color:white;font-size:12px;';
  bbRiskEnableSel.innerHTML = '<option value="1">적용</option><option value="0">미적용(기존 볼린저)</option>';
  bbRiskEnableSel.addEventListener('change', () => {
    chart.setBollingerRiskConfig?.({ enabled: bbRiskEnableSel.value === '1' });
    onApply();
  });
  bbRiskEnableWrap.appendChild(bbRiskEnableLabel);
  bbRiskEnableWrap.appendChild(bbRiskEnableSel);
  bbRiskGrid.appendChild(bbRiskEnableWrap);

  const createBbRiskField = (key: string, labelText: string, step = '1') => {
    const wrap = document.createElement('label');
    wrap.style.cssText = 'display:flex;flex-direction:column;gap:5px;';
    const label = document.createElement('span');
    label.textContent = labelText;
    label.style.cssText = 'font-size:11px;color:#b7d1b1;';
    const input = document.createElement('input');
    input.type = 'number';
    input.step = step;
    input.min = key.includes('Mult') || key === 'tp1Portion' ? '0' : '1';
    input.style.cssText = 'background:#10210d;border:1px solid #456341;border-radius:6px;padding:7px;color:white;font-size:12px;';
    input.addEventListener('change', () => {
      const value = Number(input.value);
      if (!Number.isFinite(value)) return;
      chart.setBollingerRiskConfig?.({ [key]: value });
      onApply();
    });
    wrap.appendChild(label);
    wrap.appendChild(input);
    bbRiskGrid.appendChild(wrap);
    return input;
  };

  const bbRiskBoolWrap = document.createElement('label');
  bbRiskBoolWrap.style.cssText = 'display:flex;flex-direction:column;gap:5px;';
  const bbRiskBoolLabel = document.createElement('span');
  bbRiskBoolLabel.textContent = 'TP1 후 SL 본절 이동';
  bbRiskBoolLabel.style.cssText = 'font-size:11px;color:#b7d1b1;';
  const bbRiskBoolSel = document.createElement('select');
  bbRiskBoolSel.style.cssText = 'background:#10210d;border:1px solid #456341;border-radius:6px;padding:7px;color:white;font-size:12px;';
  bbRiskBoolSel.innerHTML = '<option value="1">사용</option><option value="0">미사용</option>';
  bbRiskBoolSel.addEventListener('change', () => {
    chart.setBollingerRiskConfig?.({ moveSlToEntryOnTp1: bbRiskBoolSel.value === '1' });
    onApply();
  });
  bbRiskBoolWrap.appendChild(bbRiskBoolLabel);
  bbRiskBoolWrap.appendChild(bbRiskBoolSel);
  bbRiskGrid.appendChild(bbRiskBoolWrap);

  const bbRiskInputs = {
    atrPeriod: createBbRiskField('atrPeriod', 'ATR 기간'),
    slAtrMult: createBbRiskField('slAtrMult', 'SL ATR 배수', '0.1'),
    tp1AtrMult: createBbRiskField('tp1AtrMult', 'TP1 ATR 배수', '0.1'),
    tp2AtrMult: createBbRiskField('tp2AtrMult', 'TP2 ATR 배수', '0.1'),
    tp1Portion: createBbRiskField('tp1Portion', 'TP1 비중(0~1)', '0.05'),
    maxHoldBars: createBbRiskField('maxHoldBars', '최대 보유 바'),
  };

  const setBbRiskFieldsEnabled = (enabled: boolean) => {
    Object.values(bbRiskInputs).forEach((input) => {
      input.disabled = !enabled;
      input.style.opacity = enabled ? '1' : '0.55';
    });
    bbRiskBoolSel.disabled = !enabled;
    bbRiskBoolSel.style.opacity = enabled ? '1' : '0.55';
  };

  const err = document.createElement('div');
  err.style.cssText = 'color:#ef5350;font-size:11px;min-height:16px;margin-top:8px;';
  registerPanel.appendChild(err);

  const actions = document.createElement('div');
  actions.style.cssText = 'display:flex;justify-content:flex-end;gap:8px;margin-top:10px;';
  const cancelEdit = document.createElement('button');
  cancelEdit.textContent = '수정 취소';
  cancelEdit.style.cssText = 'display:none;padding:8px 12px;border-radius:6px;border:1px solid #485465;background:#1c2431;color:#c0c4cc;font-size:12px;cursor:pointer;';
  const closeBtn = document.createElement('button');
  closeBtn.textContent = '닫기';
  closeBtn.style.cssText = 'padding:8px 12px;border-radius:6px;border:1px solid #2a2e3e;background:#131722;color:#c0c4cc;font-size:12px;cursor:pointer;';
  const saveBtn = document.createElement('button');
  saveBtn.textContent = '전략 저장';
  saveBtn.style.cssText = 'padding:8px 12px;border-radius:6px;border:1px solid #2962ff;background:#2962ff;color:white;font-weight:700;font-size:12px;cursor:pointer;';
  actions.appendChild(cancelEdit);
  actions.appendChild(closeBtn);
  actions.appendChild(saveBtn);
  body.appendChild(actions);

  let activeView: 'list' | 'register' = 'list';
  let editingId: string | null = null;
  const openCompiledSourceModal = (strategy: StrategyDefinition) => {
    const { body: sourceBody } = createModal(`변환 소스 보기 · ${strategy.name}`);
    const hint = document.createElement('div');
    hint.style.cssText = 'font-size:12px;color:#9aa0ab;line-height:1.5;margin-bottom:10px;';
    hint.textContent = 'Pine 전략은 저장 시 JS로 변환됩니다. 아래에서 원본/변환/난독화 결과를 확인할 수 있습니다.';
    sourceBody.appendChild(hint);

    const createViewer = (labelText: string, value: string) => {
      const wrap = document.createElement('div');
      wrap.style.cssText = 'display:flex;flex-direction:column;gap:6px;margin-bottom:10px;';
      const label = document.createElement('div');
      label.textContent = labelText;
      label.style.cssText = 'font-size:12px;color:#c0c4cc;';
      const area = document.createElement('textarea');
      area.readOnly = true;
      area.value = value;
      area.style.cssText = 'min-height:130px;background:#131722;border:1px solid #363a45;border-radius:6px;padding:8px;color:white;font-size:12px;font-family:Consolas, monospace;resize:vertical;';
      wrap.appendChild(label);
      wrap.appendChild(area);
      sourceBody.appendChild(wrap);
    };

    createViewer('원본 소스', strategy.sourceCode);
    createViewer('변환된 JavaScript', strategy.compiledJs);
    createViewer('난독화 JavaScript', strategy.obfuscatedJs);
  };

  const resetForm = () => {
    editingId = null;
    nameField.input.value = '';
    descField.input.value = '';
    langSel.value = 'javascript';
    srcInput.value = '';
    saveBtn.textContent = '전략 저장';
  };

  const applyViewState = () => {
    const listMode = activeView === 'list';
    listPanel.style.display = listMode ? 'block' : 'none';
    registerPanel.style.display = listMode ? 'none' : 'block';
    saveBtn.style.display = listMode ? 'none' : 'inline-block';
    cancelEdit.style.display = !listMode && editingId ? 'inline-block' : 'none';
    err.style.display = listMode ? 'none' : 'block';

    listMenuBtn.style.backgroundColor = listMode ? '#2a2e3e' : '#ffffff';
    listMenuBtn.style.color = listMode ? '#ffffff' : '#3b4252';
    registerMenuBtn.style.backgroundColor = listMode ? '#ffffff' : '#2a2e3e';
    registerMenuBtn.style.color = listMode ? '#3b4252' : '#ffffff';
  };

  const render = () => {
    const strategies = chart.getStrategies() as StrategyDefinition[];
    const activeId = chart.getActiveStrategyId();
    const activeIsDoubleBreak = activeId === 'strategy_js_double_break';
    const activeIsBollinger = activeId === 'strategy_pine_bbands_directed';

    listWrap.innerHTML = '';
    strategies.forEach((s) => {
      const isApplied = s.id === activeId;
      const row = document.createElement('div');
      row.style.cssText = `display:flex;align-items:center;justify-content:space-between;gap:8px;background:#131722;
        border:1px solid ${isApplied ? '#2962ff' : '#2a2e3e'};border-radius:6px;padding:8px 10px;`;
      row.innerHTML = `<div style="min-width:0;">
        <div style="font-size:12px;color:white;font-weight:700;white-space:nowrap;overflow:hidden;text-overflow:ellipsis;">${s.name}</div>
        <div style="font-size:11px;color:#9aa0ab;white-space:nowrap;overflow:hidden;text-overflow:ellipsis;">${s.description || '-'} · ${s.language.toUpperCase()} · v${s.version}</div>
      </div>`;

      const right = document.createElement('div');
      right.style.cssText = 'display:flex;align-items:center;gap:6px;flex-shrink:0;';
      const applyBtn = document.createElement('button');
      applyBtn.textContent = isApplied ? '적용중' : '적용';
      applyBtn.disabled = isApplied;
      applyBtn.style.cssText = `padding:4px 8px;border-radius:4px;border:1px solid ${isApplied ? '#355ba8' : '#2962ff'};
        background:${isApplied ? '#1e315c' : '#2962ff'};color:white;font-size:11px;cursor:${isApplied ? 'default' : 'pointer'};`;
      applyBtn.addEventListener('click', () => {
        if (isApplied) return;
        chart.setActiveStrategy(s.id);
        onApply();
        render();
      });
      const sourceBtn = document.createElement('button');
      sourceBtn.textContent = 'JS보기';
      sourceBtn.style.cssText = 'padding:4px 8px;border-radius:4px;border:1px solid #3b4360;background:#232b3d;color:#c9d1e3;font-size:11px;cursor:pointer;';
      sourceBtn.addEventListener('click', () => openCompiledSourceModal(s));
      const editBtn = document.createElement('button');
      editBtn.textContent = '수정';
      editBtn.style.cssText = 'padding:4px 8px;border-radius:4px;border:1px solid #2f4f78;background:#1a2a3f;color:#90caf9;font-size:11px;cursor:pointer;';
      editBtn.addEventListener('click', () => {
        editingId = s.id;
        nameField.input.value = s.name;
        descField.input.value = s.description;
        langSel.value = s.language;
        srcInput.value = s.sourceCode;
        saveBtn.textContent = '수정 저장';
        err.textContent = '';
        activeView = 'register';
        applyViewState();
      });
      const delBtn = document.createElement('button');
      delBtn.textContent = '삭제';
      delBtn.style.cssText = 'padding:4px 8px;border-radius:4px;border:1px solid #5a2e34;background:#2b1b1f;color:#ff8a80;font-size:11px;cursor:pointer;';
      delBtn.addEventListener('click', () => {
        const next = (chart.getStrategies() as StrategyDefinition[]).filter((item: StrategyDefinition) => item.id !== s.id);
        chart.setStrategies(next);
        if (chart.getActiveStrategyId() === s.id) chart.setActiveStrategy(null);
        if (editingId === s.id) resetForm();
        onApply();
        render();
      });
      right.appendChild(applyBtn);
      right.appendChild(sourceBtn);
      right.appendChild(editBtn);
      right.appendChild(delBtn);
      row.appendChild(right);
      listWrap.appendChild(row);
    });

    doubleBreakBox.style.display = activeIsDoubleBreak ? 'block' : 'none';
    if (activeIsDoubleBreak && chart.getDoubleBreakConfig) {
      const cfg = chart.getDoubleBreakConfig();
      Object.entries(dbInputs).forEach(([key, input]) => {
        input.value = String(cfg[key] ?? '');
      });
    }

    bollingerRiskBox.style.display = activeIsBollinger ? 'block' : 'none';
    if (activeIsBollinger && chart.getBollingerRiskConfig) {
      const cfg = chart.getBollingerRiskConfig();
      Object.entries(bbRiskInputs).forEach(([key, input]) => {
        input.value = String(cfg[key] ?? '');
      });
      bbRiskEnableSel.value = cfg.enabled ? '1' : '0';
      bbRiskBoolSel.value = cfg.moveSlToEntryOnTp1 ? '1' : '0';
      setBbRiskFieldsEnabled(Boolean(cfg.enabled));
    }
    applyViewState();
  };

  listMenuBtn.addEventListener('click', () => {
    activeView = 'list';
    applyViewState();
  });
  registerMenuBtn.addEventListener('click', () => {
    activeView = 'register';
    applyViewState();
  });
  closeBtn.addEventListener('click', close);
  cancelEdit.addEventListener('click', () => {
    err.textContent = '';
    resetForm();
    applyViewState();
  });

  saveBtn.addEventListener('click', () => {
    err.textContent = '';
    try {
      const name = nameField.input.value.trim();
      const description = descField.input.value.trim();
      const language = langSel.value as StrategyLang;
      const sourceCode = srcInput.value.trim();
      if (!name) throw new Error('전략 이름을 입력해주세요.');
      if (!sourceCode) throw new Error('전략 스크립트를 입력해주세요.');

      const list = chart.getStrategies() as StrategyDefinition[];
      const existing = editingId ? list.find((s: StrategyDefinition) => s.id === editingId) : null;
      const nextDefinition = buildStrategyDefinition({
        id: existing?.id,
        name,
        description,
        language,
        sourceCode,
        active: true,
        version: existing ? existing.version + 1 : 1,
      });
      const next = existing
        ? list.map((s: StrategyDefinition) => (s.id === existing.id ? nextDefinition : s))
        : [...list, nextDefinition];
      chart.setStrategies(next);
      if (!chart.getActiveStrategyId()) {
        chart.setActiveStrategy(nextDefinition.id);
      }
      resetForm();
      onApply();
      activeView = 'list';
      render();
    } catch (error) {
      err.textContent = error instanceof Error ? error.message : String(error);
    }
  });

  render();
}

export function openChartSettingsModal(chart: any, onApply: () => void, onSymbolVisualUpdate: () => void) {
  const { body } = createModal('차트 설정');
  const GAP_MODE_STORAGE_KEY = 'my-chart-lib.chart-gap-mode.v1';
  const PATTERN_SCOPE_STORAGE_KEY = 'my-chart-lib.pattern-analysis-scope.v1';
  const PATTERN_ALERT_ENABLED_STORAGE_KEY = 'my-chart-lib.pattern-alert-enabled.v1';
  const GATEWAY_FAST_SYNC_CONFIG_KEY = 'my-chart-lib.gateway-fast-sync.v1';
  const loadFastSyncConfig = (): { intervalMs: number; ticks: number } => {
    try {
      const raw = localStorage.getItem(GATEWAY_FAST_SYNC_CONFIG_KEY);
      const parsed = raw ? JSON.parse(raw) as { intervalMs?: unknown; ticks?: unknown } : {};
      const intervalMs = Math.max(300, Math.min(5000, Math.floor(Number(parsed.intervalMs ?? 1000))));
      const ticks = Math.max(0, Math.min(30, Math.floor(Number(parsed.ticks ?? 8))));
      return { intervalMs, ticks };
    } catch {
      return { intervalMs: 1000, ticks: 8 };
    }
  };
  const saveFastSyncConfig = (intervalMs: number, ticks: number) => {
    const payload = {
      intervalMs: Math.max(300, Math.min(5000, Math.floor(intervalMs))),
      ticks: Math.max(0, Math.min(30, Math.floor(ticks))),
    };
    localStorage.setItem(GATEWAY_FAST_SYNC_CONFIG_KEY, JSON.stringify(payload));
    window.dispatchEvent(new CustomEvent('my-chart-lib:gateway-fast-sync-updated'));
  };
  const loadGapMode = (): 'raw' | 'smooth' => {
    const raw = localStorage.getItem(GAP_MODE_STORAGE_KEY);
    return raw === 'smooth' ? 'smooth' : 'raw';
  };
  const saveGapMode = (mode: 'raw' | 'smooth') => {
    localStorage.setItem(GAP_MODE_STORAGE_KEY, mode);
    window.dispatchEvent(new CustomEvent('my-chart-lib:gap-mode-updated'));
  };
  const loadPatternScope = (): 'lookback' | 'visible-only' => {
    const raw = localStorage.getItem(PATTERN_SCOPE_STORAGE_KEY);
    return raw === 'visible-only' ? 'visible-only' : 'lookback';
  };
  const savePatternScope = (scope: 'lookback' | 'visible-only') => {
    localStorage.setItem(PATTERN_SCOPE_STORAGE_KEY, scope);
    window.dispatchEvent(new CustomEvent('my-chart-lib:pattern-scope-updated'));
  };
  const loadPatternAlertEnabled = (): boolean => {
    const raw = localStorage.getItem(PATTERN_ALERT_ENABLED_STORAGE_KEY);
    if (raw == null) return false;
    return raw !== '0' && raw.toLowerCase() !== 'false';
  };
  const savePatternAlertEnabled = (enabled: boolean) => {
    localStorage.setItem(PATTERN_ALERT_ENABLED_STORAGE_KEY, enabled ? '1' : '0');
    window.dispatchEvent(new CustomEvent('my-chart-lib:pattern-alert-updated'));
  };

  const indicatorRow = document.createElement('div');
  indicatorRow.style.cssText = 'display:flex;justify-content:space-between;align-items:center;gap:12px;';
  const indicatorLabel = document.createElement('div');
  indicatorLabel.innerHTML = '<div style="font-size:13px;font-weight:700;">지표 선택</div><div style="font-size:11px;color:#84898e;margin-top:2px;">표시할 보조지표를 선택/해제합니다.</div>';
  const indicatorBtn = document.createElement('button');
  indicatorBtn.textContent = '지표 선택';
  indicatorBtn.style.cssText = 'padding:8px 12px;border-radius:6px;border:1px solid #2a2e3e;background:#131722;color:white;cursor:pointer;font-size:12px;';
  indicatorBtn.addEventListener('mouseenter', () => indicatorBtn.style.background = '#252a3a');
  indicatorBtn.addEventListener('mouseleave', () => indicatorBtn.style.background = '#131722');
  indicatorBtn.addEventListener('click', () => {
    openIndicatorModal(chart, onApply);
  });
  indicatorRow.appendChild(indicatorLabel);
  indicatorRow.appendChild(indicatorBtn);
  body.appendChild(indicatorRow);

  const marketRow = document.createElement('div');
  marketRow.style.cssText = 'margin-top:14px;display:flex;justify-content:space-between;align-items:center;gap:12px;';
  const marketLabel = document.createElement('div');
  marketLabel.innerHTML = '<div style="font-size:13px;font-weight:700;">시세영역 위치</div><div style="font-size:11px;color:#84898e;margin-top:2px;">환율/시세 영역의 좌우 위치를 변경합니다.</div>';
  const marketSelect = document.createElement('select');
  marketSelect.style.cssText = 'min-width:100px;background:#131722;color:white;border:1px solid #363a45;border-radius:6px;padding:6px 10px;font-size:12px;';
  marketSelect.innerHTML = '<option value="left">좌측</option><option value="right">우측</option>';
  marketSelect.value = chart.config.layout.marketInfoSide === 'left' ? 'left' : 'right';
  marketSelect.addEventListener('change', () => {
    chart.config.layout.marketInfoSide = marketSelect.value === 'left' ? 'left' : 'right';
    onApply();
  });
  marketRow.appendChild(marketLabel);
  marketRow.appendChild(marketSelect);
  body.appendChild(marketRow);

  const row = document.createElement('div');
  row.style.cssText = 'margin-top:14px;display:flex;justify-content:space-between;align-items:center;gap:12px;';

  const label = document.createElement('div');
  label.innerHTML = '<div style="font-size:13px;font-weight:700;">최신 캔들 우측 여백</div><div style="font-size:11px;color:#84898e;margin-top:2px;">마지막 캔들과 Y축 사이 공간(캔들 폭 단위)</div>';

  const controls = document.createElement('div');
  controls.style.cssText = 'display:flex;align-items:center;gap:8px;';

  const slider = document.createElement('input');
  slider.type = 'range';
  slider.min = '0';
  slider.max = '40';
  slider.step = '1';
  slider.value = String(chart.config.layout.rightGapBars ?? 0);

  const number = document.createElement('input');
  number.type = 'number';
  number.min = '0';
  number.max = '40';
  number.step = '1';
  number.value = String(chart.config.layout.rightGapBars ?? 0);
  number.style.cssText = 'width:64px;background:#131722;color:white;border:1px solid #363a45;border-radius:4px;padding:4px 6px;text-align:right;font-size:12px;';

  const apply = (raw: number) => {
    const next = Math.max(0, Math.min(40, Number.isFinite(raw) ? raw : 8));
    chart.config.layout.rightGapBars = next;
    slider.value = String(next);
    number.value = String(next);
    chart.draw();
    onApply();
  };

  slider.addEventListener('input', () => apply(Number(slider.value)));
  number.addEventListener('change', () => apply(Number(number.value)));

  controls.appendChild(slider);
  controls.appendChild(number);
  row.appendChild(label);
  row.appendChild(controls);
  body.appendChild(row);

  const candleRow = document.createElement('div');
  candleRow.style.cssText = 'margin-top:14px;display:flex;justify-content:space-between;align-items:center;gap:12px;';
  const candleLabel = document.createElement('div');
  candleLabel.innerHTML = '<div style="font-size:13px;font-weight:700;">캔들 색상</div><div style="font-size:11px;color:#84898e;margin-top:2px;">상승/하락 캔들 및 거래량 색상을 변경합니다.</div>';
  const candleControls = document.createElement('div');
  candleControls.style.cssText = 'display:flex;align-items:center;gap:10px;';

  const createColorControl = (name: string, initial: string) => {
    const wrap = document.createElement('label');
    wrap.style.cssText = 'display:flex;align-items:center;gap:6px;font-size:11px;color:#c0c4cc;';
    const text = document.createElement('span');
    text.textContent = name;
    const input = document.createElement('input');
    input.type = 'color';
    input.value = initial;
    input.style.cssText = 'width:30px;height:24px;padding:0;border:1px solid #363a45;border-radius:4px;background:#131722;cursor:pointer;';
    wrap.appendChild(text);
    wrap.appendChild(input);
    return { wrap, input };
  };

  const upDefault = chart.config.candleStyle?.upColor ?? '#26a69a';
  const downDefault = chart.config.candleStyle?.downColor ?? '#ef5350';
  const upControl = createColorControl('상승', upDefault);
  const downControl = createColorControl('하락', downDefault);

  const applyCandleColors = () => {
    if (!chart.config.candleStyle) {
      chart.config.candleStyle = { upColor: '#26a69a', downColor: '#ef5350' };
    }
    chart.config.candleStyle.upColor = upControl.input.value || '#26a69a';
    chart.config.candleStyle.downColor = downControl.input.value || '#ef5350';
    chart.draw();
    onApply();
  };

  upControl.input.addEventListener('input', applyCandleColors);
  downControl.input.addEventListener('input', applyCandleColors);
  candleControls.appendChild(upControl.wrap);
  candleControls.appendChild(downControl.wrap);
  candleRow.appendChild(candleLabel);
  candleRow.appendChild(candleControls);
  body.appendChild(candleRow);

  const gapModeRow = document.createElement('div');
  gapModeRow.style.cssText = 'margin-top:14px;display:flex;justify-content:space-between;align-items:center;gap:12px;';
  const gapModeLabel = document.createElement('div');
  gapModeLabel.innerHTML = '<div style="font-size:13px;font-weight:700;">갭 보정 모드</div><div style="font-size:11px;color:#84898e;margin-top:2px;">세션 전환 구간의 급격한 시가 점프를 연속형으로 표시</div>';
  const gapModeSelect = document.createElement('select');
  gapModeSelect.style.cssText = 'min-width:132px;background:#131722;color:white;border:1px solid #363a45;border-radius:6px;padding:6px 10px;font-size:12px;';
  gapModeSelect.innerHTML = '<option value="raw">원본</option><option value="smooth">갭보정</option>';
  gapModeSelect.value = loadGapMode();
  gapModeSelect.addEventListener('change', () => {
    saveGapMode(gapModeSelect.value === 'smooth' ? 'smooth' : 'raw');
    onApply();
  });
  gapModeRow.appendChild(gapModeLabel);
  gapModeRow.appendChild(gapModeSelect);
  body.appendChild(gapModeRow);

  const patternScopeRow = document.createElement('div');
  patternScopeRow.style.cssText = 'margin-top:14px;display:flex;justify-content:space-between;align-items:center;gap:12px;';
  const patternScopeLabel = document.createElement('div');
  patternScopeLabel.innerHTML = '<div style="font-size:13px;font-weight:700;">패턴 분석 범위</div><div style="font-size:11px;color:#84898e;margin-top:2px;">룩백 전체 또는 현재 화면 구간만 패턴을 탐지</div>';
  const patternScopeSelect = document.createElement('select');
  patternScopeSelect.style.cssText = 'min-width:160px;background:#131722;color:white;border:1px solid #363a45;border-radius:6px;padding:6px 10px;font-size:12px;';
  patternScopeSelect.innerHTML = '<option value="lookback">룩백 전체(권장)</option><option value="visible-only">보이는 영역만</option>';
  const currentScope = typeof chart.getPatternAnalysisScope === 'function'
    ? chart.getPatternAnalysisScope()
    : loadPatternScope();
  patternScopeSelect.value = currentScope === 'visible-only' ? 'visible-only' : 'lookback';
  patternScopeSelect.addEventListener('change', () => {
    const next = patternScopeSelect.value === 'visible-only' ? 'visible-only' : 'lookback';
    if (typeof chart.setPatternAnalysisScope === 'function') {
      chart.setPatternAnalysisScope(next);
    }
    savePatternScope(next);
    onApply();
  });
  patternScopeRow.appendChild(patternScopeLabel);
  patternScopeRow.appendChild(patternScopeSelect);
  body.appendChild(patternScopeRow);

  const patternAlertRow = document.createElement('div');
  patternAlertRow.style.cssText = 'margin-top:14px;display:flex;justify-content:space-between;align-items:center;gap:12px;';
  const patternAlertLabel = document.createElement('div');
  patternAlertLabel.innerHTML = '<div style="font-size:13px;font-weight:700;">패턴 알림</div><div style="font-size:11px;color:#84898e;margin-top:2px;">쌍바닥/H&S 패턴 알림 팝업 On/Off</div>';
  const patternAlertToggle = document.createElement('button');
  patternAlertToggle.type = 'button';
  patternAlertToggle.setAttribute('aria-label', '패턴 알림 토글');
  patternAlertToggle.style.cssText = [
    'position:relative',
    'width:50px',
    'height:28px',
    'border:1px solid #4a556a',
    'border-radius:999px',
    'background:#4b5160',
    'padding:0',
    'cursor:pointer',
    'transition:background 140ms ease,border-color 140ms ease',
  ].join(';');
  const patternAlertThumb = document.createElement('span');
  patternAlertThumb.style.cssText = [
    'position:absolute',
    'top:3px',
    'left:3px',
    'width:20px',
    'height:20px',
    'border-radius:50%',
    'background:#ffffff',
    'box-shadow:0 1px 4px rgba(0,0,0,0.35)',
    'transition:left 140ms ease',
  ].join(';');
  patternAlertToggle.appendChild(patternAlertThumb);
  const enabledNow = typeof chart.isPatternAlertEnabled === 'function'
    ? chart.isPatternAlertEnabled()
    : loadPatternAlertEnabled();
  let patternAlertEnabled = enabledNow;
  const syncPatternAlertToggle = () => {
    patternAlertToggle.style.background = patternAlertEnabled ? '#2b7cff' : '#4b5160';
    patternAlertToggle.style.borderColor = patternAlertEnabled ? '#4f8fff' : '#4a556a';
    patternAlertThumb.style.left = patternAlertEnabled ? '26px' : '3px';
    patternAlertToggle.title = patternAlertEnabled ? 'On' : 'Off';
  };
  syncPatternAlertToggle();
  patternAlertToggle.addEventListener('click', () => {
    patternAlertEnabled = !patternAlertEnabled;
    syncPatternAlertToggle();
    if (typeof chart.setPatternAlertEnabled === 'function') {
      chart.setPatternAlertEnabled(patternAlertEnabled);
    }
    savePatternAlertEnabled(patternAlertEnabled);
    onApply();
  });
  patternAlertRow.appendChild(patternAlertLabel);
  patternAlertRow.appendChild(patternAlertToggle);
  body.appendChild(patternAlertRow);

  const fastSyncConfig = loadFastSyncConfig();
  const fastSyncRow = document.createElement('div');
  fastSyncRow.style.cssText = 'margin-top:14px;display:flex;justify-content:space-between;align-items:center;gap:12px;';
  const fastSyncLabel = document.createElement('div');
  fastSyncLabel.innerHTML = '<div style="font-size:13px;font-weight:700;">게이트웨이 즉시반영</div><div style="font-size:11px;color:#84898e;margin-top:2px;">심볼/타임프레임 변경 직후 빠른 동기화 간격/횟수</div>';
  const fastSyncControls = document.createElement('div');
  fastSyncControls.style.cssText = 'display:flex;align-items:center;gap:8px;';

  const intervalInput = document.createElement('input');
  intervalInput.type = 'number';
  intervalInput.min = '300';
  intervalInput.max = '5000';
  intervalInput.step = '100';
  intervalInput.value = String(fastSyncConfig.intervalMs);
  intervalInput.title = '간격(ms)';
  intervalInput.style.cssText = 'width:84px;background:#131722;color:white;border:1px solid #363a45;border-radius:4px;padding:4px 6px;text-align:right;font-size:12px;';

  const ticksInput = document.createElement('input');
  ticksInput.type = 'number';
  ticksInput.min = '0';
  ticksInput.max = '30';
  ticksInput.step = '1';
  ticksInput.value = String(fastSyncConfig.ticks);
  ticksInput.title = '횟수';
  ticksInput.style.cssText = 'width:64px;background:#131722;color:white;border:1px solid #363a45;border-radius:4px;padding:4px 6px;text-align:right;font-size:12px;';

  const intervalHint = document.createElement('span');
  intervalHint.textContent = 'ms';
  intervalHint.style.cssText = 'font-size:11px;color:#aeb4c2;';
  const ticksHint = document.createElement('span');
  ticksHint.textContent = '회';
  ticksHint.style.cssText = 'font-size:11px;color:#aeb4c2;';

  const applyFastSyncSettings = () => {
    const intervalMs = Number(intervalInput.value);
    const ticks = Number(ticksInput.value);
    saveFastSyncConfig(intervalMs, ticks);
    intervalInput.value = String(Math.max(300, Math.min(5000, Math.floor(intervalMs))));
    ticksInput.value = String(Math.max(0, Math.min(30, Math.floor(ticks))));
    onApply();
  };

  intervalInput.addEventListener('change', applyFastSyncSettings);
  ticksInput.addEventListener('change', applyFastSyncSettings);

  fastSyncControls.appendChild(intervalInput);
  fastSyncControls.appendChild(intervalHint);
  fastSyncControls.appendChild(ticksInput);
  fastSyncControls.appendChild(ticksHint);
  fastSyncRow.appendChild(fastSyncLabel);
  fastSyncRow.appendChild(fastSyncControls);
  body.appendChild(fastSyncRow);

  const symbolRow = document.createElement('div');
  symbolRow.style.cssText = 'margin-top:18px;display:flex;justify-content:space-between;align-items:center;gap:12px;';
  const symbolLabel = document.createElement('div');
  symbolLabel.innerHTML = '<div style="font-size:13px;font-weight:700;">심볼 등록 / 관리</div><div style="font-size:11px;color:#84898e;margin-top:2px;">심볼명, 티커, 카테고리, SVG 아이콘 URL을 등록할 수 있습니다.</div>';
  const symbolBtn = document.createElement('button');
  symbolBtn.textContent = '심볼 관리';
  symbolBtn.style.cssText = 'padding:8px 12px;border-radius:6px;border:1px solid #2a2e3e;background:#131722;color:white;cursor:pointer;font-size:12px;';
  symbolBtn.addEventListener('mouseenter', () => symbolBtn.style.background = '#252a3a');
  symbolBtn.addEventListener('mouseleave', () => symbolBtn.style.background = '#131722');
  symbolBtn.addEventListener('click', () => {
    openSymbolRegistryModal(chart, onApply, onSymbolVisualUpdate);
  });
  symbolRow.appendChild(symbolLabel);
  symbolRow.appendChild(symbolBtn);
  body.appendChild(symbolRow);
}

export function openSymbolRegistryModal(chart: any, onApply: () => void, onSymbolVisualUpdate: () => void) {
  const { body, close } = createModal(`심볼 관리 (${chart.config.symbol})`, { anchorTop: true });
  body.style.overflowX = 'hidden';

  type BuiltinSymbol = { id: string; label: string; desc: string; iconUrl?: string };
  type SymbolRef =
    | { source: 'builtin'; category: string; item: BuiltinSymbol }
    | { source: 'custom'; category: string; item: SymbolCatalogItem };

  let editingRef: SymbolRef | null = null;
  let query = '';

  const form = document.createElement('div');
  form.style.cssText = 'display:grid;grid-template-columns:1fr 1fr;gap:10px;';

  const createField = (label: string, placeholder: string) => {
    const wrap = document.createElement('label');
    wrap.style.cssText = 'display:flex;flex-direction:column;gap:6px;color:#c0c4cc;font-size:12px;';
    const ttl = document.createElement('span');
    ttl.textContent = label;
    const input = document.createElement('input');
    input.placeholder = placeholder;
    input.style.cssText = 'background:#131722;border:1px solid #363a45;border-radius:6px;padding:8px 10px;color:white;font-size:12px;';
    wrap.appendChild(ttl);
    wrap.appendChild(input);
    return { wrap, input };
  };

  const idField = createField('티커 ID', '예: BTCKRW');
  const labelField = createField('표시명', '예: BTC/KRW');
  const categoryField = createField('카테고리', '예: 암호화폐');
  const iconField = createField('아이콘 URL (선택)', 'https://...');

  const descWrap = document.createElement('label');
  descWrap.style.cssText = 'display:flex;flex-direction:column;gap:6px;color:#c0c4cc;font-size:12px;grid-column:1 / -1;';
  const descLabel = document.createElement('span');
  descLabel.textContent = '설명';
  const descInput = document.createElement('input');
  descInput.placeholder = '예: Bitcoin / Korean Won';
  descInput.style.cssText = 'background:#131722;border:1px solid #363a45;border-radius:6px;padding:8px 10px;color:white;font-size:12px;';
  descWrap.appendChild(descLabel);
  descWrap.appendChild(descInput);

  form.appendChild(idField.wrap);
  form.appendChild(labelField.wrap);
  form.appendChild(categoryField.wrap);
  form.appendChild(iconField.wrap);
  form.appendChild(descWrap);
  body.appendChild(form);

  const err = document.createElement('div');
  err.style.cssText = 'margin-top:8px;min-height:16px;color:#ef5350;font-size:11px;';
  body.appendChild(err);

  const searchWrap = document.createElement('div');
  searchWrap.style.cssText = 'margin-top:10px;';
  const search = document.createElement('input');
  search.placeholder = '심볼 검색 (ID/표시명/설명/카테고리)';
  search.style.cssText = 'width:100%;background:#131722;border:1px solid #363a45;border-radius:6px;padding:8px 10px;color:white;font-size:12px;';
  searchWrap.appendChild(search);
  body.appendChild(searchWrap);

  const listWrap = document.createElement('div');
  listWrap.style.cssText = 'margin-top:12px;display:flex;flex-direction:column;gap:8px;max-height:440px;overflow-y:auto;overflow-x:hidden;padding-right:2px;';
  body.appendChild(listWrap);

  const resetForm = () => {
    editingRef = null;
    idField.input.value = '';
    labelField.input.value = '';
    categoryField.input.value = '';
    descInput.value = '';
    iconField.input.value = '';
    save.textContent = '심볼 추가';
    cancelEdit.style.display = 'none';
  };

  const listAllRefs = (): SymbolRef[] => {
    const refs: SymbolRef[] = [];
    for (const [category, items] of Object.entries(SYMBOL_CATALOG)) {
      items.forEach((item) => refs.push({ source: 'builtin', category, item }));
    }
    CUSTOM_SYMBOLS.forEach((item) => refs.push({ source: 'custom', category: item.category, item }));
    return refs;
  };

  const hasDuplicateId = (id: string, except: SymbolRef | null): boolean => {
    return listAllRefs().some((ref) => {
      if (except && ref.item === except.item) return false;
      return ref.item.id.toUpperCase() === id;
    });
  };

  const renderSymbolList = () => {
    listWrap.innerHTML = '';

    const refs = listAllRefs().filter((ref) => {
      const q = query.trim().toLowerCase();
      if (!q) return true;
      return (
        ref.item.id.toLowerCase().includes(q) ||
        ref.item.label.toLowerCase().includes(q) ||
        ref.item.desc.toLowerCase().includes(q) ||
        ref.category.toLowerCase().includes(q)
      );
    });

    const title = document.createElement('div');
    title.textContent = `전체 심볼 ${refs.length}개 (기본 ${Object.values(SYMBOL_CATALOG).flat().length} / 커스텀 ${CUSTOM_SYMBOLS.length})`;
    title.style.cssText = 'font-size:12px;color:#d1d4dc;font-weight:700;';
    listWrap.appendChild(title);

    if (!refs.length) {
      const empty = document.createElement('div');
      empty.textContent = '검색 결과가 없습니다.';
      empty.style.cssText = 'font-size:12px;color:#84898e;padding:8px 0;';
      listWrap.appendChild(empty);
      return;
    }

    refs.forEach((ref) => {
      const row = document.createElement('div');
      row.style.cssText = 'display:flex;align-items:center;justify-content:space-between;background:#131722;border:1px solid #2a2e3e;border-radius:6px;padding:8px 10px;gap:10px;';
      row.innerHTML = `
        <div style="display:flex;flex-direction:column;gap:2px;min-width:0;">
          <span style="font-size:12px;color:white;font-weight:700;white-space:nowrap;overflow:hidden;text-overflow:ellipsis;">${ref.item.id} · ${ref.item.label}</span>
          <span style="font-size:11px;color:#9aa0ab;white-space:nowrap;overflow:hidden;text-overflow:ellipsis;">${ref.category} / ${ref.item.desc}</span>
        </div>
      `;

      const right = document.createElement('div');
      right.style.cssText = 'display:flex;align-items:center;gap:6px;flex-shrink:0;';

      const kind = document.createElement('span');
      kind.textContent = ref.source === 'builtin' ? '기본' : '커스텀';
      kind.style.cssText = `font-size:10px;padding:3px 6px;border-radius:99px;border:1px solid ${ref.source === 'builtin' ? '#315076' : '#3f5f3f'};color:${ref.source === 'builtin' ? '#90caf9' : '#a5d6a7'};`;

      const editBtn = document.createElement('button');
      editBtn.type = 'button';
      editBtn.textContent = '수정';
      editBtn.style.cssText = 'padding:5px 9px;border-radius:4px;border:1px solid #2f4f78;background:#1a2a3f;color:#90caf9;font-size:11px;cursor:pointer;';
      editBtn.addEventListener('click', () => {
        editingRef = ref;
        idField.input.value = ref.item.id;
        labelField.input.value = ref.item.label;
        categoryField.input.value = ref.category;
        descInput.value = ref.item.desc;
        iconField.input.value = ref.item.iconUrl ?? '';
        save.textContent = '수정 저장';
        cancelEdit.style.display = 'inline-block';
        err.textContent = '';
      });

      const removeBtn = document.createElement('button');
      removeBtn.type = 'button';
      removeBtn.textContent = '삭제';
      removeBtn.style.cssText = 'padding:5px 9px;border-radius:4px;border:1px solid #5a2e34;background:#2b1b1f;color:#ff8a80;font-size:11px;cursor:pointer;';
      removeBtn.addEventListener('click', () => {
        const wasCurrent = chart.config.symbol === ref.item.id;
        if (ref.source === 'custom') {
          const idx = CUSTOM_SYMBOLS.findIndex((s) => s === ref.item);
          if (idx >= 0) CUSTOM_SYMBOLS.splice(idx, 1);
        } else {
          const group = SYMBOL_CATALOG[ref.category] ?? [];
          const idx = group.findIndex((s) => s === ref.item);
          if (idx >= 0) group.splice(idx, 1);
        }
        persistSymbolRegistry();
        if (editingRef?.item === ref.item) resetForm();
        if (wasCurrent) onSymbolVisualUpdate();
        onApply();
        renderSymbolList();
      });

      right.appendChild(kind);
      right.appendChild(editBtn);
      right.appendChild(removeBtn);
      row.appendChild(right);
      listWrap.appendChild(row);
    });
  };

  const actions = document.createElement('div');
  actions.style.cssText = 'margin-top:14px;display:flex;justify-content:flex-end;gap:8px;';
  const cancelEdit = document.createElement('button');
  cancelEdit.type = 'button';
  cancelEdit.textContent = '수정 취소';
  cancelEdit.style.cssText = 'padding:8px 12px;border-radius:6px;border:1px solid #5f6c7b;background:#1b2633;color:#c0c4cc;cursor:pointer;font-size:12px;display:none;';
  cancelEdit.addEventListener('click', () => {
    err.textContent = '';
    resetForm();
  });

  const cancel = document.createElement('button');
  cancel.type = 'button';
  cancel.textContent = '닫기';
  cancel.style.cssText = 'padding:8px 12px;border-radius:6px;border:1px solid #2a2e3e;background:#131722;color:#c0c4cc;cursor:pointer;font-size:12px;';
  cancel.addEventListener('click', close);

  const save = document.createElement('button');
  save.type = 'button';
  save.textContent = '심볼 추가';
  save.style.cssText = 'padding:8px 12px;border-radius:6px;border:1px solid #2962ff;background:#2962ff;color:white;cursor:pointer;font-size:12px;font-weight:700;';
  save.addEventListener('click', () => {
    err.textContent = '';

    const id = idField.input.value.trim().toUpperCase();
    const label = labelField.input.value.trim() || id;
    const category = categoryField.input.value.trim() || '기타';
    const desc = descInput.value.trim() || label;
    const iconUrl = iconField.input.value.trim();

    if (!id) {
      err.textContent = '티커 ID를 입력해주세요.';
      return;
    }
    if (!/^[A-Z0-9._-]{2,20}$/.test(id)) {
      err.textContent = '티커 ID는 영문/숫자/._- 조합 2~20자만 허용됩니다.';
      return;
    }
    if (hasDuplicateId(id, editingRef)) {
      err.textContent = '이미 존재하는 티커 ID입니다.';
      return;
    }

    if (editingRef) {
      const target = editingRef;
      const prevId = target.item.id;
      target.item.id = id;
      target.item.label = label;
      target.item.desc = desc;
      target.item.iconUrl = iconUrl || undefined;

      if (target.source === 'custom') {
        target.item.category = category;
        target.category = category;
      } else {
        if (target.category !== category) {
          const oldGroup = SYMBOL_CATALOG[target.category] ?? [];
          const oldIndex = oldGroup.findIndex((item) => item === target.item);
          if (oldIndex >= 0) oldGroup.splice(oldIndex, 1);
          if (!SYMBOL_CATALOG[category]) SYMBOL_CATALOG[category] = [];
          SYMBOL_CATALOG[category].push(target.item);
          target.category = category;
        }
      }
      if (chart.config.symbol === prevId) {
        chart.config.symbol = id;
      }
    } else {
      CUSTOM_SYMBOLS.push({
        id,
        label,
        desc,
        category,
        iconUrl: iconUrl || undefined,
      });
    }

    persistSymbolRegistry();
    onSymbolVisualUpdate();
    onApply();
    resetForm();
    renderSymbolList();
  });

  search.addEventListener('input', () => {
    query = search.value;
    renderSymbolList();
  });

  actions.appendChild(cancelEdit);
  actions.appendChild(cancel);
  actions.appendChild(save);
  body.appendChild(actions);

  renderSymbolList();
}

export function openTimezoneModal(chart: any, onApply: () => void) {
  const overlay = document.createElement('div');
  overlay.style.cssText = `position:fixed;inset:0;background:transparent;z-index:9000;`;
  overlay.addEventListener('click', (event) => {
    if (event.target === overlay) overlay.remove();
  });

  const panel = document.createElement('div');
  panel.className = 'timezone-panel';
  panel.style.cssText = `position:fixed;right:0;top:70px;bottom:16px;width:196px;
    background:#1c2030;border:1px solid #363a45;border-radius:10px 0 0 10px;
    padding:16px;display:flex;flex-direction:column;gap:14px;overflow-y:auto;
    box-shadow:-18px 0 45px rgba(0,0,0,0.55);`;

  if (!document.getElementById('timezone-panel-scrollbar-style')) {
    const styleEl = document.createElement('style');
    styleEl.id = 'timezone-panel-scrollbar-style';
    styleEl.textContent = `
      .timezone-panel::-webkit-scrollbar { width: 6px; }
      .timezone-panel::-webkit-scrollbar-track { background: transparent; }
      .timezone-panel::-webkit-scrollbar-thumb { background: rgba(255,255,255,0.16); border-radius: 99px; }
      .timezone-panel { scrollbar-width: thin; scrollbar-color: rgba(255,255,255,0.16) transparent; }
    `;
    document.head.appendChild(styleEl);
  }

  const header = document.createElement('div');
  header.textContent = '시간대 선택';
  header.style.cssText = 'font-size:15px;font-weight:700;color:white;margin-bottom:8px;';
  panel.appendChild(header);

  const createSection = (title: string, items: TimezoneOption[]) => {
    const section = document.createElement('div');
    section.style.cssText = 'display:flex;flex-direction:column;gap:6px;';

    const heading = document.createElement('div');
    heading.textContent = title;
    heading.style.cssText = 'font-size:13px;font-weight:700;color:#d1d4dc;margin-bottom:6px;';

    const wrap = document.createElement('div');
    wrap.style.cssText = 'display:flex;flex-direction:column;gap:6px;';

    items.forEach((item) => {
      const btn = document.createElement('button');
      btn.type = 'button';
      btn.textContent = item.display;
      btn.style.cssText = `text-align:left;background:${item.id === chart.config.timezone ? '#2962ff' : '#131722'};
        color:${item.id === chart.config.timezone ? 'white' : '#d1d4dc'};
        border:1px solid ${item.id === chart.config.timezone ? '#2962ff' : '#2a2e3e'};
        border-radius:6px;padding:10px 12px;cursor:pointer;font-size:13px;transition:background 0.15s,border-color 0.15s;`;
      btn.addEventListener('mouseenter', () => {
        if (item.id !== chart.config.timezone) btn.style.background = '#252a3a';
      });
      btn.addEventListener('mouseleave', () => {
        if (item.id !== chart.config.timezone) btn.style.background = '#131722';
      });
      btn.addEventListener('click', () => {
        chart.config.timezone = item.id;
        chart.draw();
        onApply();
        overlay.remove();
      });
      wrap.appendChild(btn);
    });

    section.appendChild(heading);
    section.appendChild(wrap);
    return section;
  };

  panel.appendChild(createSection('표준시', TIMEZONE_OPTIONS.filter(option => option.category === '표준시')));
  panel.appendChild(createSection('거래소', TIMEZONE_OPTIONS.filter(option => option.category === '거래소' && option.id !== 'Asia/Seoul')));
  panel.appendChild(createSection('UTC 오프셋', UTC_OFFSET_OPTIONS));

  overlay.appendChild(panel);
  document.body.appendChild(overlay);
}

// -----------------------------------------------------------------------------
// 종목 선택 모달
// -----------------------------------------------------------------------------

export function openSymbolModal(chart: any, symLabel: HTMLElement, symIcon: HTMLElement, onSelect: (s: string) => void) {
  const { body, close } = createModal('심볼 검색 / 선택', { anchorTop: true });

  const searchWrap = document.createElement('div');
  searchWrap.style.cssText = 'position:relative;margin-bottom:16px;';
  const inp = document.createElement('input');
  inp.placeholder = '심볼 검색.. 예: BTC, GOLD, NAS';
  inp.style.cssText = `width:100%;padding:10px 14px 10px 36px;background:#131722;
    border:1px solid #363a45;border-radius:6px;color:white;font-size:14px;
    outline:none;box-sizing:border-box;`;
  inp.addEventListener('focus', () => inp.style.borderColor = '#2962ff');
  inp.addEventListener('blur',  () => inp.style.borderColor = '#363a45');
  const si = document.createElement('span');
  si.innerHTML = `<svg width="14" height="14" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg" aria-hidden="true">
    <circle cx="11" cy="11" r="7" stroke="#8c93a3" stroke-width="2"/>
    <path d="M20 20L16.6 16.6" stroke="#8c93a3" stroke-width="2" stroke-linecap="round"/>
  </svg>`;
  si.style.cssText = 'position:absolute;left:12px;top:50%;transform:translateY(-50%);display:inline-flex;align-items:center;justify-content:center;pointer-events:none;';
  searchWrap.appendChild(si); searchWrap.appendChild(inp);
  body.appendChild(searchWrap);

  const categoryWrap = document.createElement('div');
  categoryWrap.style.cssText = 'display:flex;flex-wrap:wrap;gap:8px;margin-bottom:12px;';
  body.appendChild(categoryWrap);

  const listWrap = document.createElement('div');
  body.appendChild(listWrap);

  const FAVORITES_STORAGE_KEY = 'my-chart-lib.symbol-favorites.v1';
  let activeCategory = 'all';
  const loadFavoriteIds = (): Set<string> => {
    try {
      const raw = localStorage.getItem(FAVORITES_STORAGE_KEY);
      if (!raw) return new Set();
      const parsed = JSON.parse(raw) as unknown;
      if (!Array.isArray(parsed)) return new Set();
      return new Set(parsed.filter((v): v is string => typeof v === 'string').map((v) => v.toUpperCase()));
    } catch {
      return new Set();
    }
  };
  const saveFavoriteIds = (ids: Set<string>) => {
    localStorage.setItem(FAVORITES_STORAGE_KEY, JSON.stringify(Array.from(ids.values())));
  };
  let favoriteIds = loadFavoriteIds();

  const dedupeById = (items: SymbolCatalogItem[]): SymbolCatalogItem[] => {
    const map = new Map<string, SymbolCatalogItem>();
    items.forEach((item) => {
      const key = item.id.toUpperCase();
      if (!map.has(key)) map.set(key, item);
    });
    return Array.from(map.values());
  };
  const matchesQuery = (item: SymbolCatalogItem, q: string) =>
    !q
      || item.id.toLowerCase().includes(q.toLowerCase())
      || item.label.toLowerCase().includes(q.toLowerCase())
      || item.desc.toLowerCase().includes(q.toLowerCase());

  const renderCategoryButtons = (catalog: Record<string, SymbolCatalogItem[]>, q: string) => {
    categoryWrap.innerHTML = '';
    const allItems = dedupeById(Object.values(catalog).flat().filter((item) => matchesQuery(item, q)));
    const categories = Object.entries(catalog)
      .map(([cat, items]) => ({ cat, count: items.filter((item) => matchesQuery(item, q)).length }))
      .filter(({ count }) => count > 0);
    const totalCount = categories.reduce((sum, entry) => sum + entry.count, 0);
    const favoriteCount = allItems.filter((item) => favoriteIds.has(item.id.toUpperCase())).length;

    if (
      activeCategory !== 'all'
      && activeCategory !== 'favorites'
      && !categories.some(({ cat }) => cat === activeCategory)
    ) {
      activeCategory = 'all';
    }
    if (activeCategory === 'favorites' && favoriteCount === 0) {
      activeCategory = 'all';
    }

    const makeBtn = (id: string, label: string, count: number) => {
      const btn = document.createElement('button');
      const isActive = activeCategory === id;
      btn.textContent = `${label} (${count})`;
      btn.style.cssText = `padding:6px 10px;border-radius:999px;font-size:12px;cursor:pointer;
        appearance:none;-webkit-appearance:none;
        border:none;
        background-color:${isActive ? '#3b4252' : '#ffffff'};
        color:${isActive ? '#ffffff' : '#3b4252'};
        transition:background-color 0.22s ease,color 0.22s ease;`;
      btn.addEventListener('mouseenter', () => {
        if (activeCategory === id) return;
        btn.style.backgroundColor = '#3b4252';
        btn.style.color = '#ffffff';
      });
      btn.addEventListener('mouseleave', () => {
        if (activeCategory === id) return;
        btn.style.backgroundColor = '#ffffff';
        btn.style.color = '#3b4252';
      });
      btn.addEventListener('click', () => {
        activeCategory = id;
        render(inp.value);
      });
      categoryWrap.appendChild(btn);
    };

    makeBtn('all', '전체', totalCount);
    makeBtn('favorites', '즐겨찾기', favoriteCount);
    categories.forEach(({ cat, count }) => makeBtn(cat, cat, count));
  };

  const renderSymbolRow = (item: SymbolCatalogItem) => {
    const row = document.createElement('div');
    const active = item.id === chart.config.symbol;
    const isFavorite = favoriteIds.has(item.id.toUpperCase());
    row.style.cssText = `display:flex;align-items:center;justify-content:space-between;
      padding:10px 12px;border-radius:6px;cursor:pointer;margin-bottom:3px;
      background:${active ? 'rgba(41,98,255,0.15)' : 'transparent'};
      border:1px solid ${active ? '#2962ff' : 'transparent'};transition:background 0.15s;`;

    const left = document.createElement('div');
    left.style.cssText = 'display:flex;align-items:center;gap:10px;min-width:0;';
    const resolvedIconUrl = getSymbolIconUrl(item.id) ?? item.iconUrl;
    left.appendChild(createSymbolIconElement(item.id, resolvedIconUrl));

    const textWrap = document.createElement('div');
    textWrap.style.cssText = 'min-width:0;';
    textWrap.innerHTML = `<span style="font-size:14px;font-weight:700;">${item.label}</span>
      <span style="font-size:12px;color:#84898e;margin-left:10px;">${item.desc}</span>`;
    left.appendChild(textWrap);

    const right = document.createElement('div');
    right.style.cssText = 'display:flex;align-items:center;gap:8px;flex-shrink:0;';
    const favoriteBtn = document.createElement('button');
    favoriteBtn.type = 'button';
    favoriteBtn.title = isFavorite ? '즐겨찾기 해제' : '즐겨찾기 추가';
    favoriteBtn.textContent = isFavorite ? '★' : '☆';
    favoriteBtn.style.cssText = `border:none;background:transparent;cursor:pointer;font-size:15px;line-height:1;
      color:${isFavorite ? '#f9c846' : '#97a3bc'};padding:2px 4px;`;
    favoriteBtn.addEventListener('click', (event) => {
      event.stopPropagation();
      const key = item.id.toUpperCase();
      if (favoriteIds.has(key)) favoriteIds.delete(key);
      else favoriteIds.add(key);
      saveFavoriteIds(favoriteIds);
      render(inp.value);
    });
    right.appendChild(favoriteBtn);

    if (active) {
      const check = document.createElement('span');
      check.textContent = '✓';
      check.style.cssText = 'color:#2962ff;font-size:12px;';
      right.appendChild(check);
    }

    row.appendChild(left);
    row.appendChild(right);

    row.addEventListener('mouseenter', () => { if (!active) row.style.background = 'rgba(255,255,255,0.05)'; });
    row.addEventListener('mouseleave', () => { if (!active) row.style.background = 'transparent'; });
        row.addEventListener('click', () => {
          chart.config.symbol = item.id;
          symLabel.textContent = item.label;
          const nextIconUrl = getSymbolIconUrl(item.id) ?? item.iconUrl;
          const freshIcon = createSymbolIconElement(item.id, nextIconUrl);
          symIcon.innerHTML = '';
          symIcon.append(...Array.from(freshIcon.childNodes));
      onSelect(item.id);
      close();
    });
    listWrap.appendChild(row);
  };

  const render = (q: string) => {
    listWrap.innerHTML = '';
    const catalog = getAllSymbolCatalog();
    const allFiltered = dedupeById(Object.values(catalog).flat().filter((item) => matchesQuery(item, q)));
    renderCategoryButtons(catalog, q);

    if (activeCategory === 'favorites') {
      const favorites = allFiltered.filter((item) => favoriteIds.has(item.id.toUpperCase()));
      if (!favorites.length) {
        listWrap.innerHTML = '<div style="text-align:center;color:#84898e;padding:30px;">즐겨찾기 심볼이 없습니다</div>';
        return;
      }
      const title = document.createElement('div');
      title.textContent = '즐겨찾기';
      title.style.cssText = 'font-size:11px;color:#84898e;font-weight:700;letter-spacing:1px;margin:12px 0 6px;text-transform:uppercase;';
      listWrap.appendChild(title);
      favorites.forEach((item) => renderSymbolRow(item));
      return;
    }

    for (const [cat, items] of Object.entries(catalog)) {
      if (activeCategory !== 'all' && activeCategory !== cat) continue;
      const filtered = items.filter(it =>
        matchesQuery(it, q)
      );
      if (!filtered.length) continue;
      const catEl = document.createElement('div');
      catEl.textContent = cat;
      catEl.style.cssText = 'font-size:11px;color:#84898e;font-weight:700;letter-spacing:1px;margin:12px 0 6px;text-transform:uppercase;';
      listWrap.appendChild(catEl);
      filtered.forEach((item) => renderSymbolRow(item));
    }
    if (!listWrap.children.length)
      listWrap.innerHTML = '<div style="text-align:center;color:#84898e;padding:30px;">검색 결과가 없습니다</div>';
  };

  render('');
  inp.addEventListener('input', () => render(inp.value));
  if (!('ontouchstart' in window) && navigator.maxTouchPoints === 0) inp.focus();
}

// -----------------------------------------------------------------------------
// 지표 선택 모달
// -----------------------------------------------------------------------------

export function openIndicatorModal(chart: any, refresh: () => void) {
  const defaultPanelRatios = createDefaultPanelState().panelRatios;
  const { body } = createModal('지표 설정', { anchorTop: true });

  // 검색 입력
  const searchWrap = document.createElement('div');
  searchWrap.style.cssText = 'position:relative;margin-bottom:14px;';
  const inp = document.createElement('input');
  inp.placeholder = '지표 검색.. 예: RSI, MACD';
  inp.style.cssText = `width:100%;padding:10px 14px 10px 36px;background:#131722;
    border:1px solid #363a45;border-radius:6px;color:white;font-size:14px;
    outline:none;box-sizing:border-box;`;
  inp.addEventListener('focus', () => inp.style.borderColor = '#2962ff');
  inp.addEventListener('blur',  () => inp.style.borderColor = '#363a45');
  const si = document.createElement('span');
  si.innerHTML = `<svg width="14" height="14" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg" aria-hidden="true">
    <circle cx="11" cy="11" r="7" stroke="#8c93a3" stroke-width="2"/>
    <path d="M20 20L16.6 16.6" stroke="#8c93a3" stroke-width="2" stroke-linecap="round"/>
  </svg>`;
  si.style.cssText = 'position:absolute;left:12px;top:50%;transform:translateY(-50%);display:inline-flex;align-items:center;justify-content:center;pointer-events:none;';
  searchWrap.appendChild(si); searchWrap.appendChild(inp);
  body.appendChild(searchWrap);

  // 탭
  const tabWrap = document.createElement('div');
  tabWrap.style.cssText = 'display:flex;gap:6px;margin-bottom:14px;';
  let activeTab = 'all';
  const TABS = [{ id: 'all', lbl: '전체' }, { id: 'main', lbl: '메인 패널' }, { id: 'sub', lbl: '보조 패널' }];
  const tabEls: HTMLButtonElement[] = [];
  const setTab = (id: string) => {
    activeTab = id;
    tabEls.forEach((el, idx) => {
      el.style.background  = TABS[idx].id === id ? '#2962ff' : 'transparent';
      el.style.borderColor = TABS[idx].id === id ? '#2962ff' : '#363a45';
      el.style.color       = TABS[idx].id === id ? 'white'   : '#84898e';
    });
    render(inp.value);
  };
  TABS.forEach(t => {
    const btn = document.createElement('button');
    btn.textContent = t.lbl;
    btn.style.cssText = 'background:transparent;border:1px solid #363a45;border-radius:5px;color:#84898e;padding:5px 12px;cursor:pointer;font-size:12px;font-family:inherit;';
    btn.addEventListener('click', () => setTab(t.id));
    tabWrap.appendChild(btn); tabEls.push(btn);
  });
  body.appendChild(tabWrap);

  const orderWrap = document.createElement('div');
  orderWrap.style.cssText = 'margin-bottom:12px;padding:10px;border:1px solid #2a2e3e;border-radius:6px;background:#171b2a;';
  body.appendChild(orderWrap);

  const renderOrder = () => {
    orderWrap.innerHTML = '<div style="font-size:11px;color:#84898e;font-weight:700;margin-bottom:8px;">보조 패널 순서</div>';
    const panels = chart.activePanels as string[];
    if (!panels.length) {
      orderWrap.innerHTML += '<div style="font-size:12px;color:#666;">보조 패널이 없습니다.</div>';
      return;
    }

    panels.forEach((panelId: string, index: number) => {
      const label = INDICATOR_CATALOG.find(item => item.id === panelId)?.label ?? panelId;
      const row = document.createElement('div');
      row.style.cssText = 'display:flex;justify-content:space-between;align-items:center;margin-bottom:6px;';
      row.innerHTML = `<span style="font-size:12px;color:#d1d4dc;">${index + 1}. ${label}</span>`;

      const ctl = document.createElement('div');
      ctl.style.cssText = 'display:flex;gap:4px;';
      const up = document.createElement('button');
      up.textContent = '↑';
      up.disabled = index === 0;
      up.style.cssText = 'width:24px;height:20px;border:1px solid #363a45;background:#1f2434;color:#c0c4cc;border-radius:4px;cursor:pointer;';
      up.addEventListener('click', () => {
        chart.shiftPanelOrder(panelId, -1);
        chart.draw();
        refresh();
        renderOrder();
      });

      const down = document.createElement('button');
      down.textContent = '↓';
      down.disabled = index === panels.length - 1;
      down.style.cssText = 'width:24px;height:20px;border:1px solid #363a45;background:#1f2434;color:#c0c4cc;border-radius:4px;cursor:pointer;';
      down.addEventListener('click', () => {
        chart.shiftPanelOrder(panelId, 1);
        chart.draw();
        refresh();
        renderOrder();
      });

      ctl.appendChild(up);
      ctl.appendChild(down);
      row.appendChild(ctl);
      orderWrap.appendChild(row);
    });
  };

  const listWrap = document.createElement('div');
  body.appendChild(listWrap);

  const render = (q: string) => {
    listWrap.innerHTML = '';
    INDICATOR_CATALOG
      .filter(ind => {
        const mQ = !q || ind.label.toLowerCase().includes(q.toLowerCase()) || ind.desc.toLowerCase().includes(q.toLowerCase());
        const mT = activeTab === 'all' || ind.panel === activeTab;
        return mQ && mT;
      })
      .forEach(ind => {
        const isMa = ind.id === 'ma';
        const isOn = isMa
          ? Boolean((chart.config.indicators as any).ma?.show && ((chart.config.indicators as any).ma?.lines?.length ?? 0) > 0)
          : ((chart.config.indicators as any)[ind.id]?.show ?? false);
        const row  = document.createElement('div');
        row.style.cssText = `display:flex;align-items:center;justify-content:space-between;
          padding:10px 12px;border-radius:6px;cursor:pointer;margin-bottom:3px;
          border:1px solid ${isOn ? 'rgba(41,98,255,0.4)' : 'transparent'};
          background:${isOn ? 'rgba(41,98,255,0.08)' : 'transparent'};transition:background 0.15s;`;
        const panelBadge = ind.panel === 'main'
          ? '<span style="font-size:10px;background:#2a2e39;color:#84898e;padding:1px 5px;border-radius:3px;margin-left:8px;">메인</span>'
          : '<span style="font-size:10px;background:#2a2e39;color:#84898e;padding:1px 5px;border-radius:3px;margin-left:8px;">보조</span>';
        row.innerHTML = `<div>
          <span style="font-size:13px;font-weight:700;">${ind.label}</span>${panelBadge}
          <div style="font-size:11px;color:#555;margin-top:2px;">${ind.desc}</div>
        </div>
        <div style="width:36px;height:20px;border-radius:10px;background:${isOn ? '#2962ff' : '#363a45'};
          display:flex;align-items:center;padding:0 3px;box-sizing:border-box;transition:background 0.2s;flex-shrink:0;">
          <div style="width:14px;height:14px;border-radius:50%;background:white;
            transform:translateX(${isOn ? '16px' : '0'});transition:transform 0.2s;"></div>
        </div>`;
        row.addEventListener('mouseenter', () => { if (!isOn) row.style.background = 'rgba(255,255,255,0.04)'; });
        row.addEventListener('mouseleave', () => { if (!isOn) row.style.background = 'transparent'; });
        row.addEventListener('click', () => {
          if (ind.id === 'ma') {
            chart.addMaLine?.();
            chart.draw();
            refresh();
            render(q);
            renderOrder();
            window.setTimeout(() => openSettingsPopup(row, chart, 'ma', () => {
              chart.draw();
              refresh();
              render(q);
            }), 0);
            return;
          }
          if ((chart.config.indicators as any)[ind.id] !== undefined) {
            const nextOn = !isOn;
            (chart.config.indicators as any)[ind.id].show = nextOn;
            if (ind.panel === 'sub') {
              const hiddenPanels = new Set<string>(((chart.config.panelState as any).hiddenPanels ?? []) as string[]);
              hiddenPanels.delete(ind.id);
              (chart.config.panelState as any).hiddenPanels = Array.from(hiddenPanels);
              if (nextOn) {
                chart.config.panelState.panelRatios[ind.id] = defaultPanelRatios[ind.id] ?? 0.12;
              }
            }
            chart.draw();
            refresh();
            render(q);
            renderOrder();
          }
        });
        listWrap.appendChild(row);
      });
    if (!listWrap.children.length)
      listWrap.innerHTML = '<div style="text-align:center;color:#84898e;padding:30px;">검색 결과가 없습니다</div>';
  };

  setTab('all');
  renderOrder();
  inp.addEventListener('input', () => render(inp.value));
  if (!('ontouchstart' in window) && navigator.maxTouchPoints === 0) inp.focus();
}

export function openSettingsPopup(anchor: HTMLElement, chart: any, key: string, onUpdate: () => void) {
  document.querySelectorAll('.ind-popup').forEach(e => e.remove());
  const indicators = chart.config.indicators as any;
  const popupKey = key;
  const ind = indicators[popupKey];
  if (!ind) return;

  const popup = document.createElement('div');
  popup.className = 'ind-popup';
  const rect = anchor.getBoundingClientRect();
  popup.style.cssText = `position:fixed;top:${rect.bottom + 6}px;left:${rect.left}px;
    background:#1c2030;border:1px solid #363a45;border-radius:8px;padding:14px 16px;
    z-index:9999;font-family:'Segoe UI',Arial,sans-serif;font-size:12px;color:white;
    min-width:210px;box-shadow:0 8px 32px rgba(0,0,0,0.5);box-sizing:border-box;`;

  const placePopup = () => {
    const margin = 8;
    const viewportW = Math.max(240, window.innerWidth || document.documentElement.clientWidth || 360);
    const viewportH = Math.max(240, window.innerHeight || document.documentElement.clientHeight || 640);
    const isMobile = viewportW < 560 || (window.matchMedia?.('(pointer: coarse)').matches ?? false);
    popup.style.maxWidth = `${viewportW - margin * 2}px`;
    popup.style.maxHeight = `${viewportH - margin * 2}px`;
    popup.style.overflowY = 'auto';
    popup.style.overscrollBehavior = 'contain';
    if (isMobile) {
      popup.style.left = `${margin}px`;
      popup.style.right = `${margin}px`;
      popup.style.top = `${margin}px`;
      popup.style.width = `calc(100vw - ${margin * 2}px)`;
      return;
    }
    popup.style.right = '';
    popup.style.width = '';
    const popupW = popup.offsetWidth || 210;
    const popupH = popup.offsetHeight || 120;
    const left = Math.min(Math.max(margin, rect.left), Math.max(margin, viewportW - popupW - margin));
    const top = Math.min(Math.max(margin, rect.bottom + 6), Math.max(margin, viewportH - popupH - margin));
    popup.style.left = `${left}px`;
    popup.style.top = `${top}px`;
  };

  const appendPopup = () => {
    document.body.appendChild(popup);
    placePopup();
    window.requestAnimationFrame(placePopup);
  };

  const hdr = document.createElement('div');
  hdr.style.cssText = 'font-weight:700;margin-bottom:12px;font-size:13px;display:flex;justify-content:space-between;';
  const headerTitle = popupKey === 'supertrend'
    ? 'SUPER - SUPERTREND'
    : popupKey === 'statisticalTrailingStop'
      ? 'STS - Statistical Trailing Stop'
    : popupKey === 'zeroLagMaTrendLevels'
      ? 'ZLMA - Zero-Lag MA Trend Levels'
    : popupKey === 'bb'
      ? 'Bollinger Band'
      : popupKey.toUpperCase();
  hdr.innerHTML = `<span>${headerTitle}</span>`;
  const xb = document.createElement('button');
  xb.textContent = '×';
  xb.style.cssText = 'background:none;border:none;color:#84898e;cursor:pointer;font-size:14px;';
  xb.addEventListener('click', () => popup.remove());
  hdr.appendChild(xb); popup.appendChild(hdr);

  const FIELDS: Record<string, string[]> = {
    maShort: ['value'], maLong: ['value'], ma60: ['value'], ma120: ['value'], ma200: ['value'], bb: [],
    supertrend: ['period', 'factor'],
    statisticalTrailingStop: ['dataLength', 'distributionLength', 'baseLevel'],
    zeroLagMaTrendLevels: ['length'],
    rsi: ['period'], dmi: ['period'], macd: ['fast','slow','signal'],
    stochF: ['kPeriod','dPeriod'], stochS: ['kPeriod','dPeriod'],
    cci: ['period'], ichimoku: ['tenkan','kijun','senkou'],
    envelope: ['period','pct'], vwap: [], volumeProfile: ['rows', 'widthPct'], vpvr: [], obv: [], volume: [],
  };
  const LABELS: Record<string, string> = {
    value: '값', period: '기간', stdDev: '표준편차',
    factor: 'Factor',
    dataLength: 'Data Length',
    distributionLength: 'Distribution Length',
    baseLevel: 'Base Level',
    length: 'Length',
    fast: 'Fast', slow: 'Slow', signal: 'Signal',
    kPeriod: 'K 기간', dPeriod: 'D 기간',
    tenkan: '전환선', kijun: '기준선', senkou: '선행스팬 B', pct: '편차 (%)',
    rows: '행 개수 / 행당 틱', widthPct: '폭 (%)', valueAreaVolume: 'Value Area 비율(%)',
    upOpacity: '상승 투명도 (%)', downOpacity: '하락 투명도 (%)', pocOpacity: 'POC 투명도 (%)',
  };
  const toHexColor = (source: string): string => {
    if (source.startsWith('#')) return source.length === 7 ? source : '#ffffff';
    const m = source.match(/rgba?\((\d+),\s*(\d+),\s*(\d+)/i);
    if (!m) return '#ffffff';
    const toHex = (n: string) => Number(n).toString(16).padStart(2, '0');
    return `#${toHex(m[1])}${toHex(m[2])}${toHex(m[3])}`;
  };
  const getDashMode = (dash: number[] | undefined): 'solid' | 'dashed' | 'dotted' => {
    if (!dash || !dash.length) return 'solid';
    if (dash[0] <= 2) return 'dotted';
    return 'dashed';
  };
  const toDash = (mode: 'solid' | 'dashed' | 'dotted'): number[] => {
    if (mode === 'dashed') return [6, 4];
    if (mode === 'dotted') return [2, 3];
    return [];
  };
  const createLineModePicker = (
    initial: 'solid' | 'dashed' | 'dotted',
    onChange: (next: 'solid' | 'dashed' | 'dotted') => void,
  ): HTMLSelectElement => {
    const select = document.createElement('select');
    select.style.cssText = 'height:24px;width:74px;background:#131722;border:1px solid #363a45;border-radius:4px;color:white;font-size:11px;padding:0 3px;';
    select.innerHTML = [
      '<option value="solid">━━ 실선</option>',
      '<option value="dashed">┅┅ 대시</option>',
      '<option value="dotted">··· 도트</option>',
    ].join('');
    select.value = initial;
    select.addEventListener('change', () => {
      onChange(select.value as 'solid' | 'dashed' | 'dotted');
    });
    return select;
  };
  const withTouchStepper = (input: HTMLInputElement): HTMLDivElement => {
    const wrap = document.createElement('div');
    wrap.style.cssText = 'display:flex;align-items:stretch;min-width:0;width:100%;';
    input.style.flex = '1 1 auto';
    input.style.minWidth = '0';
    wrap.appendChild(input);
    return wrap;
  };
  const createSwitch = (
    initial: boolean,
    onToggle: (next: boolean) => void,
    titles?: { on: string; off: string },
  ): { button: HTMLButtonElement; setState: (next: boolean) => void } => {
    let state = initial;
    const btn = document.createElement('button');
    btn.type = 'button';
    btn.style.cssText = 'width:34px;height:16px;border:none;border-radius:999px;padding:1px;cursor:pointer;position:relative;transition:background 0.15s ease;display:inline-flex;align-items:center;justify-content:center;overflow:hidden;';
    const text = document.createElement('span');
    text.style.cssText = 'position:absolute;inset:0;display:flex;align-items:center;font-size:8px;font-weight:800;letter-spacing:0.2px;color:#ffffff;line-height:1;pointer-events:none;user-select:none;padding:0 4px;z-index:0;text-shadow:0 1px 1px rgba(0,0,0,0.85);';
    const knob = document.createElement('span');
    knob.style.cssText = 'width:12px;height:12px;border-radius:50%;background:#ffffff;box-shadow:0 1px 2px rgba(0,0,0,0.45);transition:transform 0.15s ease;position:absolute;left:1px;top:2px;z-index:1;';
    btn.appendChild(text);
    btn.appendChild(knob);

    const render = () => {
      btn.style.background = state ? '#2a65ff' : '#4f5668';
      knob.style.transform = state ? 'translateX(20px)' : 'translateX(0)';
      text.textContent = state ? 'ON' : 'OFF';
      text.style.justifyContent = state ? 'flex-start' : 'flex-end';
      text.style.opacity = state ? '1' : '0.95';
      btn.title = state ? (titles?.on ?? '켜짐') : (titles?.off ?? '꺼짐');
      btn.setAttribute('aria-checked', state ? 'true' : 'false');
    };

    btn.addEventListener('click', (event) => {
      event.preventDefault();
      event.stopPropagation();
      state = !state;
      render();
      onToggle(state);
    });

    render();
    return {
      button: btn,
      setState: (next: boolean) => {
        state = next;
        render();
      },
    };
  };

  if (popupKey === 'ma') {
    if (!Array.isArray(ind.lines)) ind.lines = [];
    if (!Number.isFinite(Number(ind.nextId))) ind.nextId = ind.lines.length + 1;
    ind.show = true;
    popup.style.minWidth = 'min(420px, calc(100vw - 16px))';

    const palette = ['#f7931a', '#2962ff', '#4caf50', '#9c27b0', '#ff5722', '#00bcd4', '#ffc107', '#e91e63'];

    const rows = document.createElement('div');
    rows.style.cssText = 'display:flex;flex-direction:column;gap:8px;';
    popup.appendChild(rows);

    const renderMaRows = () => {
      rows.innerHTML = '';
      if (!ind.lines.length) {
        const empty = document.createElement('div');
        empty.textContent = 'MA 라인이 없습니다. 아래 + 버튼으로 추가하세요.';
        empty.style.cssText = 'color:#84898e;font-size:12px;padding:8px 0;';
        rows.appendChild(empty);
      }

      ind.lines.forEach((line: any, index: number) => {
        if (!line.id) line.id = `ma${index + 1}`;
        if (!Number.isFinite(Number(line.period))) line.period = index === 0 ? 5 : 20;
        const styleKey = String(line.id);
        const style = getLineStyle(chart.config.panelState, styleKey, {
          color: palette[index % palette.length],
          width: 1.5,
          dash: [],
        });
        let visible = chart.isIndicatorLineVisible(styleKey);

        const row = document.createElement('div');
        row.style.cssText = 'display:grid;grid-template-columns:42px 58px 28px 46px 78px 58px;align-items:center;gap:6px;';

        const name = document.createElement('span');
        name.textContent = `MA${index + 1}`;
        name.style.cssText = 'font-weight:700;color:#d7dfef;';

        const period = document.createElement('input');
        period.type = 'number';
        period.min = '1';
        period.step = '1';
        period.value = String(line.period);
        period.title = '기간';
        period.style.cssText = 'width:58px;min-width:58px;background:#131722;color:white;border:1px solid #363a45;border-radius:4px;padding:4px 6px;text-align:right;font-size:12px;box-sizing:border-box;';
        period.addEventListener('change', () => {
          const next = Math.max(1, Math.floor(Number(period.value) || 1));
          line.period = next;
          period.value = String(next);
          chart.draw();
          onUpdate();
        });

        const color = document.createElement('input');
        color.type = 'color';
        color.value = toHexColor(style.color);
        color.title = '색상';
        color.style.cssText = 'width:28px;height:24px;padding:0;border:1px solid #363a45;border-radius:4px;background:#131722;cursor:pointer;';
        color.addEventListener('input', () => {
          chart.setIndicatorStyle(styleKey, { color: color.value });
          chart.draw();
          onUpdate();
        });

        const width = document.createElement('input');
        width.type = 'number';
        width.min = '1';
        width.max = '6';
        width.step = '0.5';
        width.value = String(style.width ?? 1.5);
        width.title = '두께';
        width.style.cssText = 'width:46px;background:#131722;color:white;border:1px solid #363a45;border-radius:4px;padding:4px 5px;text-align:right;font-size:12px;box-sizing:border-box;';
        width.addEventListener('change', () => {
          const nextWidth = Math.max(1, Math.min(6, Number(width.value) || 1.5));
          width.value = String(nextWidth);
          chart.setIndicatorStyle(styleKey, { width: nextWidth });
          chart.draw();
          onUpdate();
        });

        const modePicker = createLineModePicker(getDashMode(style.dash), (nextMode) => {
          chart.setIndicatorStyle(styleKey, { dash: toDash(nextMode) });
          chart.draw();
          onUpdate();
        });

        const actions = document.createElement('div');
        actions.style.cssText = 'display:flex;gap:3px;';

        const toggle = createSwitch(visible, (nextVisible) => {
          visible = nextVisible;
          chart.setIndicatorLineVisible(styleKey, nextVisible);
          chart.draw();
          onUpdate();
        }, { on: '감추기', off: '보이기' }).button;

        const del = document.createElement('button');
        del.type = 'button';
        del.textContent = '×';
        del.title = '삭제';
        del.style.cssText = 'width:24px;height:24px;border:none;border-radius:4px;background:#54232b;color:#ffd2d7;cursor:pointer;font-size:14px;';
        del.addEventListener('click', () => {
          ind.lines = ind.lines.filter((item: any) => item !== line);
          if (!ind.lines.length) ind.show = false;
          chart.draw();
          onUpdate();
          renderMaRows();
        });

        actions.append(toggle, del);
        row.append(name, withTouchStepper(period), color, withTouchStepper(width), modePicker, actions);
        rows.appendChild(row);
      });
    };

    renderMaRows();

    const addBtn = document.createElement('button');
    addBtn.type = 'button';
    addBtn.textContent = '+ MA 추가';
    addBtn.style.cssText = 'width:100%;margin-top:10px;padding:8px;border:1px solid #3b65b7;border-radius:6px;background:#20345c;color:#dbe8ff;font-weight:700;cursor:pointer;';
    addBtn.addEventListener('click', () => {
      chart.addMaLine?.();
      chart.draw();
      onUpdate();
      renderMaRows();
    });
    popup.appendChild(addBtn);

    appendPopup();
    return;
  }

  if (popupKey === 'bb') {
    if (!Array.isArray(ind.lines)) {
      ind.lines = [{
        id: 'bb1',
        period: Math.max(1, Math.floor(Number(ind.period ?? 20) || 20)),
        stdDev: Math.max(0.1, Number(ind.stdDev ?? 2) || 2),
      }];
      ind.nextId = 2;
    }
    if (!Number.isFinite(Number(ind.nextId))) ind.nextId = ind.lines.length + 1;
    ind.show = true;
    popup.style.minWidth = 'min(430px, calc(100vw - 16px))';

    const palette = ['100,149,237', '255,193,7', '38,166,154', '239,83,80', '156,39,176'];
    const rows = document.createElement('div');
    rows.style.cssText = 'display:flex;flex-direction:column;gap:10px;';
    popup.appendChild(rows);

    const renderBbRows = () => {
      rows.innerHTML = '';
      if (!ind.lines.length) {
        const empty = document.createElement('div');
        empty.textContent = 'BB 라인이 없습니다. 아래 + 버튼으로 추가하세요.';
        empty.style.cssText = 'color:#84898e;font-size:12px;padding:8px 0;';
        rows.appendChild(empty);
      }

      ind.lines.forEach((line: any, index: number) => {
        if (!line.id) line.id = `bb${index + 1}`;
        if (!Number.isFinite(Number(line.period))) line.period = 20;
        if (!Number.isFinite(Number(line.stdDev))) line.stdDev = index === 0 ? 2 : 1;
        const rgb = palette[index % palette.length];
        const lineId = String(line.id);
        const targets = [
          { suffix: 'Upper', label: '상단', fallback: `rgba(${rgb},0.82)`, dash: [] as number[] },
          { suffix: 'Middle', label: '중앙', fallback: `rgba(${rgb},0.48)`, dash: [4, 4] },
          { suffix: 'Lower', label: '하단', fallback: `rgba(${rgb},0.82)`, dash: [] as number[] },
        ];

        const box = document.createElement('div');
        box.style.cssText = 'border:1px solid #303647;border-radius:6px;padding:8px;background:#181d2a;';

        const top = document.createElement('div');
        top.style.cssText = 'display:grid;grid-template-columns:42px minmax(52px,1fr) minmax(52px,1fr) auto;align-items:center;gap:7px;margin-bottom:8px;';
        const name = document.createElement('span');
        name.textContent = `BB${index + 1}`;
        name.style.cssText = 'font-weight:700;color:#d7dfef;';

        const period = document.createElement('input');
        period.type = 'number';
        period.min = '1';
        period.step = '1';
        period.value = String(line.period);
        period.title = '기간';
        period.style.cssText = 'width:100%;background:#131722;color:white;border:1px solid #363a45;border-radius:4px;padding:4px 6px;text-align:right;font-size:12px;box-sizing:border-box;';
        period.addEventListener('change', () => {
          const next = Math.max(1, Math.floor(Number(period.value) || 20));
          line.period = next;
          period.value = String(next);
          chart.draw();
          onUpdate();
        });

        const stdDev = document.createElement('input');
        stdDev.type = 'number';
        stdDev.min = '0.1';
        stdDev.step = '0.1';
        stdDev.value = String(line.stdDev);
        stdDev.title = '표준편차';
        stdDev.style.cssText = period.style.cssText;
        stdDev.addEventListener('change', () => {
          const next = Math.max(0.1, Number(stdDev.value) || 2);
          line.stdDev = next;
          stdDev.value = String(next);
          chart.draw();
          onUpdate();
        });

        const isAllVisible = targets.every((target) => chart.isIndicatorLineVisible(`${lineId}${target.suffix}`));

        const actions = document.createElement('div');
        actions.style.cssText = 'display:flex;align-items:center;gap:4px;justify-self:end;';

        const hideBtn = document.createElement('button');
        hideBtn.type = 'button';
        hideBtn.textContent = isAllVisible ? '감추기' : '보이기';
        hideBtn.title = isAllVisible ? '상/중/하 라인 감추기' : '상/중/하 라인 보이기';
        hideBtn.style.cssText = `height:26px;padding:0 8px;border:none;border-radius:4px;background:${isAllVisible ? '#2f3d5d' : '#2e5442'};color:#dbe6ff;cursor:pointer;font-size:11px;white-space:nowrap;`;
        hideBtn.addEventListener('click', () => {
          const nextVisible = !targets.every((target) => chart.isIndicatorLineVisible(`${lineId}${target.suffix}`));
          targets.forEach((target) => {
            chart.setIndicatorLineVisible(`${lineId}${target.suffix}`, nextVisible);
          });
          chart.draw();
          onUpdate();
          renderBbRows();
        });

        const del = document.createElement('button');
        del.type = 'button';
        del.textContent = '×';
        del.title = '삭제';
        del.style.cssText = 'width:26px;height:26px;border:none;border-radius:4px;background:#54232b;color:#ffd2d7;cursor:pointer;font-size:14px;';
        del.addEventListener('click', () => {
          ind.lines = ind.lines.filter((item: any) => item !== line);
          if (!ind.lines.length) ind.show = false;
          chart.draw();
          onUpdate();
          renderBbRows();
        });

        actions.append(hideBtn, del);
        top.append(name, withTouchStepper(period), withTouchStepper(stdDev), actions);
        box.appendChild(top);

        targets.forEach((target) => {
          const styleKey = `${lineId}${target.suffix}`;
          const style = getLineStyle(chart.config.panelState, styleKey, {
            color: target.fallback,
            width: 1,
            dash: target.dash,
          });
          let visible = chart.isIndicatorLineVisible(styleKey);
          const row = document.createElement('div');
          row.style.cssText = 'display:grid;grid-template-columns:42px 34px 28px 48px 78px;align-items:center;gap:6px;margin-top:6px;';

          const label = document.createElement('span');
          label.textContent = target.label;
          label.style.cssText = 'color:#a9b5cc;';

          const toggle = createSwitch(visible, (nextVisible) => {
            visible = nextVisible;
            chart.setIndicatorLineVisible(styleKey, nextVisible);
            chart.draw();
            onUpdate();
          }, { on: '감추기', off: '보이기' }).button;

          const color = document.createElement('input');
          color.type = 'color';
          color.value = toHexColor(style.color);
          color.style.cssText = 'width:28px;height:24px;padding:0;border:1px solid #363a45;border-radius:4px;background:#131722;cursor:pointer;';
          color.addEventListener('input', () => {
            chart.setIndicatorStyle(styleKey, { color: color.value });
            chart.draw();
            onUpdate();
          });

          const width = document.createElement('input');
          width.type = 'number';
          width.min = '1';
          width.max = '6';
          width.step = '0.5';
          width.value = String(style.width ?? 1);
          width.style.cssText = 'width:48px;background:#131722;color:white;border:1px solid #363a45;border-radius:4px;padding:4px 5px;text-align:right;font-size:12px;box-sizing:border-box;';
          width.addEventListener('change', () => {
            const nextWidth = Math.max(1, Math.min(6, Number(width.value) || 1));
            width.value = String(nextWidth);
            chart.setIndicatorStyle(styleKey, { width: nextWidth });
            chart.draw();
            onUpdate();
          });

          const modePicker = createLineModePicker(getDashMode(style.dash), (nextMode) => {
            chart.setIndicatorStyle(styleKey, { dash: toDash(nextMode) });
            chart.draw();
            onUpdate();
          });

          row.append(label, toggle, color, withTouchStepper(width), modePicker);
          box.appendChild(row);
        });

        rows.appendChild(box);
      });
    };

    renderBbRows();

    const addBtn = document.createElement('button');
    addBtn.type = 'button';
    addBtn.textContent = '+ BB 추가';
    addBtn.style.cssText = 'width:100%;margin-top:10px;padding:8px;border:1px solid #3b65b7;border-radius:6px;background:#20345c;color:#dbe8ff;font-weight:700;cursor:pointer;';
    addBtn.addEventListener('click', () => {
      chart.addBbLine?.();
      chart.draw();
      onUpdate();
      renderBbRows();
    });
    popup.appendChild(addBtn);
    appendPopup();
    return;
  }

  (FIELDS[popupKey] || []).forEach(field => {
    const row = document.createElement('div');
    row.style.cssText = 'display:flex;justify-content:space-between;align-items:center;margin-bottom:8px;';
    const lbl = document.createElement('span');
    lbl.textContent = popupKey === 'supertrend' && field === 'period' ? 'ATR Length' : (LABELS[field] || field);
    lbl.style.color = '#84898e';
    const inp = document.createElement('input');
    inp.type = 'number'; inp.value = ind[field] ?? '';
    if (popupKey === 'statisticalTrailingStop') {
      if (field === 'dataLength') {
        inp.min = '1';
        inp.step = '1';
      } else if (field === 'distributionLength') {
        inp.min = '10';
        inp.max = '5000';
        inp.step = '1';
      } else if (field === 'baseLevel') {
        inp.min = '0';
        inp.max = '3';
        inp.step = '1';
      }
    } else if (popupKey === 'zeroLagMaTrendLevels' && field === 'length') {
      inp.min = '1';
      inp.step = '1';
    }
    inp.style.cssText = 'width:64px;background:#131722;color:white;border:1px solid #363a45;border-radius:4px;padding:3px 7px;text-align:right;font-size:12px;';
    inp.addEventListener('change', () => {
      let next = Number(inp.value);
      if (popupKey === 'statisticalTrailingStop') {
        if (field === 'dataLength') next = Math.max(1, Math.floor(Number(next) || 10));
        if (field === 'distributionLength') next = Math.max(10, Math.min(5000, Math.floor(Number(next) || 100)));
        if (field === 'baseLevel') next = Math.max(0, Math.min(3, Math.floor(Number(next) || 2)));
      } else if (popupKey === 'zeroLagMaTrendLevels' && field === 'length') {
        next = Math.max(1, Math.floor(Number(next) || 15));
      }
      ind[field] = next;
      inp.value = String(ind[field]);
      chart.draw(); onUpdate();
    });
    row.appendChild(lbl); row.appendChild(inp); popup.appendChild(row);
  });

  if (popupKey === 'dmi') {
    if (!Number.isFinite(Number(ind.topThreshold))) ind.topThreshold = 30;
    if (!Number.isFinite(Number(ind.bottomThreshold))) ind.bottomThreshold = 20;

    const modeRow = document.createElement('div');
    modeRow.style.cssText = 'display:flex;justify-content:space-between;align-items:center;margin-bottom:10px;';
    const modeLabel = document.createElement('span');
    modeLabel.textContent = '축 모드';
    modeLabel.style.color = '#84898e';
    const modeBtn = document.createElement('button');
    const currentMode = ((ind.axisMode === 'fixed') ? 'fixed' : 'auto') as 'auto' | 'fixed';
    modeBtn.textContent = currentMode === 'auto' ? '자동 (추천)' : '고정 (0~60)';
    modeBtn.style.cssText = `padding:4px 10px;border-radius:6px;border:1px solid #3b4c6f;
      background:${currentMode === 'auto' ? '#2a3d66' : '#2a2e3e'};color:#dbe6ff;font-size:11px;cursor:pointer;`;
    modeBtn.addEventListener('click', () => {
      ind.axisMode = ind.axisMode === 'fixed' ? 'auto' : 'fixed';
      const nextMode = ind.axisMode === 'fixed' ? 'fixed' : 'auto';
      modeBtn.textContent = nextMode === 'auto' ? '자동 (추천)' : '고정 (0~60)';
      modeBtn.style.background = nextMode === 'auto' ? '#2a3d66' : '#2a2e3e';
      chart.draw();
      onUpdate();
    });
    modeRow.appendChild(modeLabel);
    modeRow.appendChild(modeBtn);
    popup.appendChild(modeRow);

    const createThresholdRow = (labelText: string, field: 'topThreshold' | 'bottomThreshold') => {
      const row = document.createElement('div');
      row.style.cssText = 'display:flex;justify-content:space-between;align-items:center;margin-bottom:8px;';
      const lbl = document.createElement('span');
      lbl.textContent = labelText;
      lbl.style.color = '#84898e';
      const inp = document.createElement('input');
      inp.type = 'number';
      inp.step = '1';
      inp.min = '0';
      inp.max = '100';
      inp.value = String(ind[field] ?? (field === 'topThreshold' ? 30 : 20));
      inp.style.cssText = 'width:72px;background:#131722;color:white;border:1px solid #363a45;border-radius:4px;padding:3px 7px;text-align:right;font-size:12px;';
      inp.addEventListener('change', () => {
        let next = Number(inp.value);
        if (!Number.isFinite(next)) next = field === 'topThreshold' ? 30 : 20;
        next = Math.max(0, Math.min(100, next));
        ind[field] = next;
        inp.value = String(next);
        chart.draw();
        onUpdate();
      });
      row.appendChild(lbl);
      row.appendChild(inp);
      popup.appendChild(row);
    };

    createThresholdRow('Top threshold', 'topThreshold');
    createThresholdRow('Bottom threshold', 'bottomThreshold');
  }

  if (popupKey === 'supertrend') {
    const sec = document.createElement('div');
    sec.style.cssText = 'margin-top:6px;padding-top:8px;border-top:1px solid #363a45;';

    const makeLineRow = (labelText: string, styleKey: 'supertrendUp' | 'supertrendDown') => {
      const style = getLineStyle(chart.config.panelState, styleKey, {
        color: styleKey === 'supertrendUp' ? '#26a69a' : '#ef5350',
        width: 1.7,
        dash: [],
      });
      const row = document.createElement('div');
      row.style.cssText = 'display:flex;justify-content:space-between;align-items:center;margin-bottom:8px;gap:8px;';
      const lbl = document.createElement('span');
      lbl.textContent = labelText;
      lbl.style.color = '#c0c4cc';
      const right = document.createElement('div');
      right.style.cssText = 'display:flex;align-items:center;gap:6px;';

      const modePicker = createLineModePicker(getDashMode(style.dash), (nextMode) => {
        chart.setIndicatorStyle(styleKey, { dash: toDash(nextMode) });
        chart.draw();
        onUpdate();
      });

      const color = document.createElement('input');
      color.type = 'color';
      color.value = toHexColor(style.color);
      color.style.cssText = 'width:28px;height:24px;padding:0;border:1px solid #363a45;border-radius:4px;background:#131722;cursor:pointer;';
      color.addEventListener('input', () => {
        chart.setIndicatorStyle(styleKey, { color: color.value });
        chart.draw();
        onUpdate();
      });

      const width = document.createElement('input');
      width.type = 'number';
      width.min = '1';
      width.max = '6';
      width.step = '0.5';
      width.value = String(style.width ?? 1.7);
      width.style.cssText = 'width:52px;background:#131722;color:white;border:1px solid #363a45;border-radius:4px;padding:3px 6px;text-align:right;font-size:12px;';
      width.addEventListener('change', () => {
        const nextWidth = Math.max(1, Math.min(6, Number(width.value) || 1.7));
        width.value = String(nextWidth);
        chart.setIndicatorStyle(styleKey, { width: nextWidth });
        chart.draw();
        onUpdate();
      });
      right.appendChild(modePicker);
      right.appendChild(color);
      right.appendChild(width);
      row.appendChild(lbl);
      row.appendChild(right);
      sec.appendChild(row);
    };

    const makeBgRow = (labelText: string, enabledKey: 'upBgEnabled' | 'downBgEnabled', colorKey: 'upBgColor' | 'downBgColor', fallbackColor: string) => {
      if (typeof ind[enabledKey] !== 'boolean') ind[enabledKey] = true;
      if (typeof ind[colorKey] !== 'string' || !ind[colorKey]) ind[colorKey] = fallbackColor;

      const row = document.createElement('div');
      row.style.cssText = 'display:flex;justify-content:space-between;align-items:center;margin-bottom:8px;gap:8px;';
      const left = document.createElement('label');
      left.style.cssText = 'display:flex;align-items:center;gap:6px;color:#c0c4cc;';
      const chk = document.createElement('input');
      chk.type = 'checkbox';
      chk.checked = Boolean(ind[enabledKey]);
      chk.addEventListener('change', () => {
        ind[enabledKey] = chk.checked;
        chart.draw();
        onUpdate();
      });
      const txt = document.createElement('span');
      txt.textContent = labelText;
      left.appendChild(chk);
      left.appendChild(txt);

      const color = document.createElement('input');
      color.type = 'color';
      color.value = toHexColor(ind[colorKey]);
      color.style.cssText = 'width:28px;height:24px;padding:0;border:1px solid #363a45;border-radius:4px;background:#131722;cursor:pointer;';
      color.addEventListener('input', () => {
        ind[colorKey] = color.value;
        chart.draw();
        onUpdate();
      });
      row.appendChild(left);
      row.appendChild(color);
      sec.appendChild(row);
    };

    makeLineRow('Up Trend', 'supertrendUp');
    makeLineRow('Down Trend', 'supertrendDown');
    makeBgRow('Up Trend Background', 'upBgEnabled', 'upBgColor', 'rgba(38,166,154,0.18)');
    makeBgRow('Down Trend Background', 'downBgEnabled', 'downBgColor', 'rgba(239,83,80,0.18)');

    popup.appendChild(sec);
  }

  if (popupKey === 'statisticalTrailingStop') {
    if (typeof ind.bullishColor !== 'string' || !ind.bullishColor) ind.bullishColor = 'rgba(8,153,129,0.5)';
    if (typeof ind.bearishColor !== 'string' || !ind.bearishColor) ind.bearishColor = 'rgba(242,54,69,0.5)';
    if (typeof ind.trailMarkEnabled !== 'boolean') ind.trailMarkEnabled = true;
    if (typeof ind.trailMarkStyle !== 'string' || !ind.trailMarkStyle) ind.trailMarkStyle = 'circle';
    if (typeof ind.trailMarkLocation !== 'string' || !ind.trailMarkLocation) ind.trailMarkLocation = 'absolute';
    if (typeof ind.showPanelLabel !== 'boolean') ind.showPanelLabel = false;

    const sec = document.createElement('div');
    sec.style.cssText = 'margin-top:6px;padding-top:8px;border-top:1px solid #363a45;';

    const makeLineRow = (
      labelText: string,
      styleKey: 'statisticalTrailingStopBull' | 'statisticalTrailingStopBear',
      fallbackColor: string,
    ) => {
      const style = getLineStyle(chart.config.panelState, styleKey, {
        color: fallbackColor,
        width: 1.7,
        dash: [],
      });
      const row = document.createElement('div');
      row.style.cssText = 'display:flex;justify-content:space-between;align-items:center;margin-bottom:8px;gap:8px;';
      const lbl = document.createElement('span');
      lbl.textContent = labelText;
      lbl.style.color = '#c0c4cc';
      const right = document.createElement('div');
      right.style.cssText = 'display:flex;align-items:center;gap:6px;';

      const modePicker = createLineModePicker(getDashMode(style.dash), (nextMode) => {
        chart.setIndicatorStyle(styleKey, { dash: toDash(nextMode) });
        chart.draw();
        onUpdate();
      });

      const color = document.createElement('input');
      color.type = 'color';
      color.value = toHexColor(style.color);
      color.style.cssText = 'width:28px;height:24px;padding:0;border:1px solid #363a45;border-radius:4px;background:#131722;cursor:pointer;';
      color.addEventListener('input', () => {
        chart.setIndicatorStyle(styleKey, { color: color.value });
        chart.draw();
        onUpdate();
      });

      const width = document.createElement('input');
      width.type = 'number';
      width.min = '1';
      width.max = '6';
      width.step = '0.5';
      width.value = String(style.width ?? 1.7);
      width.style.cssText = 'width:52px;background:#131722;color:white;border:1px solid #363a45;border-radius:4px;padding:3px 6px;text-align:right;font-size:12px;';
      width.addEventListener('change', () => {
        const nextWidth = Math.max(1, Math.min(6, Number(width.value) || 1.7));
        width.value = String(nextWidth);
        chart.setIndicatorStyle(styleKey, { width: nextWidth });
        chart.draw();
        onUpdate();
      });

      right.appendChild(modePicker);
      right.appendChild(color);
      right.appendChild(width);
      row.appendChild(lbl);
      row.appendChild(right);
      sec.appendChild(row);
    };

    const makeFillColorRow = (
      labelText: string,
      key: 'bullishColor' | 'bearishColor',
      fallbackColor: string,
    ) => {
      const row = document.createElement('div');
      row.style.cssText = 'display:flex;justify-content:space-between;align-items:center;margin-bottom:8px;gap:8px;';
      const lbl = document.createElement('span');
      lbl.textContent = labelText;
      lbl.style.color = '#c0c4cc';
      const color = document.createElement('input');
      color.type = 'color';
      color.value = toHexColor(String(ind[key] || fallbackColor));
      color.style.cssText = 'width:28px;height:24px;padding:0;border:1px solid #363a45;border-radius:4px;background:#131722;cursor:pointer;';
      color.addEventListener('input', () => {
        ind[key] = toRgba(color.value, 0.5);
        chart.draw();
        onUpdate();
      });
      row.appendChild(lbl);
      row.appendChild(color);
      sec.appendChild(row);
    };

    makeLineRow('Bullish Trail', 'statisticalTrailingStopBull', '#26a69a');
    makeLineRow('Bearish Trail', 'statisticalTrailingStopBear', '#ef5350');
    makeFillColorRow('Bullish Fill', 'bullishColor', 'rgba(8,153,129,0.5)');
    makeFillColorRow('Bearish Fill', 'bearishColor', 'rgba(242,54,69,0.5)');

    const markWrap = document.createElement('div');
    markWrap.style.cssText = 'margin-top:8px;padding-top:8px;border-top:1px dashed #363a45;display:flex;flex-direction:column;gap:8px;';

    const markToggle = document.createElement('label');
    markToggle.style.cssText = 'display:flex;align-items:center;justify-content:space-between;gap:8px;color:#c0c4cc;';
    markToggle.innerHTML = '<span>Trail Mark</span>';
    const markChk = document.createElement('input');
    markChk.type = 'checkbox';
    markChk.checked = Boolean(ind.trailMarkEnabled);
    markChk.addEventListener('change', () => {
      ind.trailMarkEnabled = markChk.checked;
      chart.draw();
      onUpdate();
    });
    markToggle.appendChild(markChk);
    markWrap.appendChild(markToggle);

    const makeSelectRow = (labelText: string, valueKey: 'trailMarkStyle' | 'trailMarkLocation', options: Array<{ value: string; label: string }>) => {
      const row = document.createElement('div');
      row.style.cssText = 'display:flex;align-items:center;justify-content:space-between;gap:8px;';
      const lbl = document.createElement('span');
      lbl.textContent = labelText;
      lbl.style.color = '#c0c4cc';
      const select = document.createElement('select');
      select.style.cssText = 'min-width:140px;height:26px;background:#131722;border:1px solid #363a45;border-radius:4px;color:white;font-size:12px;padding:0 6px;';
      select.innerHTML = options.map((item) => `<option value="${item.value}">${item.label}</option>`).join('');
      select.value = String(ind[valueKey] || options[0]?.value || '');
      select.addEventListener('change', () => {
        ind[valueKey] = select.value;
        chart.draw();
        onUpdate();
      });
      row.appendChild(lbl);
      row.appendChild(select);
      markWrap.appendChild(row);
    };

    makeSelectRow('모양', 'trailMarkStyle', [
      { value: 'arrowdown', label: '애로우다운' },
      { value: 'arrowup', label: '애로우업' },
      { value: 'circle', label: '서클' },
      { value: 'cross', label: '크로스' },
      { value: 'diamond', label: '다이아몬드' },
      { value: 'flag', label: '플래그' },
      { value: 'labeldown', label: '레이블다운' },
      { value: 'labelup', label: '레이블업' },
      { value: 'square', label: '스퀘어' },
      { value: 'triangledown', label: '트라이앵글다운' },
      { value: 'triangleup', label: '트라이앵글업' },
    ]);

    makeSelectRow('위치', 'trailMarkLocation', [
      { value: 'abovebar', label: '봉위' },
      { value: 'belowbar', label: '봉아래' },
      { value: 'top', label: '탑' },
      { value: 'bottom', label: '아래' },
      { value: 'absolute', label: '절대값' },
    ]);

    const panelLabelRow = document.createElement('label');
    panelLabelRow.style.cssText = 'display:flex;align-items:center;justify-content:space-between;gap:8px;color:#c0c4cc;';
    panelLabelRow.innerHTML = '<span>패널 레이블</span>';
    const panelLabelChk = document.createElement('input');
    panelLabelChk.type = 'checkbox';
    panelLabelChk.checked = Boolean(ind.showPanelLabel);
    panelLabelChk.addEventListener('change', () => {
      ind.showPanelLabel = panelLabelChk.checked;
      chart.draw();
      onUpdate();
    });
    panelLabelRow.appendChild(panelLabelChk);
    markWrap.appendChild(panelLabelRow);

    sec.appendChild(markWrap);
    popup.appendChild(sec);
  }

  if (popupKey === 'zeroLagMaTrendLevels') {
    if (typeof ind.showLevels !== 'boolean') ind.showLevels = true;
    if (typeof ind.upColor !== 'string' || !ind.upColor) ind.upColor = '#30d453';
    if (typeof ind.downColor !== 'string' || !ind.downColor) ind.downColor = '#4043f1';

    const sec = document.createElement('div');
    sec.style.cssText = 'margin-top:6px;padding-top:8px;border-top:1px solid #363a45;';

    const levelRow = document.createElement('div');
    levelRow.style.cssText = 'display:flex;justify-content:space-between;align-items:center;margin-bottom:8px;gap:8px;';
    const levelLabel = document.createElement('span');
    levelLabel.textContent = 'Trend Levels';
    levelLabel.style.color = '#c0c4cc';
    const levelSwitch = createSwitch(Boolean(ind.showLevels), (next) => {
      ind.showLevels = next;
      chart.draw();
      onUpdate();
    }).button;
    levelRow.appendChild(levelLabel);
    levelRow.appendChild(levelSwitch);
    sec.appendChild(levelRow);

    const makeColorRow = (labelText: string, key: 'upColor' | 'downColor') => {
      const row = document.createElement('div');
      row.style.cssText = 'display:flex;justify-content:space-between;align-items:center;margin-bottom:8px;gap:8px;';
      const lbl = document.createElement('span');
      lbl.textContent = labelText;
      lbl.style.color = '#c0c4cc';
      const color = document.createElement('input');
      color.type = 'color';
      color.value = toHexColor(String(ind[key]));
      color.style.cssText = 'width:28px;height:24px;padding:0;border:1px solid #363a45;border-radius:4px;background:#131722;cursor:pointer;';
      color.addEventListener('input', () => {
        ind[key] = color.value;
        chart.draw();
        onUpdate();
      });
      row.appendChild(lbl);
      row.appendChild(color);
      sec.appendChild(row);
    };

    makeColorRow('+ Color', 'upColor');
    makeColorRow('- Color', 'downColor');
    popup.appendChild(sec);
  }

  if (popupKey === 'volumeProfile') {
    if (!Number.isFinite(Number(ind.upOpacity))) ind.upOpacity = 45;
    if (!Number.isFinite(Number(ind.downOpacity))) ind.downOpacity = 45;
    if (!Number.isFinite(Number(ind.pocOpacity))) ind.pocOpacity = 95;

    const sec = document.createElement('div');
    sec.style.cssText = 'margin-top:10px;padding-top:10px;border-top:1px solid #363a45;';
    const ttl = document.createElement('div');
    ttl.textContent = '매물대 스타일';
    ttl.style.cssText = 'font-size:11px;color:#84898e;font-weight:700;margin-bottom:8px;';
    sec.appendChild(ttl);

    const makeRow = (labelText: string, styleKey: 'volumeProfileUp' | 'volumeProfileDown' | 'volumeProfilePoc', opacityKey: 'upOpacity' | 'downOpacity' | 'pocOpacity', fallbackColor: string) => {
      const style = getLineStyle(chart.config.panelState, styleKey, {
        color: fallbackColor,
        width: styleKey === 'volumeProfilePoc' ? 1.2 : 1,
        dash: styleKey === 'volumeProfilePoc' ? [4, 3] : [],
      });

      const row = document.createElement('div');
      row.style.cssText = 'display:grid;grid-template-columns:74px 34px 82px;align-items:center;gap:8px;margin-bottom:8px;';

      const lbl = document.createElement('span');
      lbl.textContent = labelText;
      lbl.style.cssText = 'color:#c0c4cc;';

      const color = document.createElement('input');
      color.type = 'color';
      color.value = toHexColor(style.color);
      color.style.cssText = 'width:28px;height:24px;padding:0;border:1px solid #363a45;border-radius:4px;background:#131722;cursor:pointer;';
      color.addEventListener('input', () => {
        chart.setIndicatorStyle(styleKey, { color: color.value });
        chart.draw();
        onUpdate();
      });

      const opacity = document.createElement('input');
      opacity.type = 'number';
      opacity.min = '0';
      opacity.max = '100';
      opacity.step = '1';
      opacity.value = String(Math.max(0, Math.min(100, Number(ind[opacityKey] ?? (opacityKey === 'pocOpacity' ? 95 : 45)) || 0)));
      opacity.style.cssText = 'width:82px;background:#131722;color:white;border:1px solid #363a45;border-radius:4px;padding:4px 6px;text-align:right;font-size:12px;box-sizing:border-box;';
      opacity.addEventListener('change', () => {
        const next = Math.max(0, Math.min(100, Number(opacity.value) || 0));
        ind[opacityKey] = next;
        opacity.value = String(next);
        chart.draw();
        onUpdate();
      });

      row.append(lbl, color, withTouchStepper(opacity));
      sec.appendChild(row);
    };

    makeRow('상승', 'volumeProfileUp', 'upOpacity', 'rgba(38,166,154,0.45)');
    makeRow('하락', 'volumeProfileDown', 'downOpacity', 'rgba(239,83,80,0.45)');
    makeRow('POC', 'volumeProfilePoc', 'pocOpacity', 'rgba(255,193,7,0.95)');

    popup.appendChild(sec);
  }

  if (popupKey === 'vpvr') {
    const defaults = {
      rowsLayout: 'number_of_rows',
      rowSize: 50,
      volumeMode: 'up_down',
      valueAreaVolume: 70,
      placement: 'right',
      widthPct: 22,
      showPoc: true,
      pocColor: '#ffc107',
      pocWidth: 1.2,
      pocLineStyle: 'dashed',
      showVahVal: true,
      vahValColor: '#8ab4ff',
      vahValWidth: 1,
      vahValLineStyle: 'dashed',
      showVaBackground: true,
      vaBgColor: '#3a5f94',
      vaBgOpacity: 18,
      upColor: '#26a69a',
      downColor: '#ef5350',
      upOpacity: 45,
      downOpacity: 45,
      totalColor: '#7f8aa3',
      totalOpacity: 40,
      deltaPosColor: '#26a69a',
      deltaNegColor: '#ef5350',
      deltaOpacity: 50,
      valuesVisible: false,
      valuesTextColor: '#cfd8ea',
    } as const;
    Object.entries(defaults).forEach(([k, v]) => {
      if (ind[k] == null || (typeof v === 'number' && !Number.isFinite(Number(ind[k])))) ind[k] = v;
    });

    const mkRow = () => {
      const row = document.createElement('div');
      row.style.cssText = 'display:flex;justify-content:space-between;align-items:center;gap:8px;margin-bottom:8px;';
      return row;
    };
    const mkLabel = (text: string) => {
      const lbl = document.createElement('span');
      lbl.textContent = text;
      lbl.style.cssText = 'color:#c0c4cc;';
      return lbl;
    };
    const mkNumberInput = (value: number, min: number, max: number, step = 1, width = 88) => {
      const inp = document.createElement('input');
      inp.type = 'number';
      inp.min = String(min);
      inp.max = String(max);
      inp.step = String(step);
      inp.value = String(value);
      inp.style.cssText = `width:${width}px;background:#131722;color:white;border:1px solid #363a45;border-radius:4px;padding:4px 6px;text-align:right;font-size:12px;box-sizing:border-box;`;
      return inp;
    };
    const mkSelect = (options: Array<{ value: string; label: string }>, value: string, width = 150) => {
      const sel = document.createElement('select');
      sel.style.cssText = `width:${width}px;background:#131722;color:white;border:1px solid #363a45;border-radius:4px;padding:4px 6px;font-size:12px;`;
      sel.innerHTML = options.map((o) => `<option value="${o.value}">${o.label}</option>`).join('');
      sel.value = value;
      return sel;
    };
    const mkSwitch = (value: boolean, onChange: (next: boolean) => void) => createSwitch(Boolean(value), (next) => {
      onChange(next);
      chart.draw();
      onUpdate();
    }).button;
    const mkSection = (title: string) => {
      const sec = document.createElement('div');
      sec.style.cssText = 'margin-top:10px;padding-top:10px;border-top:1px solid #363a45;';
      const ttl = document.createElement('div');
      ttl.textContent = title;
      ttl.style.cssText = 'font-size:11px;color:#84898e;font-weight:700;margin-bottom:8px;';
      sec.appendChild(ttl);
      popup.appendChild(sec);
      return sec;
    };
    const sync = () => { chart.draw(); onUpdate(); };

    const inputSec = mkSection('Inputs');
    const rowsLayoutRow = mkRow();
    rowsLayoutRow.appendChild(mkLabel('Rows Layout'));
    const rowsLayoutSel = mkSelect([
      { value: 'number_of_rows', label: 'Number of Rows' },
      { value: 'ticks_per_row', label: 'Ticks Per Row' },
    ], String(ind.rowsLayout ?? defaults.rowsLayout), 150);
    rowsLayoutSel.addEventListener('change', () => { ind.rowsLayout = rowsLayoutSel.value; sync(); });
    rowsLayoutRow.appendChild(rowsLayoutSel);
    inputSec.appendChild(rowsLayoutRow);

    const rowSizeRow = mkRow();
    rowSizeRow.appendChild(mkLabel('Row Size'));
    const rowSizeInp = mkNumberInput(Number(ind.rowSize ?? defaults.rowSize), 1, 500, 1, 90);
    rowSizeInp.addEventListener('change', () => {
      ind.rowSize = Math.max(1, Math.min(500, Math.floor(Number(rowSizeInp.value) || defaults.rowSize)));
      rowSizeInp.value = String(ind.rowSize);
      sync();
    });
    rowSizeRow.appendChild(withTouchStepper(rowSizeInp));
    inputSec.appendChild(rowSizeRow);

    const volumeModeRow = mkRow();
    volumeModeRow.appendChild(mkLabel('Volume'));
    const volumeModeSel = mkSelect([
      { value: 'total', label: 'Total' },
      { value: 'up_down', label: 'Up/Down' },
      { value: 'delta', label: 'Delta' },
    ], String(ind.volumeMode ?? defaults.volumeMode), 150);
    volumeModeSel.addEventListener('change', () => { ind.volumeMode = volumeModeSel.value; sync(); });
    volumeModeRow.appendChild(volumeModeSel);
    inputSec.appendChild(volumeModeRow);

    const vaVolRow = mkRow();
    vaVolRow.appendChild(mkLabel('Value Area Volume'));
    const vaVolInp = mkNumberInput(Number(ind.valueAreaVolume ?? defaults.valueAreaVolume), 1, 100, 1, 90);
    vaVolInp.addEventListener('change', () => {
      ind.valueAreaVolume = Math.max(1, Math.min(100, Number(vaVolInp.value) || defaults.valueAreaVolume));
      vaVolInp.value = String(ind.valueAreaVolume);
      sync();
    });
    vaVolRow.appendChild(withTouchStepper(vaVolInp));
    inputSec.appendChild(vaVolRow);

    const placementRow = mkRow();
    placementRow.appendChild(mkLabel('Placement'));
    const placementSel = mkSelect([
      { value: 'right', label: 'Right' },
      { value: 'left', label: 'Left' },
    ], String(ind.placement ?? defaults.placement), 120);
    placementSel.addEventListener('change', () => { ind.placement = placementSel.value; sync(); });
    placementRow.appendChild(placementSel);
    inputSec.appendChild(placementRow);

    const widthRow = mkRow();
    widthRow.appendChild(mkLabel('Width (% of box)'));
    const widthInp = mkNumberInput(Number(ind.widthPct ?? defaults.widthPct), 5, 45, 1, 90);
    widthInp.addEventListener('change', () => {
      ind.widthPct = Math.max(5, Math.min(45, Number(widthInp.value) || defaults.widthPct));
      widthInp.value = String(ind.widthPct);
      sync();
    });
    widthRow.appendChild(withTouchStepper(widthInp));
    inputSec.appendChild(widthRow);

    const styleSec = mkSection('Style');
    const makeLineStyleRows = (title: string, onKey: string, colorKey: string, widthKey: string, dashKey: string) => {
      const toggleRow = mkRow();
      toggleRow.appendChild(mkLabel(title));
      toggleRow.appendChild(mkSwitch(Boolean(ind[onKey]), (next) => { ind[onKey] = next; }));
      styleSec.appendChild(toggleRow);

      const row = mkRow();
      row.appendChild(mkLabel(`${title} Style`));
      const right = document.createElement('div');
      right.style.cssText = 'display:flex;align-items:center;gap:6px;';
      const color = document.createElement('input');
      color.type = 'color';
      color.value = toHexColor(String(ind[colorKey] ?? '#ffffff'));
      color.style.cssText = 'width:28px;height:24px;padding:0;border:1px solid #363a45;border-radius:4px;background:#131722;cursor:pointer;';
      color.addEventListener('input', () => { ind[colorKey] = color.value; sync(); });
      const width = mkNumberInput(Number(ind[widthKey] ?? 1), 0.5, 6, 0.5, 58);
      width.addEventListener('change', () => {
        ind[widthKey] = Math.max(0.5, Math.min(6, Number(width.value) || 1));
        width.value = String(ind[widthKey]);
        sync();
      });
      const dash = mkSelect([
        { value: 'solid', label: '실선' },
        { value: 'dashed', label: '대시' },
        { value: 'dotted', label: '점선' },
      ], String(ind[dashKey] ?? 'solid'), 74);
      dash.addEventListener('change', () => { ind[dashKey] = dash.value; sync(); });
      right.append(color, withTouchStepper(width), dash);
      row.appendChild(right);
      styleSec.appendChild(row);
    };
    makeLineStyleRows('POC', 'showPoc', 'pocColor', 'pocWidth', 'pocLineStyle');
    makeLineStyleRows('VAH/VAL', 'showVahVal', 'vahValColor', 'vahValWidth', 'vahValLineStyle');

    const vaBgToggleRow = mkRow();
    vaBgToggleRow.appendChild(mkLabel('Value Area 배경'));
    vaBgToggleRow.appendChild(mkSwitch(Boolean(ind.showVaBackground), (next) => { ind.showVaBackground = next; }));
    styleSec.appendChild(vaBgToggleRow);
    const vaBgRow = mkRow();
    vaBgRow.appendChild(mkLabel('VA 배경 색/투명도'));
    const vaBgRight = document.createElement('div');
    vaBgRight.style.cssText = 'display:flex;align-items:center;gap:6px;';
    const vaBgColor = document.createElement('input');
    vaBgColor.type = 'color';
    vaBgColor.value = toHexColor(String(ind.vaBgColor ?? defaults.vaBgColor));
    vaBgColor.style.cssText = 'width:28px;height:24px;padding:0;border:1px solid #363a45;border-radius:4px;background:#131722;cursor:pointer;';
    vaBgColor.addEventListener('input', () => { ind.vaBgColor = vaBgColor.value; sync(); });
    const vaBgOpacity = mkNumberInput(Number(ind.vaBgOpacity ?? defaults.vaBgOpacity), 0, 100, 1, 72);
    vaBgOpacity.addEventListener('change', () => {
      ind.vaBgOpacity = Math.max(0, Math.min(100, Number(vaBgOpacity.value) || defaults.vaBgOpacity));
      vaBgOpacity.value = String(ind.vaBgOpacity);
      sync();
    });
    vaBgRight.append(vaBgColor, withTouchStepper(vaBgOpacity));
    vaBgRow.appendChild(vaBgRight);
    styleSec.appendChild(vaBgRow);

    const histSec = mkSection('Histogram');
    const makeColorOpacityRow = (label: string, colorKey: string, opacityKey: string, fallbackColor: string, fallbackOpacity: number) => {
      const row = mkRow();
      row.appendChild(mkLabel(label));
      const right = document.createElement('div');
      right.style.cssText = 'display:flex;align-items:center;gap:6px;';
      const color = document.createElement('input');
      color.type = 'color';
      color.value = toHexColor(String(ind[colorKey] ?? fallbackColor));
      color.style.cssText = 'width:28px;height:24px;padding:0;border:1px solid #363a45;border-radius:4px;background:#131722;cursor:pointer;';
      color.addEventListener('input', () => { ind[colorKey] = color.value; sync(); });
      const opacity = mkNumberInput(Number(ind[opacityKey] ?? fallbackOpacity), 0, 100, 1, 72);
      opacity.addEventListener('change', () => {
        ind[opacityKey] = Math.max(0, Math.min(100, Number(opacity.value) || fallbackOpacity));
        opacity.value = String(ind[opacityKey]);
        sync();
      });
      right.append(color, withTouchStepper(opacity));
      row.appendChild(right);
      histSec.appendChild(row);
    };
    makeColorOpacityRow('Up Volume', 'upColor', 'upOpacity', '#26a69a', 45);
    makeColorOpacityRow('Down Volume', 'downColor', 'downOpacity', '#ef5350', 45);
    makeColorOpacityRow('Total Volume', 'totalColor', 'totalOpacity', '#7f8aa3', 40);
    makeColorOpacityRow('Delta +', 'deltaPosColor', 'deltaOpacity', '#26a69a', 50);
    makeColorOpacityRow('Delta -', 'deltaNegColor', 'deltaOpacity', '#ef5350', 50);

    const valuesSec = mkSection('Values');
    const valuesToggleRow = mkRow();
    valuesToggleRow.appendChild(mkLabel('값 표시'));
    valuesToggleRow.appendChild(mkSwitch(Boolean(ind.valuesVisible), (next) => { ind.valuesVisible = next; }));
    valuesSec.appendChild(valuesToggleRow);
    const valuesColorRow = mkRow();
    valuesColorRow.appendChild(mkLabel('텍스트 색상'));
    const valuesColor = document.createElement('input');
    valuesColor.type = 'color';
    valuesColor.value = toHexColor(String(ind.valuesTextColor ?? defaults.valuesTextColor));
    valuesColor.style.cssText = 'width:28px;height:24px;padding:0;border:1px solid #363a45;border-radius:4px;background:#131722;cursor:pointer;';
    valuesColor.addEventListener('input', () => { ind.valuesTextColor = valuesColor.value; sync(); });
    valuesColorRow.appendChild(valuesColor);
    valuesSec.appendChild(valuesColorRow);
  }

  // ── 볼린저밴드 전용 라인스타일 섹션 ────────────────────────────────────
  if (popupKey === 'bb') {
    const sec = document.createElement('div');
    sec.style.cssText = 'margin-top:10px;padding-top:10px;border-top:1px solid #363a45;';
    const ttl = document.createElement('div');
    ttl.textContent = '라인 스타일';
    ttl.style.cssText = 'font-size:11px;color:#84898e;font-weight:700;margin-bottom:8px;';
    sec.appendChild(ttl);

    const bbTargets: Array<{ key: string; label: string; defaultColor: string; defaultWidth: number; defaultDash: number[] }> = [
      { key: 'bbUpper',  label: '상단 밴드',  defaultColor: 'rgba(100,149,237,0.95)', defaultWidth: 1,   defaultDash: [] },
      { key: 'bbMiddle', label: '중간 밴드',  defaultColor: 'rgba(100,149,237,0.5)',  defaultWidth: 1,   defaultDash: [4,4] },
      { key: 'bbLower',  label: '하단 밴드',  defaultColor: 'rgba(100,149,237,0.95)', defaultWidth: 1,   defaultDash: [] },
    ];

    bbTargets.forEach(target => {
      const style = getLineStyle(chart.config.panelState, target.key, {
        color: target.defaultColor, width: target.defaultWidth, dash: target.defaultDash,
      });
      let visible = chart.isIndicatorLineVisible(target.key);

      const row = document.createElement('div');
      row.style.cssText = 'display:flex;align-items:center;justify-content:space-between;gap:8px;margin-bottom:8px;';
      const lbl = document.createElement('span');
      lbl.textContent = target.label;
      lbl.style.cssText = 'color:#84898e;min-width:70px;';
      row.appendChild(lbl);

      const right = document.createElement('div');
      right.style.cssText = 'display:flex;align-items:center;gap:6px;';

      // ON/OFF 토글
      const toggle = createSwitch(visible, (nextVisible) => {
        visible = nextVisible;
        chart.setIndicatorLineVisible(target.key, nextVisible);
        chart.draw(); onUpdate();
      }).button;

      // 색상
      const colorInp = document.createElement('input');
      colorInp.type = 'color';
      colorInp.value = toHexColor(style.color);
      colorInp.style.cssText = 'width:28px;height:20px;padding:0;border:none;background:none;cursor:pointer;';
      colorInp.addEventListener('input', () => {
        chart.setIndicatorStyle(target.key, { color: colorInp.value });
        chart.draw(); onUpdate();
      });

      // 굵기
      const widthInp = document.createElement('input');
      widthInp.type = 'number';
      widthInp.min = '1'; widthInp.max = '5'; widthInp.step = '0.5';
      widthInp.value = String(style.width ?? target.defaultWidth);
      widthInp.style.cssText = 'width:52px;background:#131722;color:white;border:1px solid #363a45;border-radius:4px;padding:3px 6px;text-align:right;font-size:12px;';
      widthInp.addEventListener('change', () => {
        const nextWidth = Math.max(1, Math.min(5, Number(widthInp.value) || target.defaultWidth));
        widthInp.value = String(nextWidth);
        chart.setIndicatorStyle(target.key, { width: nextWidth });
        chart.draw(); onUpdate();
      });

      // 라인 종류
      const modePicker = createLineModePicker(getDashMode(style.dash), (nextMode) => {
        chart.setIndicatorStyle(target.key, { dash: toDash(nextMode) });
        chart.draw(); onUpdate();
      });

      right.append(toggle, modePicker, colorInp, widthInp);
      row.appendChild(right);
      sec.appendChild(row);
    });

    popup.appendChild(sec);
  }

  const styleTargets = (popupKey === 'supertrend' || popupKey === 'statisticalTrailingStop' || popupKey === 'volumeProfile' || popupKey === 'vpvr')
    ? []
    : (INDICATOR_STYLE_TARGETS[popupKey] ?? []);
  if (styleTargets.length) {
    const sec = document.createElement('div');
    sec.style.cssText = 'margin-top:10px;padding-top:10px;border-top:1px solid #363a45;';
    const ttl = document.createElement('div');
    ttl.textContent = '라인 스타일';
    ttl.style.cssText = 'font-size:11px;color:#84898e;font-weight:700;margin-bottom:8px;';
    sec.appendChild(ttl);

    styleTargets.forEach(target => {
      const style = getLineStyle(chart.config.panelState, target.key, { color: '#ffffff', width: 1.5, dash: [] });
      let visible = chart.isIndicatorLineVisible(target.key);
      const row = document.createElement('div');
      row.style.cssText = 'display:flex;align-items:center;justify-content:space-between;gap:8px;margin-bottom:8px;';
      row.innerHTML = `<span style="color:#84898e;">${target.label}</span>`;

      const right = document.createElement('div');
      right.style.cssText = 'display:flex;align-items:center;gap:6px;';

      const toggle = createSwitch(visible, (nextVisible) => {
        visible = nextVisible;
        chart.setIndicatorLineVisible(target.key, nextVisible);
        chart.draw();
        onUpdate();
      }).button;

      const color = document.createElement('input');
      color.type = 'color';
      color.value = toHexColor(style.color);
      color.style.cssText = 'width:28px;height:20px;padding:0;border:none;background:none;cursor:pointer;';
      color.addEventListener('input', () => {
        chart.setIndicatorStyle(target.key, { color: color.value });
        chart.draw();
        onUpdate();
      });

      const width = document.createElement('input');
      width.type = 'number';
      width.min = '1';
      width.max = '5';
      width.step = '0.5';
      width.value = String(style.width);
      width.style.cssText = 'width:52px;background:#131722;color:white;border:1px solid #363a45;border-radius:4px;padding:3px 6px;text-align:right;font-size:12px;';
      width.addEventListener('change', () => {
        const nextWidth = Math.max(1, Math.min(5, Number(width.value) || 1));
        chart.setIndicatorStyle(target.key, { width: nextWidth });
        chart.draw();
        onUpdate();
      });

      right.appendChild(toggle);
      right.appendChild(color);
      right.appendChild(width);
      row.appendChild(right);
      sec.appendChild(row);
    });

    popup.appendChild(sec);
  }

  // 표시 토글
  const tRow = document.createElement('div');
  tRow.style.cssText = 'display:flex;justify-content:space-between;align-items:center;margin-top:8px;padding-top:8px;border-top:1px solid #363a45;';
  tRow.innerHTML = '<span style="color:#84898e;">표시</span>';
  const tBtn = createSwitch(Boolean(ind.show), (nextVisible) => {
    ind.show = nextVisible;
    chart.draw(); onUpdate();
  }).button;
  tRow.appendChild(tBtn); popup.appendChild(tRow);
  appendPopup();

  const positionPopup = () => {
    const margin = 8;
    const anchorRect = anchor.getBoundingClientRect();
    const popupRect = popup.getBoundingClientRect();
    const vw = window.innerWidth;
    const vh = window.innerHeight;

    let left = anchorRect.left;
    if (left + popupRect.width + margin > vw) left = vw - popupRect.width - margin;
    left = Math.max(margin, left);

    const belowTop = anchorRect.bottom + 6;
    const aboveTop = anchorRect.top - popupRect.height - 6;
    let top = belowTop;
    if (belowTop + popupRect.height + margin > vh && aboveTop >= margin) {
      top = aboveTop;
    } else if (belowTop + popupRect.height + margin > vh) {
      top = vh - popupRect.height - margin;
    }
    top = Math.max(margin, top);

    popup.style.left = `${Math.round(left)}px`;
    popup.style.top = `${Math.round(top)}px`;
  };
  positionPopup();

  const outsideClick = (e: MouseEvent) => {
    if (!popup.contains(e.target as Node) && e.target !== anchor) {
      popup.remove(); document.removeEventListener('click', outsideClick);
    }
  };
  setTimeout(() => document.addEventListener('click', outsideClick), 80);
}






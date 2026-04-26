import { INDICATOR_STYLE_TARGETS, createDefaultPanelState, getLineStyle } from '../indicator-panel-module';
import { INDICATOR_CATALOG } from '../catalog/indicators';
import { CUSTOM_SYMBOLS, SYMBOL_CATALOG, createSymbolIconElement, getAllSymbolCatalog, getSymbolIconUrl, persistSymbolRegistry, type SymbolCatalogItem } from '../catalog/symbols';
import { TIMEZONE_OPTIONS, UTC_OFFSET_OPTIONS, type TimezoneOption } from '../catalog/time';
import { buildStrategyDefinition, type StrategyDefinition, type StrategyLang } from '../strategy/strategy-service';

function createModal(title: string) {
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
      header.style.padding = '14px 14px';
      body.style.padding = '12px 14px';
    } else {
      overlay.style.alignItems = 'center';
      overlay.style.justifyContent = 'center';
      modal.style.minWidth = '460px';
      modal.style.maxWidth = '640px';
      modal.style.width = '90vw';
      modal.style.maxHeight = '80vh';
      modal.style.height = '';
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
  const { body, close } = createModal('전략시그널 관리');

  const info = document.createElement('div');
  info.style.cssText = 'font-size:12px;color:#9aa0ab;line-height:1.5;margin-bottom:12px;';
  info.textContent = '관리자 등록 전략(JS/Pine)을 선택 적용합니다. Pine은 저장 시 JS로 변환되어 Worker에서 실행됩니다.';
  body.appendChild(info);

  const activeWrap = document.createElement('div');
  activeWrap.style.cssText = 'display:flex;gap:8px;align-items:center;margin-bottom:10px;';
  const activeLabel = document.createElement('span');
  activeLabel.textContent = '적용 전략';
  activeLabel.style.cssText = 'font-size:12px;color:#c0c4cc;min-width:56px;';
  const activeSel = document.createElement('select');
  activeSel.style.cssText = 'flex:1;background:#131722;border:1px solid #363a45;color:white;border-radius:6px;padding:8px;font-size:12px;';
  activeWrap.appendChild(activeLabel);
  activeWrap.appendChild(activeSel);
  body.appendChild(activeWrap);

  const listWrap = document.createElement('div');
  listWrap.style.cssText = 'display:flex;flex-direction:column;gap:8px;max-height:170px;overflow-y:auto;padding-right:2px;margin-bottom:12px;';
  body.appendChild(listWrap);

  const form = document.createElement('div');
  form.style.cssText = 'display:grid;grid-template-columns:1fr 1fr;gap:8px;margin-top:6px;padding-top:12px;border-top:1px solid #2a2e3e;';
  body.appendChild(form);

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

  const err = document.createElement('div');
  err.style.cssText = 'color:#ef5350;font-size:11px;min-height:16px;margin-top:8px;';
  body.appendChild(err);

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
    cancelEdit.style.display = 'none';
  };

  const render = () => {
    const strategies = chart.getStrategies() as StrategyDefinition[];
    const activeId = chart.getActiveStrategyId();

    activeSel.innerHTML = '<option value="">(없음)</option>';
    strategies.forEach((s) => {
      const opt = document.createElement('option');
      opt.value = s.id;
      opt.textContent = `${s.name} [${s.language.toUpperCase()} v${s.version}]`;
      if (s.id === activeId) opt.selected = true;
      activeSel.appendChild(opt);
    });

    listWrap.innerHTML = '';
    strategies.forEach((s) => {
      const row = document.createElement('div');
      row.style.cssText = 'display:flex;align-items:center;justify-content:space-between;gap:8px;background:#131722;border:1px solid #2a2e3e;border-radius:6px;padding:8px 10px;';
      row.innerHTML = `<div style="min-width:0;">
        <div style="font-size:12px;color:white;font-weight:700;white-space:nowrap;overflow:hidden;text-overflow:ellipsis;">${s.name}</div>
        <div style="font-size:11px;color:#9aa0ab;white-space:nowrap;overflow:hidden;text-overflow:ellipsis;">${s.description || '-'} · ${s.language.toUpperCase()} · v${s.version}</div>
      </div>`;

      const right = document.createElement('div');
      right.style.cssText = 'display:flex;align-items:center;gap:6px;flex-shrink:0;';
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
        cancelEdit.style.display = 'inline-block';
        err.textContent = '';
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
      right.appendChild(sourceBtn);
      right.appendChild(editBtn);
      right.appendChild(delBtn);
      row.appendChild(right);
      listWrap.appendChild(row);
    });
  };

  activeSel.addEventListener('change', () => {
    chart.setActiveStrategy(activeSel.value || null);
    onApply();
  });
  closeBtn.addEventListener('click', close);
  cancelEdit.addEventListener('click', () => {
    err.textContent = '';
    resetForm();
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
      render();
    } catch (error) {
      err.textContent = error instanceof Error ? error.message : String(error);
    }
  });

  render();
}

export function openChartSettingsModal(chart: any, onApply: () => void, onSymbolVisualUpdate: () => void) {
  const { body } = createModal('차트 설정');
  const row = document.createElement('div');
  row.style.cssText = 'display:flex;justify-content:space-between;align-items:center;gap:12px;';

  const label = document.createElement('div');
  label.innerHTML = '<div style="font-size:13px;font-weight:700;">최신 캔들 우측 여백</div><div style="font-size:11px;color:#84898e;margin-top:2px;">마지막 캔들과 Y축 사이 공간(캔들 폭 단위)</div>';

  const controls = document.createElement('div');
  controls.style.cssText = 'display:flex;align-items:center;gap:8px;';

  const slider = document.createElement('input');
  slider.type = 'range';
  slider.min = '0';
  slider.max = '40';
  slider.step = '1';
  slider.value = String(chart.config.layout.rightGapBars ?? 1);

  const number = document.createElement('input');
  number.type = 'number';
  number.min = '0';
  number.max = '40';
  number.step = '1';
  number.value = String(chart.config.layout.rightGapBars ?? 1);
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
  const { body, close } = createModal(`심볼 관리 (${chart.config.symbol})`);

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
  listWrap.style.cssText = 'margin-top:12px;display:flex;flex-direction:column;gap:8px;max-height:300px;overflow-y:auto;padding-right:2px;';
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
  const { body, close } = createModal('심볼 검색 / 선택');

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
  si.textContent = '??';
  si.style.cssText = 'position:absolute;left:10px;top:50%;transform:translateY(-50%);font-size:14px;';
  searchWrap.appendChild(si); searchWrap.appendChild(inp);
  body.appendChild(searchWrap);

  const listWrap = document.createElement('div');
  body.appendChild(listWrap);

  const render = (q: string) => {
    listWrap.innerHTML = '';
    for (const [cat, items] of Object.entries(getAllSymbolCatalog())) {
      const filtered = items.filter(it =>
        !q || it.id.toLowerCase().includes(q.toLowerCase()) || it.desc.toLowerCase().includes(q.toLowerCase())
      );
      if (!filtered.length) continue;
      const catEl = document.createElement('div');
      catEl.textContent = cat;
      catEl.style.cssText = 'font-size:11px;color:#84898e;font-weight:700;letter-spacing:1px;margin:12px 0 6px;text-transform:uppercase;';
      listWrap.appendChild(catEl);
      filtered.forEach(item => {
            const row = document.createElement('div');
        const active = item.id === chart.config.symbol;
        row.style.cssText = `display:flex;align-items:center;justify-content:space-between;
          padding:10px 12px;border-radius:6px;cursor:pointer;margin-bottom:3px;
          background:${active ? 'rgba(41,98,255,0.15)' : 'transparent'};
          border:1px solid ${active ? '#2962ff' : 'transparent'};transition:background 0.15s;`;

        const left = document.createElement('div');
        left.style.cssText = 'display:flex;align-items:center;gap:10px;';
        const resolvedIconUrl = getSymbolIconUrl(item.id) ?? item.iconUrl;
        left.appendChild(createSymbolIconElement(item.id, resolvedIconUrl));

        const textWrap = document.createElement('div');
        textWrap.innerHTML = `<span style="font-size:14px;font-weight:700;">${item.label}</span>
          <span style="font-size:12px;color:#84898e;margin-left:10px;">${item.desc}</span>`;
        left.appendChild(textWrap);

        row.appendChild(left);
        if (active) {
          const check = document.createElement('span');
          check.textContent = '?';
          check.style.cssText = 'color:#2962ff;font-size:12px;';
          row.appendChild(check);
        }
        row.addEventListener('mouseenter', () => { if (!active) row.style.background = 'rgba(255,255,255,0.05)'; });
        row.addEventListener('mouseleave', () => { if (!active) row.style.background = 'transparent'; });
        row.addEventListener('click', () => {
          chart.config.symbol = item.id;
          symLabel.textContent = item.id;
          const resolvedIconUrl = getSymbolIconUrl(item.id) ?? item.iconUrl;
          const freshIcon = createSymbolIconElement(item.id, resolvedIconUrl);
          symIcon.innerHTML = '';
          symIcon.append(...Array.from(freshIcon.childNodes));
          onSelect(item.id); close();
        });
        listWrap.appendChild(row);
      });
    }
    if (!listWrap.children.length)
      listWrap.innerHTML = '<div style="text-align:center;color:#84898e;padding:30px;">검색 결과가 없습니다</div>';
  };

  render('');
  inp.addEventListener('input', () => render(inp.value));
  inp.focus();
}

// -----------------------------------------------------------------------------
// 지표 선택 모달
// -----------------------------------------------------------------------------

export function openIndicatorModal(chart: any, refresh: () => void) {
  const defaultPanelRatios = createDefaultPanelState().panelRatios;
  const { body } = createModal('지표 설정');

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
  const si = document.createElement('span'); si.textContent = '??';
  si.style.cssText = 'position:absolute;left:10px;top:50%;transform:translateY(-50%);font-size:14px;';
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
        const isOn = (chart.config.indicators as any)[ind.id]?.show ?? false;
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
  inp.focus();
}

export function openSettingsPopup(anchor: HTMLElement, chart: any, key: string, onUpdate: () => void) {
  document.querySelectorAll('.ind-popup').forEach(e => e.remove());
  const ind = (chart.config.indicators as any)[key];
  if (!ind) return;

  const popup = document.createElement('div');
  popup.className = 'ind-popup';
  const rect = anchor.getBoundingClientRect();
  popup.style.cssText = `position:fixed;top:${rect.bottom + 6}px;left:${rect.left}px;
    background:#1c2030;border:1px solid #363a45;border-radius:8px;padding:14px 16px;
    z-index:9999;font-family:'Segoe UI',Arial,sans-serif;font-size:12px;color:white;
    min-width:210px;box-shadow:0 8px 32px rgba(0,0,0,0.5);`;

  const hdr = document.createElement('div');
  hdr.style.cssText = 'font-weight:700;margin-bottom:12px;font-size:13px;display:flex;justify-content:space-between;';
  const headerTitle = key === 'supertrend' ? 'SUPER - SUPERTREND' : key.toUpperCase();
  hdr.innerHTML = `<span>${headerTitle}</span>`;
  const xb = document.createElement('button');
  xb.textContent = '×';
  xb.style.cssText = 'background:none;border:none;color:#84898e;cursor:pointer;font-size:14px;';
  xb.addEventListener('click', () => popup.remove());
  hdr.appendChild(xb); popup.appendChild(hdr);

  const FIELDS: Record<string, string[]> = {
    maShort: ['value'], maLong: ['value'], ma60: ['value'], ma120: ['value'], ma200: ['value'], bb: ['period','stdDev'],
    supertrend: ['period', 'factor'],
    rsi: ['period'], dmi: ['period'], macd: ['fast','slow','signal'],
    stochF: ['kPeriod','dPeriod'], stochS: ['kPeriod','dPeriod'],
    cci: ['period'], ichimoku: ['tenkan','kijun','senkou'],
    envelope: ['period','pct'], vwap: [], obv: [], volume: [],
  };
  const LABELS: Record<string, string> = {
    value: '값', period: '기간', stdDev: '표준편차',
    factor: 'Factor',
    fast: 'Fast', slow: 'Slow', signal: 'Signal',
    kPeriod: 'K 기간', dPeriod: 'D 기간',
    tenkan: '전환선', kijun: '기준선', senkou: '선행스팬 B', pct: '편차 (%)',
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

  (FIELDS[key] || []).forEach(field => {
    const row = document.createElement('div');
    row.style.cssText = 'display:flex;justify-content:space-between;align-items:center;margin-bottom:8px;';
    const lbl = document.createElement('span');
    lbl.textContent = key === 'supertrend' && field === 'period' ? 'ATR Length' : (LABELS[field] || field);
    lbl.style.color = '#84898e';
    const inp = document.createElement('input');
    inp.type = 'number'; inp.value = ind[field] ?? '';
    inp.style.cssText = 'width:64px;background:#131722;color:white;border:1px solid #363a45;border-radius:4px;padding:3px 7px;text-align:right;font-size:12px;';
    inp.addEventListener('change', () => {
      ind[field] = Number(inp.value);
      chart.draw(); onUpdate();
    });
    row.appendChild(lbl); row.appendChild(inp); popup.appendChild(row);
  });

  if (key === 'dmi') {
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

  if (key === 'supertrend') {
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

      const mode = document.createElement('select');
      mode.style.cssText = 'height:24px;background:#131722;border:1px solid #363a45;border-radius:4px;color:white;font-size:12px;padding:0 6px;';
      mode.innerHTML = '<option value="solid">실선</option><option value="dashed">대시</option><option value="dotted">도트</option>';
      mode.value = getDashMode(style.dash);
      mode.addEventListener('change', () => {
        chart.setIndicatorStyle(styleKey, { dash: toDash(mode.value as 'solid' | 'dashed' | 'dotted') });
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
      right.appendChild(mode);
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

  const styleTargets = key === 'supertrend' ? [] : (INDICATOR_STYLE_TARGETS[key] ?? []);
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

      const toggle = document.createElement('button');
      toggle.textContent = visible ? 'ON' : 'OFF';
      toggle.style.cssText = `padding:2px 7px;border:none;border-radius:4px;cursor:pointer;
        font-size:10px;font-weight:700;background:${visible ? '#26a69a' : '#555'};color:#fff;`;
      toggle.addEventListener('click', () => {
        visible = !visible;
        chart.setIndicatorLineVisible(target.key, visible);
        toggle.textContent = visible ? 'ON' : 'OFF';
        toggle.style.background = visible ? '#26a69a' : '#555';
        chart.draw();
        onUpdate();
      });

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
  const tBtn = document.createElement('button');
  tBtn.textContent = ind.show ? 'ON' : 'OFF';
  tBtn.style.cssText = `padding:3px 10px;border-radius:4px;border:none;cursor:pointer;font-size:11px;font-weight:700;
    background:${ind.show ? '#26a69a' : '#ef5350'};color:white;`;
  tBtn.addEventListener('click', () => {
    ind.show = !ind.show;
    tBtn.textContent = ind.show ? 'ON' : 'OFF';
    tBtn.style.background = ind.show ? '#26a69a' : '#ef5350';
    chart.draw(); onUpdate();
  });
  tRow.appendChild(tBtn); popup.appendChild(tRow);
  document.body.appendChild(popup);

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






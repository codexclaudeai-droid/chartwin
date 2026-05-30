'use client';

import { useMemo, useState } from 'react';
import {
  CUSTOM_SYMBOLS,
  SYMBOL_CATALOG,
  persistSymbolRegistry,
} from '../../src/catalog/symbols.ts';

type ManagedSymbolSource = 'builtin' | 'custom';

type ManagedSymbolItem = {
  id: string;
  label: string;
  desc: string;
  iconUrl?: string;
  category?: string;
};

type ManagedSymbolRef = {
  source: ManagedSymbolSource;
  category: string;
  item: ManagedSymbolItem;
};

type EditingSymbolKey = {
  source: ManagedSymbolSource;
  category: string;
  id: string;
} | null;

type SymbolFormState = {
  id: string;
  label: string;
  category: string;
  desc: string;
  iconUrl: string;
};

const EMPTY_FORM: SymbolFormState = {
  id: '',
  label: '',
  category: '',
  desc: '',
  iconUrl: '',
};

export function AdminSymbolsPanel() {
  const [query, setQuery] = useState('');
  const [form, setForm] = useState<SymbolFormState>(EMPTY_FORM);
  const [editing, setEditing] = useState<EditingSymbolKey>(null);
  const [message, setMessage] = useState('종목 설정을 불러왔습니다.');
  const [version, setVersion] = useState(0);

  const symbols = useMemo(() => listManagedSymbols(), [version]);
  const filteredSymbols = useMemo(() => {
    const needle = query.trim().toLowerCase();
    if (!needle) return symbols;
    return symbols.filter((symbol) => [
      symbol.item.id,
      symbol.item.label,
      symbol.item.desc,
      symbol.category,
      symbol.source,
    ].some((value) => value.toLowerCase().includes(needle)));
  }, [query, symbols]);

  const customCount = symbols.filter((symbol) => symbol.source === 'custom').length;
  const builtinCount = symbols.length - customCount;

  function updateForm(key: keyof SymbolFormState, value: string) {
    setForm((current) => ({ ...current, [key]: value }));
  }

  function resetForm(nextMessage?: string) {
    setEditing(null);
    setForm(EMPTY_FORM);
    if (nextMessage) setMessage(nextMessage);
  }

  function startEdit(symbol: ManagedSymbolRef) {
    setEditing({
      source: symbol.source,
      category: symbol.category,
      id: symbol.item.id,
    });
    setForm({
      id: symbol.item.id,
      label: symbol.item.label,
      category: symbol.category,
      desc: symbol.item.desc,
      iconUrl: symbol.item.iconUrl ?? '',
    });
    setMessage(`${symbol.item.id} 종목을 편집 중입니다.`);
  }

  function saveSymbol() {
    const id = form.id.trim().toUpperCase();
    const category = form.category.trim() || '기타';
    const label = form.label.trim() || id;
    const desc = form.desc.trim() || label;
    const iconUrl = form.iconUrl.trim();

    if (!id) {
      setMessage('티커 ID를 입력해주세요.');
      return;
    }
    if (!/^[A-Z0-9._-]{2,20}$/.test(id)) {
      setMessage('티커 ID는 영문, 숫자, ._- 조합 2~20자만 사용할 수 있습니다.');
      return;
    }
    if (hasDuplicateSymbolId(id, editing)) {
      setMessage('이미 등록된 티커 ID입니다.');
      return;
    }

    if (editing) {
      const target = findManagedSymbol(editing);
      if (!target) {
        resetForm('편집 중인 종목을 찾을 수 없습니다. 다시 선택해주세요.');
        return;
      }

      target.item.id = id;
      target.item.label = label;
      target.item.desc = desc;
      target.item.iconUrl = iconUrl || undefined;

      if (target.source === 'custom') {
        target.item.category = category;
      }
      if (target.category !== category) {
        moveSymbolToCategory(target, category);
      }
      persistSymbolRegistry();
      setVersion((current) => current + 1);
      resetForm(`${id} 종목을 수정했습니다.`);
      return;
    }

    CUSTOM_SYMBOLS.push({
      id,
      label,
      category,
      desc,
      iconUrl: iconUrl || undefined,
    });
    persistSymbolRegistry();
    setVersion((current) => current + 1);
    resetForm(`${id} 종목을 추가했습니다.`);
  }

  function deleteSymbol(symbol: ManagedSymbolRef) {
    removeManagedSymbol(symbol);
    persistSymbolRegistry();
    setVersion((current) => current + 1);
    if (editing?.source === symbol.source && editing.id === symbol.item.id) {
      resetForm(`${symbol.item.id} 종목을 삭제했습니다.`);
      return;
    }
    setMessage(`${symbol.item.id} 종목을 삭제했습니다.`);
  }

  return (
    <section id="admin-symbols" className="card admin-symbols-panel">
      <div className="admin-symbols-header">
        <div>
          <h2>종목관리</h2>
          <p>TC Chart에서 선택할 종목, 티커, 카테고리, 아이콘 URL을 관리자 화면에서 관리합니다.</p>
        </div>
        <button className="button secondary" type="button" onClick={() => setVersion((current) => current + 1)}>
          새로고침
        </button>
      </div>

      <p className="notice compact">{message}</p>

      <div className="admin-symbols-summary" aria-label="종목관리 요약">
        <div>
          <span>전체 종목</span>
          <strong>{symbols.length}</strong>
        </div>
        <div>
          <span>기본 종목</span>
          <strong>{builtinCount}</strong>
        </div>
        <div>
          <span>커스텀 종목</span>
          <strong>{customCount}</strong>
        </div>
      </div>

      <div className="admin-symbols-editor">
        <div className="admin-symbols-form">
          <label>
            <span>티커 ID</span>
            <input
              value={form.id}
              onChange={(event) => updateForm('id', event.target.value)}
              placeholder="예: BTCUSDT"
            />
          </label>
          <label>
            <span>표시명</span>
            <input
              value={form.label}
              onChange={(event) => updateForm('label', event.target.value)}
              placeholder="예: Bitcoin / USDT"
            />
          </label>
          <label>
            <span>카테고리</span>
            <input
              value={form.category}
              onChange={(event) => updateForm('category', event.target.value)}
              placeholder="예: crypto"
            />
          </label>
          <label>
            <span>아이콘 URL</span>
            <input
              value={form.iconUrl}
              onChange={(event) => updateForm('iconUrl', event.target.value)}
              placeholder="https://..."
            />
          </label>
          <label className="admin-symbols-form-wide">
            <span>설명</span>
            <input
              value={form.desc}
              onChange={(event) => updateForm('desc', event.target.value)}
              placeholder="차트 종목 선택창에 표시할 설명"
            />
          </label>
          <div className="admin-symbols-form-actions">
            {editing && (
              <button className="button secondary" type="button" onClick={() => resetForm('편집을 취소했습니다.')}>
                편집 취소
              </button>
            )}
            <button className="button" type="button" onClick={saveSymbol}>
              {editing ? '종목 수정' : '종목 추가'}
            </button>
          </div>
        </div>

        <div className="admin-symbols-list">
          <label className="admin-symbols-search">
            <span>종목 검색</span>
            <input
              value={query}
              onChange={(event) => setQuery(event.target.value)}
              placeholder="티커, 표시명, 설명, 카테고리 검색"
            />
          </label>

          <div className="table-wrap admin-symbols-table-wrap">
            <table className="table admin-symbols-table">
              <thead>
                <tr>
                  <th>종목</th>
                  <th>카테고리</th>
                  <th>구분</th>
                  <th>관리</th>
                </tr>
              </thead>
              <tbody>
                {filteredSymbols.map((symbol) => (
                  <tr key={`${symbol.source}:${symbol.category}:${symbol.item.id}`}>
                    <td>
                      <div className="admin-symbols-item">
                        <span className="admin-symbols-icon" aria-hidden={!symbol.item.iconUrl}>
                          {symbol.item.iconUrl ? (
                            <img src={symbol.item.iconUrl} alt={symbol.item.label} />
                          ) : (
                            <span className="admin-symbols-icon-fallback">{symbol.item.id.slice(0, 1)}</span>
                          )}
                        </span>
                        <span className="admin-symbols-copy">
                          <strong>{symbol.item.id}</strong>
                          <span>{symbol.item.label}</span>
                          <small>{symbol.item.desc}</small>
                        </span>
                      </div>
                    </td>
                    <td>{symbol.category}</td>
                    <td>
                      <span className={`badge ${symbol.source === 'builtin' ? 'admin-symbols-builtin' : 'admin-symbols-custom'}`}>
                        {symbol.source === 'builtin' ? '기본' : '커스텀'}
                      </span>
                    </td>
                    <td>
                      <div className="admin-symbols-row-actions">
                        <button className="button secondary" type="button" onClick={() => startEdit(symbol)}>
                          수정
                        </button>
                        <button className="button danger" type="button" onClick={() => deleteSymbol(symbol)}>
                          삭제
                        </button>
                      </div>
                    </td>
                  </tr>
                ))}
                {!filteredSymbols.length && (
                  <tr>
                    <td colSpan={4}>검색 조건에 맞는 종목이 없습니다.</td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        </div>
      </div>
    </section>
  );
}

function listManagedSymbols(): ManagedSymbolRef[] {
  const rows: ManagedSymbolRef[] = [];
  Object.entries(SYMBOL_CATALOG).forEach(([category, items]) => {
    items.forEach((item) => {
      rows.push({
        source: 'builtin',
        category,
        item,
      });
    });
  });
  CUSTOM_SYMBOLS.forEach((item) => {
    rows.push({
      source: 'custom',
      category: item.category,
      item,
    });
  });
  return rows;
}

function findManagedSymbol(key: Exclude<EditingSymbolKey, null>): ManagedSymbolRef | null {
  if (key.source === 'custom') {
    const item = CUSTOM_SYMBOLS.find((symbol) => symbol.id === key.id && symbol.category === key.category);
    return item ? { source: 'custom', category: item.category, item } : null;
  }

  const item = SYMBOL_CATALOG[key.category]?.find((symbol) => symbol.id === key.id);
  return item ? { source: 'builtin', category: key.category, item } : null;
}

function hasDuplicateSymbolId(id: string, editing: EditingSymbolKey): boolean {
  return listManagedSymbols().some((symbol) => {
    if (
      editing
      && symbol.source === editing.source
      && symbol.category === editing.category
      && symbol.item.id === editing.id
    ) {
      return false;
    }
    return symbol.item.id.toUpperCase() === id;
  });
}

function moveSymbolToCategory(symbol: ManagedSymbolRef, nextCategory: string) {
  removeManagedSymbol(symbol);
  if (symbol.source === 'custom') {
    CUSTOM_SYMBOLS.push({
      ...symbol.item,
      category: nextCategory,
    });
    return;
  }

  SYMBOL_CATALOG[nextCategory] ??= [];
  SYMBOL_CATALOG[nextCategory].push({
    id: symbol.item.id,
    label: symbol.item.label,
    desc: symbol.item.desc,
    iconUrl: symbol.item.iconUrl,
  });
}

function removeManagedSymbol(symbol: ManagedSymbolRef) {
  if (symbol.source === 'custom') {
    const index = CUSTOM_SYMBOLS.findIndex((item) =>
      item === symbol.item || (item.id === symbol.item.id && item.category === symbol.category),
    );
    if (index >= 0) CUSTOM_SYMBOLS.splice(index, 1);
    return;
  }

  const group = SYMBOL_CATALOG[symbol.category] ?? [];
  const index = group.findIndex((item) => item.id === symbol.item.id);
  if (index >= 0) group.splice(index, 1);
  if (!group.length) delete SYMBOL_CATALOG[symbol.category];
}

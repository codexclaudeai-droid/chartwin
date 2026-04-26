type BindGlobalShortcutsArgs = {
  onToggleFullscreen: () => void;
  onSaveScreenshot: () => void;
};

export function bindGlobalShortcuts({
  onToggleFullscreen,
  onSaveScreenshot,
}: BindGlobalShortcutsArgs): () => void {
  const onKeyDown = (e: KeyboardEvent) => {
    if (e.key === 'f' || e.key === 'F') {
      onToggleFullscreen();
    }
    if ((e.ctrlKey || e.metaKey) && e.key === 's') {
      e.preventDefault();
      onSaveScreenshot();
    }
  };

  document.addEventListener('keydown', onKeyDown);
  return () => {
    document.removeEventListener('keydown', onKeyDown);
  };
}

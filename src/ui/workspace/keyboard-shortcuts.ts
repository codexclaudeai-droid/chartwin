type BindGlobalShortcutsArgs = {
  onToggleFullscreen: () => void;
  onSaveScreenshot: () => void;
  onPanLeft: () => void;
  onPanRight: () => void;
};

export function bindGlobalShortcuts({
  onToggleFullscreen,
  onSaveScreenshot,
  onPanLeft,
  onPanRight,
}: BindGlobalShortcutsArgs): () => void {
  const onKeyDown = (e: KeyboardEvent) => {
    const target = e.target as HTMLElement | null;
    const isTypingTarget = Boolean(
      target
      && (
        target.tagName === 'INPUT'
        || target.tagName === 'TEXTAREA'
        || target.tagName === 'SELECT'
        || target.isContentEditable
      ),
    );
    if (isTypingTarget) return;

    if (e.key === 'f' || e.key === 'F') {
      onToggleFullscreen();
    }
    if ((e.ctrlKey || e.metaKey) && e.key === 's') {
      e.preventDefault();
      onSaveScreenshot();
    }
    if (e.key === 'ArrowLeft') {
      e.preventDefault();
      onPanLeft();
    }
    if (e.key === 'ArrowRight') {
      e.preventDefault();
      onPanRight();
    }
  };

  document.addEventListener('keydown', onKeyDown);
  return () => {
    document.removeEventListener('keydown', onKeyDown);
  };
}

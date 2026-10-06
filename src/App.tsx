/**
 * Application shell.
 *
 * Three tabs share one preview pane, so the document stays visible while you edit
 * content, change the design, or read the analysis — switching tabs never hides
 * the thing you are working on.
 */

import { useEffect, useMemo, useState } from 'react';
import { startPersistence, useStore } from './state/store';
import { EditorPanel } from './features/editor/EditorPanel';
import { PreviewPanel } from './features/preview/PreviewPanel';
import { AnalysisPanel } from './features/analysis/AnalysisPanel';
import { DesignPanel } from './features/design/DesignPanel';
import { analyzeResume } from './ats/analyze';
import { useDebouncedValue } from './ui/useDebouncedValue';
import { IconButton } from './ui/primitives';
import {
  FileTextIcon,
  MoonIcon,
  PaletteIcon,
  RedoIcon,
  ShieldCheckIcon,
  SunIcon,
  UndoIcon,
  XIcon,
} from './ui/icons';

type Theme = 'light' | 'dark';

function useTheme() {
  const [theme, setTheme] = useState<Theme>(() =>
    document.documentElement.dataset.theme === 'dark' ? 'dark' : 'light',
  );

  useEffect(() => {
    document.documentElement.dataset.theme = theme;
    try {
      localStorage.setItem('resume-forge:theme', theme);
    } catch {
      /* persisting the theme is a nicety, not a requirement */
    }
  }, [theme]);

  return { theme, toggle: () => setTheme((value) => (value === 'dark' ? 'light' : 'dark')) };
}

export function App() {
  const ui = useStore((state) => state.ui);
  const setUi = useStore((state) => state.setUi);
  const undo = useStore((state) => state.undo);
  const redo = useStore((state) => state.redo);
  const canUndo = useStore((state) => state.past.length > 0);
  const canRedo = useStore((state) => state.future.length > 0);
  const resume = useStore((state) => state.resume);
  const notice = useStore((state) => state.ui.notice);
  const dismissNotice = useStore((state) => state.dismissNotice);
  const { theme, toggle } = useTheme();

  // Badge counts come from the same analyser the panel uses, so they never disagree.
  const debouncedResume = useDebouncedValue(resume, 400);
  const counts = useMemo(() => {
    const analysis = analyzeResume(debouncedResume);
    const scored = analysis.checks.filter((check) => check.status !== 'info');
    return {
      failing: scored.filter((check) => check.status === 'fail').length,
      warnings: scored.filter((check) => check.status === 'warn').length,
      passing: scored.filter((check) => check.status === 'pass').length,
      total: scored.length,
    };
  }, [debouncedResume]);

  useEffect(() => startPersistence(), []);

  // Global shortcuts. Typing in a field never triggers them.
  useEffect(() => {
    const onKeyDown = (event: KeyboardEvent) => {
      const target = event.target as HTMLElement | null;
      const typing =
        target?.tagName === 'INPUT' || target?.tagName === 'TEXTAREA' || target?.isContentEditable === true;
      const modifier = event.ctrlKey || event.metaKey;

      if (modifier && event.key.toLowerCase() === 'z') {
        event.preventDefault();
        if (event.shiftKey) redo();
        else undo();
        return;
      }
      if (modifier && event.key.toLowerCase() === 'y') {
        event.preventDefault();
        redo();
        return;
      }
      if (modifier && event.key.toLowerCase() === 's') {
        event.preventDefault();
        const button = document.querySelector<HTMLButtonElement>('[data-action="download"]');
        if (button && !button.disabled) button.click();
        else useStore.getState().notify('info', 'The PDF is still rendering — try again in a moment.');
        return;
      }
      if (!typing && !modifier) {
        if (event.key === '1') setUi({ tab: 'content' });
        if (event.key === '2') setUi({ tab: 'design' });
        if (event.key === '3') setUi({ tab: 'analysis' });
      }
    };
    window.addEventListener('keydown', onKeyDown);
    return () => window.removeEventListener('keydown', onKeyDown);
  }, [undo, redo, setUi]);

  // Auto-dismiss notices so they never become permanent furniture.
  useEffect(() => {
    if (!notice) return;
    const timer = window.setTimeout(dismissNotice, 5200);
    return () => window.clearTimeout(timer);
  }, [notice, dismissNotice]);

  const downloadFromMobile = () => {
    // The real download button lives in the preview toolbar; on small screens the
    // preview may be hidden behind the Edit/Preview switch.
    const button = document.querySelector<HTMLButtonElement>('.preview-toolbar [data-action="download"]');
    if (button && !button.disabled) {
      button.click();
      return;
    }
    setUi({ mobilePane: 'preview' });
    useStore.getState().notify('info', 'Preview is rendering — the download button is in the toolbar.');
  };

  return (
    <div className="app">
      <a className="skip-link" href="#main">
        Skip to the editor
      </a>

      <header className="app-header">
        <div className="brand">
          <span className="brand__mark" aria-hidden="true">
            <FileTextIcon size={18} />
          </span>
          <span className="brand__text">
            <span className="brand__name">Resume Forge</span>
            <span className="brand__tag">ATS-friendly resumes · interactive PDF · nothing leaves your device</span>
          </span>
        </div>

        <div className="header-actions">
          <IconButton label="Undo" onClick={undo} disabled={!canUndo}>
            <UndoIcon />
          </IconButton>
          <IconButton label="Redo" onClick={redo} disabled={!canRedo}>
            <RedoIcon />
          </IconButton>
          <IconButton label={theme === 'dark' ? 'Switch to light theme' : 'Switch to dark theme'} onClick={toggle}>
            {theme === 'dark' ? <SunIcon /> : <MoonIcon />}
          </IconButton>
          <button
            type="button"
            className="chip chip--button"
            onClick={() => setUi({ tab: 'analysis' })}
            title="Open the ATS analysis"
          >
            <ShieldCheckIcon size={14} />
            {counts.passing}/{counts.total} checks
          </button>
        </div>
      </header>

      <div className="app-body" data-mobile-pane={ui.mobilePane} id="main">
        <div className="mobile-switch">
          <button
            type="button"
            className="btn btn--sm"
            aria-pressed={ui.mobilePane === 'edit'}
            onClick={() => setUi({ mobilePane: 'edit' })}
          >
            Edit
          </button>
          <button
            type="button"
            className="btn btn--sm"
            aria-pressed={ui.mobilePane === 'preview'}
            onClick={() => setUi({ mobilePane: 'preview' })}
          >
            Preview
          </button>
          <div className="preview-toolbar__spacer" />
          <button type="button" className="btn btn--sm btn--primary" onClick={downloadFromMobile}>
            Download
          </button>
        </div>

        <section className="pane pane--editor" aria-label="Resume editor">
          <div className="tabbar" role="tablist" aria-label="Editor sections">
            <button
              type="button"
              role="tab"
              id="tab-content"
              aria-selected={ui.tab === 'content'}
              aria-controls="panel-content"
              className="tab"
              onClick={() => setUi({ tab: 'content' })}
            >
              <FileTextIcon size={15} />
              Content
            </button>
            <button
              type="button"
              role="tab"
              id="tab-design"
              aria-selected={ui.tab === 'design'}
              aria-controls="panel-design"
              className="tab"
              onClick={() => setUi({ tab: 'design' })}
            >
              <PaletteIcon size={15} />
              Design
            </button>
            <button
              type="button"
              role="tab"
              id="tab-analysis"
              aria-selected={ui.tab === 'analysis'}
              aria-controls="panel-analysis"
              className="tab"
              onClick={() => setUi({ tab: 'analysis' })}
            >
              <ShieldCheckIcon size={15} />
              Analysis
              {counts.failing > 0 ? (
                <span className="tab__badge tab__badge--fail">{counts.failing}</span>
              ) : counts.warnings > 0 ? (
                <span className="tab__badge tab__badge--warn">{counts.warnings}</span>
              ) : null}
            </button>
          </div>

          <div
            role="tabpanel"
            id={`panel-${ui.tab}`}
            aria-labelledby={`tab-${ui.tab}`}
            style={{ display: 'contents' }}
          >
            {ui.tab === 'content' ? <EditorPanel /> : null}
            {ui.tab === 'design' ? <DesignPanel /> : null}
            {ui.tab === 'analysis' ? <AnalysisPanel /> : null}
          </div>
        </section>

        <PreviewPanel />
      </div>

      {notice ? (
        <div className="notice" data-tone={notice.tone} role="status" aria-live="polite">
          <span>{notice.message}</span>
          <IconButton label="Dismiss message" onClick={dismissNotice}>
            <XIcon size={15} />
          </IconButton>
        </div>
      ) : null}
    </div>
  );
}

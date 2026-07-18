import { writable, get, derived } from 'svelte/store';
import { SystemBridge } from '../../../utils/systemBridge';
import type { OpenFile, Diagnostic } from './types';
import { getLang, LSP_LANGS } from './languageMap';

function out(r: any): string { return typeof r === 'string' ? r : (r?.stdout ?? '') + (r?.stderr ?? ''); }

export function createEditorFiles(rootPathStore: { subscribe: (fn: (v: string) => void) => () => void }) {
  const openFiles = writable<OpenFile[]>([]);
  const activeIdx = writable(0);
  const diagnostics = writable<Diagnostic[]>([]);
  const lspStatus = writable<Record<string, boolean>>({});
  const editorTheme = writable('blue-dark');
  const fontSize = writable(13);
  const cursorPos = writable({ line: 1, col: 1 });

  /** Set by MonacoEditor.svelte once mounted — used for markers + theme sync. */
  let monacoApi: any = null;
  let editorApi: any = null;
  function setMonacoRefs(editor: any, monaco: any) { editorApi = editor; monacoApi = monaco; }

  let currentRoot = '';
  rootPathStore.subscribe((v) => (currentRoot = v));

  async function startLsp(language: string) {
    if (get(lspStatus)[language]) return;
    if (!LSP_LANGS.includes(language)) return;
    const res = await SystemBridge.startLanguageServer(language, currentRoot);
    if (res.success) lspStatus.update((prev) => ({ ...prev, [language]: true }));
  }

  async function openFile(path: string) {
    const existingIdx = get(openFiles).findIndex((f) => f.path === path);
    if (existingIdx >= 0) { activeIdx.set(existingIdx); return; }

    const content = await SystemBridge.readFile(path);
    const language = getLang(path);
    openFiles.update((prev) => {
      const next = [...prev, { path, content, modified: false, language }];
      activeIdx.set(next.length - 1);
      return next;
    });
    startLsp(language);
  }

  function closeFile(idx: number) {
    openFiles.update((prev) => (prev.length <= 1 ? [] : prev.filter((_, i) => i !== idx)));
    activeIdx.update((i) => Math.max(0, i === idx ? i - 1 : i > idx ? i - 1 : i));
  }

  async function runLint(idx: number) {
    const file = get(openFiles)[idx];
    if (!file) return;
    const newDiags: Diagnostic[] = [];

    if (file.language === 'rust') {
      const res = await SystemBridge.executeCommand(`cd "${currentRoot}" && cargo check --message-format=short 2>&1 | head -20`);
      for (const line of out(res).split('\n')) {
        const m = line.match(/^(.+):(\d+):(\d+):\s*(error|warning):\s*(.+)$/);
        if (m) newDiags.push({ file: m[1], line: parseInt(m[2]), col: parseInt(m[3]), severity: m[4] as any, message: m[5] });
      }
    } else if (file.language === 'typescript' || file.language === 'javascript') {
      const res = await SystemBridge.executeCommand(`npx --yes tsc --noEmit --allowJs "${file.path}" 2>&1 | head -20`);
      for (const line of out(res).split('\n')) {
        const m = line.match(/^(.+)\((\d+),(\d+)\):\s*(error|warning)\s+\w+:\s*(.+)$/);
        if (m) newDiags.push({ file: m[1], line: parseInt(m[2]), col: parseInt(m[3]), severity: m[4] as any, message: m[5] });
      }
    } else if (file.language === 'python') {
      const res = await SystemBridge.executeCommand(`cd "${currentRoot}" && python3 -m py_compile "${file.path}" 2>&1 | head -20`);
      const text = out(res);
      for (const line of text.split('\n')) {
        const m = line.match(/File "(.+)", line (\d+)/);
        if (m) newDiags.push({ file: m[1], line: parseInt(m[2]), col: 1, severity: 'error', message: text.split('\n').pop() || 'Syntax error' });
      }
    }

    diagnostics.update((prev) => [...prev.filter((d) => d.file !== file.path), ...newDiags]);

    if (monacoApi && editorApi) {
      const model = editorApi.getModel();
      if (model) {
        const markers = newDiags
          .filter((d) => d.file === file.path || file.path.endsWith(d.file))
          .map((d) => ({
            severity: d.severity === 'error' ? monacoApi.MarkerSeverity.Error : monacoApi.MarkerSeverity.Warning,
            startLineNumber: d.line, startColumn: d.col, endLineNumber: d.line, endColumn: d.col + 30,
            message: d.message,
          }));
        monacoApi.editor.setModelMarkers(model, 'blue-lint', markers);
      }
    }
  }

  async function saveFile(idx: number) {
    const file = get(openFiles)[idx];
    if (!file) return;
    await SystemBridge.writeFile(file.path, file.content);
    openFiles.update((prev) => prev.map((f, i) => (i === idx ? { ...f, modified: false } : f)));
    runLint(idx);
  }

  function saveAll() { get(openFiles).forEach((f, i) => f.modified && saveFile(i)); }

  function renameOpenFile(oldPath: string, newPath: string) {
    openFiles.update((prev) => prev.map((f) => (f.path === oldPath ? { ...f, path: newPath, language: getLang(newPath) } : f)));
  }

  function handleEditorChange(value: string | undefined) {
    if (value === undefined) return;
    const idx = get(activeIdx);
    openFiles.update((prev) => prev.map((f, i) => (i === idx ? { ...f, content: value, modified: true } : f)));
  }

  editorTheme.subscribe(($theme) => monacoApi?.editor.setTheme($theme));

  const activeFile = derived([openFiles, activeIdx], ([$openFiles, $activeIdx]) => $openFiles[$activeIdx]);
  const fileDiagnostics = derived([diagnostics, activeFile], ([$diagnostics, $activeFile]) =>
    $diagnostics.filter((d) => $activeFile && (d.file === $activeFile.path || $activeFile.path.endsWith(d.file)))
  );
  const errors = derived(fileDiagnostics, ($d) => $d.filter((d) => d.severity === 'error').length);
  const warnings = derived(fileDiagnostics, ($d) => $d.filter((d) => d.severity === 'warning').length);

  return {
    openFiles, activeIdx, activeFile,
    diagnostics, fileDiagnostics, errors, warnings,
    lspStatus, editorTheme, fontSize, cursorPos,
    setMonacoRefs, setCursorPos: (p: { line: number; col: number }) => cursorPos.set(p),
    openFile, closeFile, saveFile, saveAll, runLint, renameOpenFile, handleEditorChange,
  };
}

export type EditorFilesState = ReturnType<typeof createEditorFiles>;

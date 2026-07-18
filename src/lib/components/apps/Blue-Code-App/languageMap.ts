const EXT_TO_LANG: Record<string, string> = {
    html: 'html', css: 'css', scss: 'scss', less: 'less',
    js: 'javascript', jsx: 'javascript', mjs: 'javascript', cjs: 'javascript',
    ts: 'typescript', tsx: 'typescript',
    rs: 'rust', go: 'go', py: 'python',
    rb: 'ruby', php: 'php', lua: 'lua',
    c: 'c', cpp: 'cpp', h: 'c', hpp: 'cpp', cc: 'cpp',
    java: 'java', kt: 'kotlin', swift: 'swift', cs: 'csharp',
    json: 'json', yaml: 'yaml', yml: 'yaml',
    toml: 'ini', xml: 'xml', md: 'markdown', mdx: 'markdown',
    sh: 'shell', bash: 'shell', zsh: 'shell', fish: 'shell',
    sql: 'sql', graphql: 'graphql', dockerfile: 'dockerfile',
    vue: 'html', svelte: 'html',
};

export function getLang(path: string): string {
    const base = path.split('/').pop()?.toLowerCase() ?? '';
    if (base === 'dockerfile') return 'dockerfile';
    if (base === 'makefile') return 'makefile';
    const ext = base.split('.').pop() ?? '';
    return EXT_TO_LANG[ext] || 'plaintext';
}

/** Languages for which we attempt to start a real LSP server (see SystemBridge.startLanguageServer). */
export const LSP_LANGS = ['typescript', 'javascript', 'rust', 'python', 'go', 'cpp', 'c'];

/** File patterns indexed during full-text search (avoids scanning binary blobs). */
export const SEARCHABLE_EXT_RE = /\.(ts|tsx|js|jsx|mjs|cjs|rs|py|go|rb|php|lua|c|cpp|h|hpp|java|kt|swift|cs|json|toml|yaml|yml|xml|md|sh|bash|sql|html|css|scss|vue|svelte)$/;

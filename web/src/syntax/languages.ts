import type { LanguageInput } from 'shiki/core'

const loaders: Record<string, () => Promise<{ default: LanguageInput }>> = {
  typescript: (): Promise<{ default: LanguageInput }> => import('shiki/langs/typescript.mjs'),
  tsx: (): Promise<{ default: LanguageInput }> => import('shiki/langs/tsx.mjs'),
  javascript: (): Promise<{ default: LanguageInput }> => import('shiki/langs/javascript.mjs'),
  jsx: (): Promise<{ default: LanguageInput }> => import('shiki/langs/jsx.mjs'),
  vue: (): Promise<{ default: LanguageInput }> => import('shiki/langs/vue.mjs'),
  go: (): Promise<{ default: LanguageInput }> => import('shiki/langs/go.mjs'),
  python: (): Promise<{ default: LanguageInput }> => import('shiki/langs/python.mjs'),
  rust: (): Promise<{ default: LanguageInput }> => import('shiki/langs/rust.mjs'),
  json: (): Promise<{ default: LanguageInput }> => import('shiki/langs/json.mjs'),
  jsonc: (): Promise<{ default: LanguageInput }> => import('shiki/langs/jsonc.mjs'),
  yaml: (): Promise<{ default: LanguageInput }> => import('shiki/langs/yaml.mjs'),
  toml: (): Promise<{ default: LanguageInput }> => import('shiki/langs/toml.mjs'),
  html: (): Promise<{ default: LanguageInput }> => import('shiki/langs/html.mjs'),
  css: (): Promise<{ default: LanguageInput }> => import('shiki/langs/css.mjs'),
  scss: (): Promise<{ default: LanguageInput }> => import('shiki/langs/scss.mjs'),
  markdown: (): Promise<{ default: LanguageInput }> => import('shiki/langs/markdown.mjs'),
  shellscript: (): Promise<{ default: LanguageInput }> => import('shiki/langs/shellscript.mjs'),
  sql: (): Promise<{ default: LanguageInput }> => import('shiki/langs/sql.mjs'),
  java: (): Promise<{ default: LanguageInput }> => import('shiki/langs/java.mjs'),
  c: (): Promise<{ default: LanguageInput }> => import('shiki/langs/c.mjs'),
  cpp: (): Promise<{ default: LanguageInput }> => import('shiki/langs/cpp.mjs'),
  ruby: (): Promise<{ default: LanguageInput }> => import('shiki/langs/ruby.mjs'),
  dockerfile: (): Promise<{ default: LanguageInput }> => import('shiki/langs/dockerfile.mjs'),
  graphql: (): Promise<{ default: LanguageInput }> => import('shiki/langs/graphql.mjs'),
}

const extensions: Record<string, string> = {
  ts: 'typescript', mts: 'typescript', cts: 'typescript', tsx: 'tsx',
  js: 'javascript', mjs: 'javascript', cjs: 'javascript', jsx: 'jsx', vue: 'vue',
  go: 'go', py: 'python', pyi: 'python', rs: 'rust', json: 'json', jsonc: 'jsonc',
  yaml: 'yaml', yml: 'yaml', toml: 'toml', html: 'html', htm: 'html',
  css: 'css', scss: 'scss', md: 'markdown', markdown: 'markdown',
  sh: 'shellscript', bash: 'shellscript', zsh: 'shellscript', sql: 'sql',
  java: 'java', c: 'c', h: 'c', cc: 'cpp', cpp: 'cpp', hpp: 'cpp', rb: 'ruby',
  graphql: 'graphql', gql: 'graphql',
}

/**
 * Resolves a supported grammar from a literal repository path without content guessing.
 * @param path Original side's file path.
 * @returns Grammar name, or null for plain text.
 */
export function sourceLanguage(path?: string): string | null {
  const name = path?.split('/').at(-1)?.toLowerCase() ?? ''
  if (name === 'dockerfile' || name.startsWith('dockerfile.')) return 'dockerfile'
  if (name === '.bashrc' || name === '.zshrc') return 'shellscript'
  return extensions[name.split('.').at(-1) ?? ''] ?? null
}

/**
 * Imports only an explicitly supported language and its embedded grammar dependencies.
 * @param language Resolved grammar name.
 * @returns Shiki language registration.
 */
export async function loadLanguage(language: string): Promise<LanguageInput> {
  const loader = loaders[language]
  if (!loader) throw new Error('Unsupported syntax language.')
  return (await loader()).default
}

import os from 'node:os';
import path from 'node:path';

export function resolveDataDir(options) {
  if (typeof options.dataDir === 'string' && options.dataDir) return options.dataDir;
  const root = process.platform === 'win32'
    ? process.env.LOCALAPPDATA || path.join(os.homedir(), 'AppData', 'Local')
    : process.env.XDG_STATE_HOME || path.join(os.homedir(), '.local', 'state');
  return path.join(root, 'opencode', 'stop-that-shit');
}

// The parser, rather than a mention inside a quote, owns contract changes.
export function mentionsDirective(text) {
  return /\$stop-that-shit\b/i.test(String(text || ''));
}

export function directiveErrorText(error) {
  return `Stop That Shit directive rejected (${error.code}): ${error.message} `
    + 'The previous contract is unchanged. Tools are paused until you submit a corrected instruction.';
}

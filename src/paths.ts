import path from 'node:path';

export const REPO_ROOT = path.resolve(__dirname, '..');
export const LOCAL_DIR = path.join(REPO_ROOT, 'local');
export const STATE_FILE = path.join(LOCAL_DIR, 'state.json');
export const ENV_FILE = path.join(LOCAL_DIR, '.env');

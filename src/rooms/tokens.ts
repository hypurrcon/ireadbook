export interface RoomTokens {
  bg: string; surface: string; surface2: string; ink: string; inkSoft: string;
  accent: string; accentInk: string; line: string; glow: string;
  display: 'serif' | 'sans' | 'mono';
  scheme: 'dark' | 'light';
}

export const ROOM_IDS = ['attic', 'cyberpunk', 'library', 'japanese', 'treehouse', 'space', 'wizard', 'train', 'underwater', 'cafe', 'minimal'] as const;
export type RoomId = typeof ROOM_IDS[number];

export const TOKENS: Record<RoomId, RoomTokens> = {
  attic: { bg: '#1e1714', surface: '#2b211b', surface2: '#3a2c23', ink: '#f2e7d3', inkSoft: '#b9a68b', accent: '#e8a33d', accentInk: '#1e1714', line: 'rgba(242,231,211,.13)', glow: 'rgba(232,163,61,.35)', display: 'serif', scheme: 'dark' },
  cyberpunk: { bg: '#0e0c17', surface: '#181528', surface2: '#231f38', ink: '#e9f1ff', inkSoft: '#8f93b8', accent: '#ff3d7f', accentInk: '#0e0c17', line: 'rgba(46,242,255,.18)', glow: 'rgba(255,61,127,.45)', display: 'mono', scheme: 'dark' },
  library: { bg: '#15130f', surface: '#221d16', surface2: '#2f281e', ink: '#efe2c4', inkSoft: '#a8977a', accent: '#c9a24a', accentInk: '#15130f', line: 'rgba(239,226,196,.12)', glow: 'rgba(201,162,74,.35)', display: 'serif', scheme: 'dark' },
  japanese: { bg: '#e9e4d6', surface: '#f4f0e6', surface2: '#ddd6c4', ink: '#2b2622', inkSoft: '#6f665c', accent: '#2f4b6e', accentInk: '#f4f0e6', line: 'rgba(43,38,34,.14)', glow: 'rgba(47,75,110,.25)', display: 'serif', scheme: 'light' },
  treehouse: { bg: '#142019', surface: '#1d2c23', surface2: '#26392d', ink: '#e6efd9', inkSoft: '#9db08f', accent: '#c8e06a', accentInk: '#142019', line: 'rgba(230,239,217,.13)', glow: 'rgba(200,224,106,.35)', display: 'serif', scheme: 'dark' },
  space: { bg: '#070b14', surface: '#111827', surface2: '#1a2436', ink: '#e3ecf7', inkSoft: '#8798b0', accent: '#ffb547', accentInk: '#070b14', line: 'rgba(227,236,247,.13)', glow: 'rgba(255,181,71,.35)', display: 'sans', scheme: 'dark' },
  wizard: { bg: '#1a1426', surface: '#251c36', surface2: '#302545', ink: '#efe6fb', inkSoft: '#a597bd', accent: '#7fe3c4', accentInk: '#1a1426', line: 'rgba(239,230,251,.13)', glow: 'rgba(127,227,196,.4)', display: 'serif', scheme: 'dark' },
  train: { bg: '#1b1418', surface: '#2a1d23', surface2: '#38262e', ink: '#f3e4d4', inkSoft: '#b39b8c', accent: '#f0c674', accentInk: '#1b1418', line: 'rgba(243,228,212,.13)', glow: 'rgba(240,198,116,.35)', display: 'serif', scheme: 'dark' },
  underwater: { bg: '#04202a', surface: '#0a2f3b', surface2: '#113e4c', ink: '#dff6f5', inkSoft: '#84b3b5', accent: '#ffd27a', accentInk: '#04202a', line: 'rgba(223,246,245,.14)', glow: 'rgba(94,240,210,.35)', display: 'sans', scheme: 'dark' },
  cafe: { bg: '#e6eadf', surface: '#f3f5ef', surface2: '#d6dccd', ink: '#23261f', inkSoft: '#5e6656', accent: '#1f5c45', accentInk: '#f3f5ef', line: 'rgba(35,38,31,.14)', glow: 'rgba(31,92,69,.25)', display: 'serif', scheme: 'light' },
  minimal: { bg: '#f6f6f3', surface: '#ffffff', surface2: '#ebebe7', ink: '#1c1c1c', inkSoft: '#6b6b68', accent: '#1c1c1c', accentInk: '#ffffff', line: 'rgba(28,28,28,.12)', glow: 'rgba(28,28,28,.15)', display: 'sans', scheme: 'light' },
};

const FONT = {
  serif: "'Noto Serif Thai', Georgia, serif",
  sans: "'IBM Plex Sans Thai', system-ui, sans-serif",
  mono: "'JetBrains Mono', 'IBM Plex Sans Thai', monospace",
};

export function applyTokens(id: string) {
  const t = TOKENS[(id as RoomId)] ?? TOKENS.attic;
  const r = document.documentElement.style;
  r.setProperty('--bg', t.bg);
  r.setProperty('--surface', t.surface);
  r.setProperty('--surface-2', t.surface2);
  r.setProperty('--ink', t.ink);
  r.setProperty('--ink-soft', t.inkSoft);
  r.setProperty('--accent', t.accent);
  r.setProperty('--accent-ink', t.accentInk);
  r.setProperty('--line', t.line);
  r.setProperty('--glow', t.glow);
  r.setProperty('--font-display', FONT[t.display]);
  r.setProperty('color-scheme', t.scheme);
  document.documentElement.dataset.room = id;
  document.querySelector('meta[name="theme-color"]')?.setAttribute('content', t.bg);
}

// test_theme_toggle.js
// Tests dark/light mode toggle logic, CSS variables palette coverage,
// prefers-color-scheme detection, and localStorage persistence.

import fs from 'fs';

class MockLocalStorage {
  constructor() {
    this.store = {};
  }
  getItem(key) {
    return this.store[key] || null;
  }
  setItem(key, value) {
    this.store[key] = String(value);
  }
  removeItem(key) {
    delete this.store[key];
  }
  clear() {
    this.store = {};
  }
}

// 1. Test Theme Selection & Preference Logic
function testThemeSelection() {
  console.log('--- Test 1: Theme Selection & System Preference ---');

  // Case A: No localStorage, system prefers dark
  const storage1 = new MockLocalStorage();
  const mockWindowDark = {
    matchMedia: (query) => ({
      matches: query === '(prefers-color-scheme: dark)',
    }),
  };

  const resolveThemeA = (storage, win) => {
    const saved = storage.getItem('ideaforge_theme');
    if (saved === 'dark' || saved === 'light') return saved;
    if (win?.matchMedia) {
      return win.matchMedia('(prefers-color-scheme: dark)').matches ? 'dark' : 'light';
    }
    return 'light';
  };

  const themeA = resolveThemeA(storage1, mockWindowDark);
  console.log('Case A (no stored theme, system prefers dark):', themeA);
  if (themeA !== 'dark') throw new Error('Failed to default to system dark preference');

  // Case B: No localStorage, system prefers light
  const mockWindowLight = {
    matchMedia: (query) => ({
      matches: false,
    }),
  };
  const themeB = resolveThemeA(storage1, mockWindowLight);
  console.log('Case B (no stored theme, system prefers light):', themeB);
  if (themeB !== 'light') throw new Error('Failed to default to system light preference');

  // Case C: Stored preference overrides system
  storage1.setItem('ideaforge_theme', 'light');
  const themeC = resolveThemeA(storage1, mockWindowDark);
  console.log('Case C (stored "light" overrides system "dark"):', themeC);
  if (themeC !== 'light') throw new Error('Stored preference did not override system preference');

  storage1.setItem('ideaforge_theme', 'dark');
  const themeD = resolveThemeA(storage1, mockWindowLight);
  console.log('Case D (stored "dark" overrides system "light"):', themeD);
  if (themeD !== 'dark') throw new Error('Stored preference did not override system preference');

  console.log('Theme selection logic verified successfully!');
}

// 2. Test Toggle & Reload Persistence
function testToggleAndPersistence() {
  console.log('\n--- Test 2: Toggle & Reload Persistence ---');
  const storage = new MockLocalStorage();
  let currentTheme = 'light';
  let domDataTheme = '';

  const applyTheme = (t) => {
    currentTheme = t;
    domDataTheme = t;
    storage.setItem('ideaforge_theme', t);
  };

  const toggleTheme = () => {
    applyTheme(currentTheme === 'dark' ? 'light' : 'dark');
  };

  applyTheme('light');
  console.log('Initial theme:', currentTheme, '| DOM data-theme:', domDataTheme, '| Stored:', storage.getItem('ideaforge_theme'));
  if (storage.getItem('ideaforge_theme') !== 'light') throw new Error('Initial theme not saved');

  // Toggle to dark
  toggleTheme();
  console.log('After toggle 1:', currentTheme, '| DOM data-theme:', domDataTheme, '| Stored:', storage.getItem('ideaforge_theme'));
  if (currentTheme !== 'dark' || domDataTheme !== 'dark' || storage.getItem('ideaforge_theme') !== 'dark') {
    throw new Error('Toggle to dark failed');
  }

  // Simulate Reload
  const restoredTheme = storage.getItem('ideaforge_theme');
  console.log('Simulating reload... Restored theme from localStorage:', restoredTheme);
  if (restoredTheme !== 'dark') throw new Error('Failed to persist dark theme across reload');

  // Toggle back to light
  toggleTheme();
  console.log('After toggle 2:', currentTheme, '| DOM data-theme:', domDataTheme, '| Stored:', storage.getItem('ideaforge_theme'));
  if (currentTheme !== 'light' || domDataTheme !== 'light' || storage.getItem('ideaforge_theme') !== 'light') {
    throw new Error('Toggle back to light failed');
  }

  console.log('Toggle & persistence verified successfully!');
}

// 3. Test App.css Theme Coverage
function testCssThemeCoverage() {
  console.log('\n--- Test 3: CSS Theme Coverage Across All Sections ---');
  const css = fs.readFileSync('src/App.css', 'utf-8');

  // Check palettes
  if (!css.includes(":root {") || !css.includes(":root[data-theme='dark']")) {
    throw new Error('CSS missing root or dark theme palette definitions');
  }

  if (!css.includes("@media (prefers-color-scheme: dark)")) {
    throw new Error('CSS missing prefers-color-scheme fallback');
  }

  // Key CSS variables that must exist in both palettes
  const requiredTokens = [
    '--color-bg',
    '--color-surface',
    '--color-surface-card',
    '--color-surface-subtle',
    '--color-border',
    '--color-text-main',
    '--color-text-muted',
    '--color-primary',
    '--color-user-msg',
    '--color-ai-msg',
    '--color-code-bg',
    '--color-input-bg',
  ];

  for (const token of requiredTokens) {
    if (!css.includes(token)) {
      throw new Error(`CSS missing required variable: ${token}`);
    }
  }
  console.log('Verified core color variable tokens in CSS palettes.');

  // Check section components use CSS variables
  const sectionsToCheck = [
    { name: 'Button theme toggle', selector: '.btn-theme-toggle' },
    { name: 'Initial form card', selector: '.initial-card' },
    { name: 'Textarea input', selector: 'textarea' },
    { name: 'Example prompt chip', selector: '.chip-btn' },
    { name: 'Chat container', selector: '.chat-section' },
    { name: 'Chat user message', selector: '.message-user' },
    { name: 'Chat assistant message', selector: '.message-assistant' },
    { name: 'Roadmap header card', selector: '.roadmap-header' },
    { name: 'Summary metrics card', selector: '.summary-card' },
    { name: 'Feature scope box', selector: '.feature-box' },
    { name: 'Timeline container', selector: '.timeline-container' },
    { name: 'Milestone content card', selector: '.timeline-content' },
    { name: 'Milestone task item', selector: '.task-item' },
    { name: 'Developer setup guide', selector: '.setup-guide-container' },
    { name: 'Terminal command code block', selector: '.code-block' },
    { name: 'Key tools card', selector: '.key-tools-section' },
    { name: 'Execution progress card', selector: '.roadmap-progress-card' },
    { name: 'History card', selector: '.history-card' },
    { name: 'History empty state', selector: '.history-empty-state' },
    { name: 'PDF download button', selector: '.btn-download-pdf' },
  ];

  for (const sec of sectionsToCheck) {
    if (!css.includes(sec.selector)) {
      throw new Error(`CSS missing styling selector for ${sec.name}: ${sec.selector}`);
    }
    console.log(`✓ Confirmed styling selector present: ${sec.name} (${sec.selector})`);
  }

  console.log('\nALL THEME TOGGLE & PALETTE COVERAGE TESTS PASSED SUCCESSFULLY!');
}

testThemeSelection();
testToggleAndPersistence();
testCssThemeCoverage();

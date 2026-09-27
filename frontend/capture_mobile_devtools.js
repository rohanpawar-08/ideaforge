import puppeteer from 'puppeteer-core';
import fs from 'fs';
import path from 'path';

const CHROME_PATH = 'C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe';
const OUT_DIR = 'C:\\Users\\Admin\\.gemini\\antigravity-ide\\brain\\ac4236b7-a7fa-44de-b28a-3b55ef18636e\\mobile_375px';

if (!fs.existsSync(OUT_DIR)) {
  fs.mkdirSync(OUT_DIR, { recursive: true });
}

async function getAuthToken() {
  const resp = await fetch('http://127.0.0.1:8000/auth/login', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ email: 'testbeginner@example.com', password: 'password123' })
  });
  if (resp.ok) {
    const data = await resp.json();
    return data.access_token;
  }
  const signupResp = await fetch('http://127.0.0.1:8000/auth/signup', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ email: 'testbeginner@example.com', password: 'password123' })
  });
  const data = await signupResp.json();
  return data.access_token;
}

async function getRoadmapsData(token) {
  let rm7 = null;
  let rm2 = null;

  try {
    const r7 = await fetch('http://127.0.0.1:8000/roadmaps/7', {
      headers: { 'Authorization': `Bearer ${token}` }
    });
    if (r7.ok) rm7 = await r7.json();
  } catch (e) {}

  try {
    const r2 = await fetch('http://127.0.0.1:8000/roadmaps/2', {
      headers: { 'Authorization': `Bearer ${token}` }
    });
    if (r2.ok) rm2 = await r2.json();
  } catch (e) {}

  const d7 = rm7?.data || rm7 || {};
  const d2 = rm2?.data || rm2 || {};

  // Build complete comprehensive roadmap containing BOTH beginner_guide AND suggested_schema
  const fullCompositeRoadmap = {
    ...d7,
    id: rm7?.id || 7,
    original_idea: rm7?.original_idea || 'A simple habit tracking web app where people check off daily habits',
    created_at: rm7?.created_at || '2026-09-27T08:30:00Z',
    user_skill_level: 'beginner',
    beginner_guide: d7.beginner_guide || [
      {
        technology: 'Vue.js',
        category: 'Frontend Framework',
        plain_explanation: 'Vue is a simple way to build interactive web pages. It lets you create small reusable components that automatically update the screen when data changes.',
        resource_name: 'Vue 3 Official Guide – Introduction',
        resource_desc: 'Free guide to learning Vue 3 basics',
        resource_url: 'https://vuejs.org/guide/introduction.html'
      },
      {
        technology: 'Bootstrap',
        category: 'CSS Framework',
        plain_explanation: 'Bootstrap is a collection of pre-made CSS styles that make a website look clean and responsive. It helps you avoid writing lots of CSS from scratch.',
        resource_name: 'Bootstrap Documentation – Getting Started',
        resource_desc: 'Free, complete guide to using Bootstrap',
        resource_url: 'https://getbootstrap.com/docs/5.3/getting-started/introduction/'
      }
    ],
    suggested_schema: (d2.suggested_schema && d2.suggested_schema.length > 0) ? d2.suggested_schema : [
      {
        table_name: 'habits',
        fields: [
          { name: 'id', type: 'INTEGER PRIMARY KEY', notes: 'Unique identifier for habit' },
          { name: 'user_id', type: 'INTEGER', notes: 'Foreign key referencing users table' },
          { name: 'name', type: 'TEXT', notes: 'Habit title or description entered by user' },
          { name: 'frequency', type: 'TEXT', notes: 'Daily, weekly, or custom frequency schedule' }
        ]
      },
      {
        table_name: 'habit_logs',
        fields: [
          { name: 'id', type: 'INTEGER PRIMARY KEY', notes: 'Auto-increment log record ID' },
          { name: 'habit_id', type: 'INTEGER', notes: 'Foreign key to habits' },
          { name: 'completed_at', type: 'TIMESTAMP', notes: 'Date and time of completion' }
        ]
      }
    ]
  };

  return { fullCompositeRoadmap };
}

async function run() {
  const token = await getAuthToken();
  console.log('Got auth token:', token ? 'YES' : 'NO');
  const { fullCompositeRoadmap } = await getRoadmapsData(token);

  const browser = await puppeteer.launch({
    executablePath: CHROME_PATH,
    headless: 'new',
    args: ['--no-sandbox', '--disable-setuid-sandbox', '--window-size=375,812']
  });

  const page = await browser.newPage();
  // Standard iPhone DevTools device mode (375x667 @ 2x DPR)
  await page.setViewport({
    width: 375,
    height: 667,
    deviceScaleFactor: 2,
    isMobile: true,
    hasTouch: true
  });

  async function checkIssues(viewName) {
    const report = await page.evaluate((vName) => {
      const docW = document.documentElement.clientWidth;
      const issues = [];
      const allEls = document.querySelectorAll('*');

      for (const el of allEls) {
        const style = window.getComputedStyle(el);
        if (style.display === 'none' || style.visibility === 'hidden' || style.opacity === '0') continue;
        const rect = el.getBoundingClientRect();
        if (rect.width === 0 || rect.height === 0) continue;

        // 1. Right overflow past viewport
        if (rect.right > docW + 2) {
          issues.push({
            type: 'HORIZONTAL_OVERFLOW',
            selector: el.tagName.toLowerCase() + (el.id ? '#' + el.id : '') + (el.className ? '.' + String(el.className).trim().split(/\s+/).slice(0, 2).join('.') : ''),
            right: Math.round(rect.right),
            width: Math.round(rect.width),
            docWidth: docW,
            text: (el.innerText || el.textContent || '').trim().slice(0, 45)
          });
        }

        // 2. Unusably cramped interactive elements (buttons, inputs with height < 26px and width < 26px)
        if (['BUTTON', 'INPUT', 'SELECT'].includes(el.tagName) && rect.height < 24 && rect.width < 24) {
          issues.push({
            type: 'CRAMPED_TARGET',
            selector: el.tagName.toLowerCase() + (el.id ? '#' + el.id : ''),
            height: Math.round(rect.height),
            width: Math.round(rect.width),
            text: (el.innerText || el.value || '').trim().slice(0, 30)
          });
        }
      }
      return issues;
    }, viewName);

    console.log(`\n=== Visual / Layout Inspection for: ${viewName} ===`);
    if (report.length === 0) {
      console.log('-> No overflows or cramped elements detected.');
    } else {
      console.log(`-> Found ${report.length} issue(s):`);
      report.forEach((iss, i) => {
        console.log(`   [${i + 1}] ${iss.type}: ${iss.selector} | Right: ${iss.right}px (max ${iss.docWidth}px) | Text: "${iss.text}"`);
      });
    }
    return report;
  }

  // --- 1. AUTH SCREEN (Login & Signup) ---
  console.log('\n--- 1. Testing Auth Screen ---');
  await page.goto('http://localhost:5173', { waitUntil: 'networkidle0' });
  await page.evaluate(() => localStorage.clear());
  await page.reload({ waitUntil: 'networkidle0' });

  await page.screenshot({ path: path.join(OUT_DIR, '01a_auth_login.png'), fullPage: true });
  await checkIssues('Auth Screen (Login)');

  // Toggle to sign up
  const toggleAuthBtn = await page.$('#btn-auth-toggle');
  if (toggleAuthBtn) {
    await toggleAuthBtn.click();
    await new Promise(r => setTimeout(r, 400));
    await page.screenshot({ path: path.join(OUT_DIR, '01b_auth_signup.png'), fullPage: true });
    await checkIssues('Auth Screen (Signup)');
  }

  // --- 2. AUTHENTICATE & TEST GENERATOR VIEW ---
  console.log('\n--- 2. Testing Generator (Single Idea) View ---');
  await page.evaluate((tok) => {
    localStorage.setItem('ideaforge_token', tok);
    localStorage.setItem('ideaforge_user_email', 'testbeginner@example.com');
  }, token);
  await page.reload({ waitUntil: 'networkidle0' });
  await new Promise(r => setTimeout(r, 600));

  await page.screenshot({ path: path.join(OUT_DIR, '02a_generator_form.png'), fullPage: true });
  await checkIssues('Generator (Single Idea)');

  // --- 3. COMPARE VIEW (Inputs & Side-by-side results) ---
  console.log('\n--- 3. Testing Compare View ---');
  const compareTab = await page.$('#tab-compare-ideas');
  if (compareTab) {
    await compareTab.click();
    await new Promise(r => setTimeout(r, 500));
    await page.screenshot({ path: path.join(OUT_DIR, '03a_compare_inputs.png'), fullPage: true });
    await checkIssues('Compare Ideas View (Inputs)');
  }

  // --- 4. GENERATOR CHAT / CLARIFYING QUESTIONS VIEW ---
  console.log('\n--- 4. Testing Generator Chat (Clarifying Questions) View ---');
  // Switch back to single idea
  const singleTab = await page.$('#tab-single-idea');
  if (singleTab) await singleTab.click();
  await new Promise(r => setTimeout(r, 300));

  // Type an idea and click Generate
  await page.type('#idea-input', 'A micro-habit tracker with streak counters and notifications');
  const startBtn = await page.$('#btn-start');
  if (startBtn) {
    await startBtn.click();
    console.log('Waiting for clarifying chat response...');
    await page.waitForSelector('.message-assistant', { timeout: 25000 }).catch(() => {});
    await new Promise(r => setTimeout(r, 1200));
    await page.screenshot({ path: path.join(OUT_DIR, '02b_generator_chat_clarifying.png'), fullPage: true });
    await checkIssues('Generator Chat Clarifying Questions View');
  }

  // --- 5. HISTORY VIEW ---
  console.log('\n--- 5. Testing History View ---');
  const historyBtn = await page.$('#btn-history');
  if (historyBtn) {
    await historyBtn.click();
    await page.waitForSelector('.history-card, .history-empty-state', { timeout: 8000 }).catch(() => {});
    await new Promise(r => setTimeout(r, 1200));
    await page.screenshot({ path: path.join(OUT_DIR, '04_history_view.png'), fullPage: true });
    await checkIssues('History View');
  }

  // --- 6. FULL ROADMAP VIEW ---
  console.log('\n--- 6. Testing Full Roadmap View (Saved Roadmap) ---');
  await page.evaluate((rm) => {
    localStorage.setItem('ideaforge_active_roadmap', JSON.stringify(rm));
    localStorage.setItem('ideaforge_active_roadmap_id', String(rm.id));
    localStorage.setItem('ideaforge_active_view', 'saved_roadmap');
  }, fullCompositeRoadmap);
  await page.reload({ waitUntil: 'networkidle0' });
  await new Promise(r => setTimeout(r, 1200));

  // Full page screenshot of roadmap
  await page.screenshot({ path: path.join(OUT_DIR, '05_full_roadmap_page.png'), fullPage: true });
  await checkIssues('Full Roadmap (Full Page)');

  // Scroll section by section to inspect closely
  // Section 6.1: Header, Saved Toolbar, Progress Card
  await page.evaluate(() => window.scrollTo(0, 0));
  await new Promise(r => setTimeout(r, 300));
  await page.screenshot({ path: path.join(OUT_DIR, '05a_roadmap_toolbar_and_progress.png') });
  await checkIssues('Roadmap: Toolbar & Progress');

  // Section 6.2: Dropdown Menu open state
  const docsMenuBtn = await page.$('#btn-generate-docs');
  if (docsMenuBtn) {
    await docsMenuBtn.click();
    await new Promise(r => setTimeout(r, 400));
    await page.screenshot({ path: path.join(OUT_DIR, '05b_roadmap_docs_dropdown_open.png') });
    await checkIssues('Roadmap: Documents Dropdown Open');
    // Close dropdown
    await docsMenuBtn.click();
    await new Promise(r => setTimeout(r, 200));
  }

  // Section 6.3: Idea Header, Feasibility & Difficulty Breakdown, Features
  const featSec = await page.$('.roadmap-features-grid') || await page.$('.roadmap-meta-grid');
  if (featSec) {
    await page.evaluate(el => el.scrollIntoView(), featSec);
    await new Promise(r => setTimeout(r, 300));
    await page.screenshot({ path: path.join(OUT_DIR, '05c_roadmap_difficulty_and_features.png') });
    await checkIssues('Roadmap: Difficulty & Features');
  }

  // Section 6.4: Developer Setup Guide
  const setupSec = await page.$('.setup-guide-container');
  if (setupSec) {
    await page.evaluate(el => el.scrollIntoView(), setupSec);
    await new Promise(r => setTimeout(r, 300));
    await page.screenshot({ path: path.join(OUT_DIR, '05d_roadmap_setup_guide.png') });
    await checkIssues('Roadmap: Setup Guide');
  }

  // Section 6.5: Beginner's Guide
  const begSec = await page.$('#beginner-guide-section');
  if (begSec) {
    await page.evaluate(el => el.scrollIntoView(), begSec);
    await new Promise(r => setTimeout(r, 300));
    await page.screenshot({ path: path.join(OUT_DIR, '05e_roadmap_beginners_guide.png') });
    await checkIssues("Roadmap: Beginner's Guide");
  }

  // Section 6.6: Suggested Database Schema
  const schemaSec = await page.$('.suggested-schema-container');
  if (schemaSec) {
    await page.evaluate(el => el.scrollIntoView(), schemaSec);
    await new Promise(r => setTimeout(r, 300));
    await page.screenshot({ path: path.join(OUT_DIR, '05f_roadmap_schema_tables.png') });
    await checkIssues('Roadmap: Database Schema Tables');
  }

  // Section 6.7: Milestones Timeline
  const timelineSec = await page.$('.roadmap-timeline');
  if (timelineSec) {
    await page.evaluate(el => el.scrollIntoView(), timelineSec);
    await new Promise(r => setTimeout(r, 300));
    await page.screenshot({ path: path.join(OUT_DIR, '05g_roadmap_timeline.png') });
    await checkIssues('Roadmap: Timeline Milestones');
  }

  // Section 6.8: Roadmap Chat & Questions
  const chatSec = await page.$('#roadmap-chat-container');
  if (chatSec) {
    await page.evaluate(el => el.scrollIntoView(), chatSec);
    await new Promise(r => setTimeout(r, 300));
    await page.screenshot({ path: path.join(OUT_DIR, '05h_roadmap_chat.png') });
    await checkIssues('Roadmap: Follow-up Chat');
  }

  console.log('\nAll 375px mobile screenshots captured successfully in:', OUT_DIR);
  await browser.close();
}

run().catch(err => {
  console.error('Fatal capture error:', err);
  process.exit(1);
});

import puppeteer from 'puppeteer-core';
import fs from 'fs';
import path from 'path';

const CHROME_PATH = 'C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe';
const OUT_DIR = 'C:\\Users\\Admin\\.gemini\\antigravity-ide\\brain\\ac4236b7-a7fa-44de-b28a-3b55ef18636e\\mobile_375px';

if (!fs.existsSync(OUT_DIR)) {
  fs.mkdirSync(OUT_DIR, { recursive: true });
}

async function run() {
  console.log('Launching browser with Chrome at:', CHROME_PATH);
  const browser = await puppeteer.launch({
    executablePath: CHROME_PATH,
    headless: 'new',
    args: ['--no-sandbox', '--disable-setuid-sandbox', '--window-size=375,812']
  });

  const page = await browser.newPage();
  await page.setViewport({
    width: 375,
    height: 667,
    deviceScaleFactor: 2,
    isMobile: true,
    hasTouch: true
  });

  // Helper to detect overflowing elements
  async function findOverflows(label) {
    const overflows = await page.evaluate(() => {
      const docWidth = document.documentElement.clientWidth;
      const bodyWidth = document.body.clientWidth;
      const issues = [];
      const all = document.querySelectorAll('*');
      for (const el of all) {
        const style = window.getComputedStyle(el);
        if (style.display === 'none' || style.visibility === 'hidden') continue;
        const rect = el.getBoundingClientRect();
        if (rect.width === 0 || rect.height === 0) continue;

        if (rect.right > docWidth + 2) {
          issues.push({
            tag: el.tagName,
            id: el.id,
            className: el.className,
            rectRight: Math.round(rect.right),
            docWidth: docWidth,
            scrollWidth: el.scrollWidth,
            clientWidth: el.clientWidth,
            textSnippet: (el.innerText || el.textContent || '').trim().slice(0, 50)
          });
        }
      }
      return issues;
    });

    console.log(`\n--- Overflow Check [${label}] ---`);
    if (overflows.length === 0) {
      console.log('No elements overflowing past viewport!');
    } else {
      console.log(`Found ${overflows.length} elements overflowing past 375px:`);
      overflows.slice(0, 10).forEach((iss, i) => {
        console.log(`  ${i + 1}. <${iss.tag}> class="${iss.className}" id="${iss.id}" right=${iss.rectRight}px (viewport=${iss.docWidth}px) text="${iss.textSnippet}"`);
      });
    }
    return overflows;
  }

  try {
    // 1. VIEW: Auth Screen
    console.log('Testing View 1: Auth Screen...');
    await page.goto('http://localhost:5173', { waitUntil: 'networkidle0' });
    await page.evaluate(() => {
      localStorage.clear();
    });
    await page.reload({ waitUntil: 'networkidle0' });
    await page.screenshot({ path: path.join(OUT_DIR, '01_auth_screen.png'), fullPage: true });
    await findOverflows('Auth Screen');

    // 2. Log in
    console.log('Logging in to test authenticated views...');
    await page.type('input[type="email"]', 'testbeginner@example.com');
    await page.type('input[type="password"]', 'password123');
    await page.click('button[type="submit"]');
    await new Promise(r => setTimeout(r, 1500));

    // 3. VIEW: Generator View (Initial state)
    console.log('Testing View 2: Generator Initial View...');
    await page.screenshot({ path: path.join(OUT_DIR, '02_generator_initial.png'), fullPage: true });
    await findOverflows('Generator Initial View');

    // 4. VIEW: Compare View
    console.log('Testing View 5: Compare View...');
    const compareBtn = await page.$('#tab-compare');
    if (compareBtn) {
      await compareBtn.click();
      await new Promise(r => setTimeout(r, 500));
      await page.screenshot({ path: path.join(OUT_DIR, '03_compare_view.png'), fullPage: true });
      await findOverflows('Compare View');
      const singleBtn = await page.$('#tab-single');
      if (singleBtn) await singleBtn.click();
      await new Promise(r => setTimeout(r, 500));
    }

    // 5. VIEW: History View
    console.log('Testing View 4: History View...');
    const historyNavBtn = await page.$('#btn-history');
    if (historyNavBtn) {
      await historyNavBtn.click();
      await new Promise(r => setTimeout(r, 1200));
      await page.screenshot({ path: path.join(OUT_DIR, '04_history_view.png'), fullPage: true });
      await findOverflows('History View');

      // Click the first history card to view full roadmap
      const historyCard = await page.$('.history-card');
      if (historyCard) {
        console.log('Selecting first roadmap from History...');
        await historyCard.click();
        await new Promise(r => setTimeout(r, 1500));
      }
    }

    // Check if we are on a roadmap view
    const roadmapSection = await page.$('.roadmap-section');
    if (roadmapSection) {
      console.log('Testing View 3: Full Roadmap View...');
      // Full page screenshot
      await page.screenshot({ path: path.join(OUT_DIR, '05_full_roadmap_page.png'), fullPage: true });
      await findOverflows('Full Roadmap View');

      // Also let's capture specific sections to inspect scroll/cramped details:
      // A. Header & Progress & Action buttons
      await page.evaluate(() => window.scrollTo(0, 0));
      await page.screenshot({ path: path.join(OUT_DIR, '05a_roadmap_top_actions.png') });

      // B. Setup guide & Beginner's guide
      const begGuide = await page.$('#beginner-guide-section');
      if (begGuide) {
        await page.evaluate(el => el.scrollIntoView(), begGuide);
        await new Promise(r => setTimeout(r, 300));
        await page.screenshot({ path: path.join(OUT_DIR, '05b_beginner_guide_mobile.png') });
      }

      // C. Suggested Database Schema
      const schemaSec = await page.$('.suggested-schema-container');
      if (schemaSec) {
        await page.evaluate(el => el.scrollIntoView(), schemaSec);
        await new Promise(r => setTimeout(r, 300));
        await page.screenshot({ path: path.join(OUT_DIR, '05c_schema_section_mobile.png') });
      }

      // D. Milestones Timeline
      const timelineSec = await page.$('.roadmap-timeline');
      if (timelineSec) {
        await page.evaluate(el => el.scrollIntoView(), timelineSec);
        await new Promise(r => setTimeout(r, 300));
        await page.screenshot({ path: path.join(OUT_DIR, '05d_timeline_mobile.png') });
      }

      // E. Roadmap Follow-up Chat
      const chatSec = await page.$('#roadmap-chat-section');
      if (chatSec) {
        await page.evaluate(el => el.scrollIntoView(), chatSec);
        await new Promise(r => setTimeout(r, 300));
        await page.screenshot({ path: path.join(OUT_DIR, '05e_roadmap_chat_mobile.png') });
      }
    }

    console.log('Capture completed! All screenshots saved in:', OUT_DIR);

  } catch (err) {
    console.error('Error in capture script:', err);
  } finally {
    await browser.close();
  }
}

run();

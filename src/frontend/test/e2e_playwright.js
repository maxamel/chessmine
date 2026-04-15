#!/usr/bin/env node
/**
 * E2E test for chessmine.xyz
 *
 * Flow:
 *   1. Player 1 (host): navigates to chessmine.xyz, clicks Play > Invite a Friend > 5+0
 *   2. Player 2 (guest): navigates to the generated invite URL
 *   3. Both players are matched → game starts
 *   4. Verify game board is visible
 *   5. Play 3 moves (e2-e4, e7-e5, d2-d4), measuring server round-trip latency for each
 *   6. Verify all move latencies are within threshold
 *   7. White resigns
 *   8. Verify white sees lose-box and black sees win-box
 *   9. Verify resign message text
 *
 * Exit 0 on pass, exit 1 on any failure.
 * Screenshots are saved to SCREENSHOT_DIR on any error step.
 */
'use strict';

const { chromium } = require('playwright');
const fs = require('fs');
const path = require('path');

const BASE_URL         = 'https://chessmine.xyz';
const MAX_LATENCY_MS   = 1000;   // alert if any move round-trip exceeds this
const SCREENSHOT_DIR   = '/tmp/e2e-screenshots';
const MATCH_TIMEOUT_MS = 10000;  // time to wait for matchmaking

// ─── helpers ──────────────────────────────────────────────────────────────────

function sleep(ms) {
  return new Promise(r => setTimeout(r, ms));
}

async function screenshot(page, label) {
  try {
    fs.mkdirSync(SCREENSHOT_DIR, { recursive: true });
    const file = path.join(SCREENSHOT_DIR, `${label}-${Date.now()}.png`);
    await page.screenshot({ path: file, fullPage: true });
    console.log(`  [screenshot] saved → ${file}`);
  } catch (_) { /* best-effort */ }
}

/**
 * Click a chess square by algebraic notation on a Chessground board.
 * isWhite: true when this player sees white at the bottom.
 */
async function clickSquare(page, square, isWhite) {
  const file  = 'abcdefgh'.indexOf(square[0]); // 0 = a … 7 = h
  const rank  = parseInt(square[1], 10) - 1;   // 0 = rank-1 … 7 = rank-8

  const box = await page.locator('cg-board').boundingBox();
  if (!box) throw new Error('cg-board not found');

  const sq = box.width / 8;
  const col = isWhite ? file       : 7 - file;
  const row = isWhite ? 7 - rank   : rank;

  await page.mouse.click(
    box.x + col * sq + sq / 2,
    box.y + row * sq + sq / 2,
  );
}

async function makeMove(page, from, to, isWhite) {
  await clickSquare(page, from, isWhite);
  await sleep(350);
  await clickSquare(page, to, isWhite);
}

/**
 * Wait until the game has actually started on this page.
 * We detect this by the opponent label being populated
 * (set inside socket.on("game") in game.js).
 */
async function waitForGameStart(page, label, timeoutMs = MATCH_TIMEOUT_MS) {
  console.log(`  [wait] game start on ${label}…`);
  await page.waitForFunction(
    () => {
      const el = document.getElementById('labelTitleA');
      return el && el.innerText && el.innerText.trim().length > 0;
    },
    { timeout: timeoutMs },
  );
  console.log(`  [ok]   game started on ${label}`);
}

/**
 * Determine whether this page's board is oriented with white at the bottom
 * (Chessground adds orientation-white / orientation-black to .cg-wrap).
 */
async function boardIsWhite(page) {
  return page.evaluate(() => {
    const wrap = document.querySelector('.cg-wrap');
    return !!wrap && wrap.classList.contains('orientation-white');
  });
}

// ─── main test ────────────────────────────────────────────────────────────────

async function run() {
  const errors = [];
  let browser;

  try {
    browser = await chromium.launch({ headless: true });

    const ctx1  = await browser.newContext({ viewport: { width: 1280, height: 900 } });
    const ctx2  = await browser.newContext({ viewport: { width: 1280, height: 900 } });
    const page1 = await ctx1.newPage();
    const page2 = await ctx2.newPage();

    // ── 1. Host: home page ─────────────────────────────────────────────────
    console.log('[1] Loading chessmine.xyz (host)…');
    await page1.goto(BASE_URL, { waitUntil: 'domcontentloaded', timeout: 30000 });

    // Wait for the header that is injected via jQuery $.load("html/header.html")
    await page1.waitForSelector('#header .navbar', { timeout: 20000 });
    console.log('[1] Home page ready');

    // Click the "Play" Bootstrap dropdown
    await page1.click('#header a.dropdown-toggle:has-text("Play")');
    await sleep(400);

    // Hover "Invite a Friend" to reveal its CSS sub-menu
    await page1.hover('#header a.nav-link.invite-friend');
    await sleep(400);

    // Click "5 + 0" — force:true bypasses the visibility guard on the sub-menu
    await page1.click('#header a.invite-friend-time:has-text("5 + 0")', { force: true });
    console.log('[1] Clicked Invite a Friend > 5 + 0');

    // Wait for the redirect to /game?waiting_id=…&role=host
    await page1.waitForURL(/\/game\?.*waiting_id=/, { timeout: 20000 });
    const waitingId = new URL(page1.url()).searchParams.get('waiting_id');
    if (!waitingId) throw new Error('waiting_id not found in URL after clicking Invite a Friend');
    console.log(`[1] waiting_id = ${waitingId}`);

    // ── 2. Guest: join via invite URL ──────────────────────────────────────
    const guestUrl = `${BASE_URL}/game?waiting_id=${encodeURIComponent(waitingId)}`;
    console.log(`[2] Guest navigating to ${guestUrl}`);
    await page2.goto(guestUrl, { waitUntil: 'domcontentloaded', timeout: 30000 });
    console.log('[2] Guest page loaded');

    // ── 3. Both matched ────────────────────────────────────────────────────
    console.log('[3] Waiting for matchmaking…');
    await Promise.all([
      waitForGameStart(page1, 'host'),
      waitForGameStart(page2, 'guest'),
    ]);

    // Extra breathing room for Chessground to render fully
    await sleep(800);

    // ── 4. Determine board orientations ───────────────────────────────────
    const p1IsWhite = await boardIsWhite(page1);
    const whitePage = p1IsWhite ? page1 : page2;
    const blackPage = p1IsWhite ? page2 : page1;
    console.log(`[4] host is ${p1IsWhite ? 'WHITE' : 'BLACK'}`);

    // ── 5. Play moves, measure latency ────────────────────────────────────

    // — Move 1: White e2-e4
    console.log('[5] White: e2→e4');
    const t1 = Date.now();
    await makeMove(whitePage, 'e2', 'e4', true);
    // Wait until black's page shows at least one move in the table
    await blackPage.waitForFunction(
      () => {
        const t = document.getElementById('moveTable');
        return t && t.rows.length > 0 && t.rows[0].cells.length >= 2;
      },
      { timeout: MAX_LATENCY_MS },
    ).catch(() => {
      throw new Error(`Move 1 (e2-e4): black page did not update within ${MAX_LATENCY_MS} ms`);
    });
    const latency1 = Date.now() - t1;
    console.log(`     latency: ${latency1} ms`);
    if (latency1 > MAX_LATENCY_MS) errors.push(`Move 1 latency ${latency1} ms exceeds ${MAX_LATENCY_MS} ms`);

    await sleep(500);

    // — Move 2: Black e7-e5
    console.log('[5] Black: e7→e5');
    const t2 = Date.now();
    await makeMove(blackPage, 'e7', 'e5', false);
    // Wait until white's page shows both moves in row 0 (counter + white + black = 3 cells)
    await whitePage.waitForFunction(
      () => {
        const t = document.getElementById('moveTable');
        return t && t.rows.length > 0 && t.rows[0].cells.length >= 3;
      },
      { timeout: MAX_LATENCY_MS },
    ).catch(() => {
      throw new Error(`Move 2 (e7-e5): white page did not update within ${MAX_LATENCY_MS} ms`);
    });
    const latency2 = Date.now() - t2;
    console.log(`     latency: ${latency2} ms`);
    if (latency2 > MAX_LATENCY_MS) errors.push(`Move 2 latency ${latency2} ms exceeds ${MAX_LATENCY_MS} ms`);

    await sleep(500);

    // — Move 3: White d2-d4
    console.log('[5] White: d2→d4');
    const t3 = Date.now();
    await makeMove(whitePage, 'd2', 'd4', true);
    // Second move for white → a new table row should appear
    await blackPage.waitForFunction(
      () => {
        const t = document.getElementById('moveTable');
        return t && t.rows.length >= 2;
      },
      { timeout: MAX_LATENCY_MS },
    ).catch(() => {
      throw new Error(`Move 3 (d2-d4): black page did not update within ${MAX_LATENCY_MS} ms`);
    });
    const latency3 = Date.now() - t3;
    console.log(`     latency: ${latency3} ms`);
    if (latency3 > MAX_LATENCY_MS) errors.push(`Move 3 latency ${latency3} ms exceeds ${MAX_LATENCY_MS} ms`);

    await sleep(500);

    // ── 6. White resigns ──────────────────────────────────────────────────
    console.log('[6] Waiting for resign button to be active…');
    // After ≥2 total moves the game.js enableGameButtons() shows #resignButton
    await whitePage.waitForFunction(
      () => {
        const btn = document.getElementById('resignButton');
        return btn
          && btn.style.display !== 'none'
          && parseFloat(btn.style.opacity || '1') >= 1;
      },
      { timeout: 10000 },
    );
    console.log('[6] Clicking Resign…');
    await whitePage.click('#resignButton');

    // ── 7. Verify endgame boxes ───────────────────────────────────────────
    console.log('[7] Verifying endgame state…');

    await whitePage.waitForSelector('#conty', { state: 'visible', timeout: 12000 })
      .catch(() => { throw new Error('Endgame overlay (#conty) never appeared on white\'s page'); });
    await blackPage.waitForSelector('#conty', { state: 'visible', timeout: 12000 })
      .catch(() => { throw new Error('Endgame overlay (#conty) never appeared on black\'s page'); });

    // White (who resigned) must see #lose-box
    const whiteSeesLose = await whitePage.evaluate(() => {
      const b = document.getElementById('lose-box');
      return b && b.style.display !== 'none';
    });
    if (!whiteSeesLose) {
      await screenshot(whitePage, 'white-endgame-unexpected');
      throw new Error('White should see lose-box after resigning, but it is not visible');
    }

    // Black (who wins) must see #win-box
    const blackSeesWin = await blackPage.evaluate(() => {
      const b = document.getElementById('win-box');
      return b && b.style.display !== 'none';
    });
    if (!blackSeesWin) {
      await screenshot(blackPage, 'black-endgame-unexpected');
      throw new Error('Black should see win-box after opponent resigns, but it is not visible');
    }

    // Check that the message text mentions resignation
    const resignMsg = await whitePage.evaluate(() => {
      const p = document.querySelector('#lose-box .message p');
      return p ? p.textContent.trim() : '';
    });
    console.log(`[7] Resign message: "${resignMsg}"`);
    if (!resignMsg.toLowerCase().includes('resign')) {
      errors.push(`Expected resign message to mention "resign", got: "${resignMsg}"`);
    }

    console.log('[7] Endgame verified ✓');

  } catch (err) {
    errors.push(err.message);
    console.error(`[FAIL] ${err.message}`);
  } finally {
    if (browser) await browser.close();
  }

  if (errors.length > 0) {
    console.error('\nE2E test FAILED:');
    errors.forEach(e => console.error(`  • ${e}`));
    process.exit(1);
  }

  console.log('\nE2E test PASSED ✓');
  process.exit(0);
}

run();

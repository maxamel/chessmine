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
 *  10. Both players accept a rematch
 *  11. Verify the rematched board is fresh, replay the same flow, and verify endgame again
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

async function getPagesByColor(page1, page2) {
  const p1IsWhite = await boardIsWhite(page1);
  return {
    p1IsWhite,
    whitePage: p1IsWhite ? page1 : page2,
    blackPage: p1IsWhite ? page2 : page1,
  };
}

async function waitForMoveTable(page, predicate, timeoutMs, failureMessage) {
  await page.waitForFunction(predicate, { timeout: timeoutMs }).catch(() => {
    throw new Error(failureMessage);
  });
}

async function playOpeningWithLatency(whitePage, blackPage, label, errors) {
  console.log(`[${label}] White: e2→e4`);
  const t1 = Date.now();
  await makeMove(whitePage, 'e2', 'e4', true);
  await waitForMoveTable(
    blackPage,
    () => {
      const t = document.getElementById('moveTable');
      return t && t.rows.length > 0 && t.rows[0].cells.length >= 2;
    },
    MAX_LATENCY_MS,
    `${label} move 1 (e2-e4): black page did not update within ${MAX_LATENCY_MS} ms`,
  );
  const latency1 = Date.now() - t1;
  console.log(`     latency: ${latency1} ms`);
  if (latency1 > MAX_LATENCY_MS) errors.push(`${label} move 1 latency ${latency1} ms exceeds ${MAX_LATENCY_MS} ms`);

  await sleep(500);

  console.log(`[${label}] Black: e7→e5`);
  const t2 = Date.now();
  await makeMove(blackPage, 'e7', 'e5', false);
  await waitForMoveTable(
    whitePage,
    () => {
      const t = document.getElementById('moveTable');
      return t && t.rows.length > 0 && t.rows[0].cells.length >= 3;
    },
    MAX_LATENCY_MS,
    `${label} move 2 (e7-e5): white page did not update within ${MAX_LATENCY_MS} ms`,
  );
  const latency2 = Date.now() - t2;
  console.log(`     latency: ${latency2} ms`);
  if (latency2 > MAX_LATENCY_MS) errors.push(`${label} move 2 latency ${latency2} ms exceeds ${MAX_LATENCY_MS} ms`);

  await sleep(500);

  console.log(`[${label}] White: d2→d4`);
  const t3 = Date.now();
  await makeMove(whitePage, 'd2', 'd4', true);
  await waitForMoveTable(
    blackPage,
    () => {
      const t = document.getElementById('moveTable');
      return t && t.rows.length >= 2;
    },
    MAX_LATENCY_MS,
    `${label} move 3 (d2-d4): black page did not update within ${MAX_LATENCY_MS} ms`,
  );
  const latency3 = Date.now() - t3;
  console.log(`     latency: ${latency3} ms`);
  if (latency3 > MAX_LATENCY_MS) errors.push(`${label} move 3 latency ${latency3} ms exceeds ${MAX_LATENCY_MS} ms`);

  await sleep(500);
}

async function waitForResignButtonActive(page, label) {
  console.log(`[${label}] Waiting for resign button to be active…`);
  await page.waitForFunction(
    () => {
      const btn = document.getElementById('resignButton');
      return btn
        && btn.style.display !== 'none'
        && parseFloat(btn.style.opacity || '1') >= 1;
    },
    { timeout: 10000 },
  );
}

async function verifyEndgameState(whitePage, blackPage, label, errors) {
  console.log(`[${label}] Verifying endgame state…`);

  await whitePage.waitForSelector('#conty', { state: 'visible', timeout: 12000 })
    .catch(() => { throw new Error(`${label}: endgame overlay (#conty) never appeared on white's page`); });
  await blackPage.waitForSelector('#conty', { state: 'visible', timeout: 12000 })
    .catch(() => { throw new Error(`${label}: endgame overlay (#conty) never appeared on black's page`); });

  const whiteEndgame = await whitePage.evaluate(() => {
    const loseBox = document.getElementById('lose-box');
    const winBox = document.getElementById('win-box');
    const title = document.querySelector('#lose-box .message h1');
    const message = document.querySelector('#lose-box .message p');
    return {
      loseVisible: !!loseBox && loseBox.style.display !== 'none',
      winVisible: !!winBox && winBox.style.display !== 'none',
      title: title ? title.textContent.trim() : '',
      message: message ? message.textContent.trim() : '',
    };
  });

  if (!whiteEndgame.loseVisible || whiteEndgame.winVisible) {
    await screenshot(whitePage, `${label}-white-endgame-unexpected`);
    throw new Error(`${label}: white should see only lose-box after resigning`);
  }
  if (!whiteEndgame.title.toLowerCase().includes('lose')) {
    errors.push(`${label}: expected white endgame title to mention loss, got: "${whiteEndgame.title}"`);
  }
  if (!whiteEndgame.message.toLowerCase().includes('resign')) {
    errors.push(`${label}: expected white endgame message to mention "resign", got: "${whiteEndgame.message}"`);
  }

  const blackEndgame = await blackPage.evaluate(() => {
    const winBox = document.getElementById('win-box');
    const loseBox = document.getElementById('lose-box');
    const title = document.querySelector('#win-box .message h1');
    const message = document.querySelector('#win-box .message p');
    return {
      winVisible: !!winBox && winBox.style.display !== 'none',
      loseVisible: !!loseBox && loseBox.style.display !== 'none',
      title: title ? title.textContent.trim() : '',
      message: message ? message.textContent.trim() : '',
    };
  });

  if (!blackEndgame.winVisible || blackEndgame.loseVisible) {
    await screenshot(blackPage, `${label}-black-endgame-unexpected`);
    throw new Error(`${label}: black should see only win-box after opponent resigns`);
  }
  if (!blackEndgame.title.toLowerCase().includes('win')) {
    errors.push(`${label}: expected black endgame title to mention win, got: "${blackEndgame.title}"`);
  }
  if (!blackEndgame.message.toLowerCase().includes('resign')) {
    errors.push(`${label}: expected black endgame message to mention "resign", got: "${blackEndgame.message}"`);
  }

  console.log(`[${label}] Endgame verified ✓`);
}

async function resignAndVerifyEndgame(whitePage, blackPage, label, errors) {
  await waitForResignButtonActive(whitePage, label);
  console.log(`[${label}] Clicking Resign…`);
  await whitePage.click('#resignButton');
  await verifyEndgameState(whitePage, blackPage, label, errors);
}

async function clickVisibleRematchButton(page, label) {
  console.log(`[${label}] Clicking visible rematch button…`);
  const button = page.locator('#conty .endgame-box:visible .button-box').first();
  await button.waitFor({ state: 'visible', timeout: 10000 });
  await button.click();
}

async function waitForFreshGameAfterRematch(page, label) {
  console.log(`  [wait] rematched game ready on ${label}…`);
  await page.waitForFunction(
    () => {
      const overlay = document.getElementById('conty');
      const moveTable = document.getElementById('moveTable');
      const board = document.querySelector('cg-board');
      const overlayHidden = !overlay || overlay.style.display === 'none' || getComputedStyle(overlay).display === 'none';
      const noMoves = !moveTable || moveTable.rows.length === 0;
      return overlayHidden && noMoves && !!board;
    },
    { timeout: MATCH_TIMEOUT_MS },
  );
  console.log(`  [ok]   rematched game ready on ${label}`);
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

    // Hover the Invite a Friend submenu entry by text; the mobile-header refactor
    // removed the old helper class from the desktop nav item.
    await page1.hover('#header #navigator > li.submenu > a.nav-link:has-text("Invite a Friend")');
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

    // ── 4. First game ─────────────────────────────────────────────────────
    let colors = await getPagesByColor(page1, page2);
    console.log(`[4] host is ${colors.p1IsWhite ? 'WHITE' : 'BLACK'}`);
    await playOpeningWithLatency(colors.whitePage, colors.blackPage, 'game 1', errors);
    await resignAndVerifyEndgame(colors.whitePage, colors.blackPage, 'game 1', errors);

    // ── 5. Rematch ────────────────────────────────────────────────────────
    console.log('[5] Requesting rematch on both pages…');
    await Promise.all([
      clickVisibleRematchButton(page1, 'host'),
      clickVisibleRematchButton(page2, 'guest'),
    ]);

    await Promise.all([
      waitForFreshGameAfterRematch(page1, 'host'),
      waitForFreshGameAfterRematch(page2, 'guest'),
    ]);

    // Rematch may swap colors, so re-detect orientation before moving.
    colors = await getPagesByColor(page1, page2);
    console.log(`[5] after rematch host is ${colors.p1IsWhite ? 'WHITE' : 'BLACK'}`);

    // ── 6. Rematched game ─────────────────────────────────────────────────
    await playOpeningWithLatency(colors.whitePage, colors.blackPage, 'game 2 rematch', errors);
    await resignAndVerifyEndgame(colors.whitePage, colors.blackPage, 'game 2 rematch', errors);

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

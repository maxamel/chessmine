var stockfish = null;
var currentSkillLevel = 5; // Default skill level, updated when user changes it
var cachedDeviceScore = null;

const BASE_MOVE_TIME_MS = 1000;
const MIN_MOVE_TIME_MS = 500
const MAX_MOVE_TIME_MS = 5000
const DEVICE_BENCHMARK_MS = 90;
const DEVICE_SCORE_CACHE_KEY = 'stockfish_device_score_v1';
const DEVICE_SCORE_CACHE_TTL_MS = 7 * 24 * 60 * 60 * 1000;
const REFERENCE_DEVICE_SCORE = 150000;

function stockfish_load() {
  if (!stockfish) {
    console.log('Initializing stockfish');
    stockfish = new Worker("./stockfish.js");
  }
  return stockfish;
}

function clamp(value, min, max) {
    return Math.max(min, Math.min(max, value));
}

function nowMs() {
    return (window.performance && typeof window.performance.now === 'function') ? window.performance.now() : Date.now();
}

function getStockfishThreadCount() {
  let hardwareThreads = window.navigator.hardwareConcurrency || 1;
  return clamp(hardwareThreads, 1, 4);
}

function readCachedDeviceScore() {
    try {
        let cached = JSON.parse(window.localStorage.getItem(DEVICE_SCORE_CACHE_KEY));
        if (!cached || !cached.score || !cached.measuredAt) {
            return null;
        }
        if (Date.now() - cached.measuredAt > DEVICE_SCORE_CACHE_TTL_MS) {
            return null;
        }
        return cached.score;
    } catch (e) {
        return null;
    }
}

function writeCachedDeviceScore(score) {
    try {
        window.localStorage.setItem(DEVICE_SCORE_CACHE_KEY, JSON.stringify({
            score: score,
            measuredAt: Date.now()
        }));
    } catch (e) {
        // Private browsing or disabled storage should not affect engine play.
    }
}

function measureDeviceScore() {
    let startedAt = nowMs();
    let iterations = 0;
    let seed = 1;

    while (nowMs() - startedAt < DEVICE_BENCHMARK_MS) {
        for (let i = 0; i < 1000; i++) {
            seed = (Math.imul(seed, 1664525) + 1013904223) | 0;
            iterations++;
        }
    }

    let elapsedMs = Math.max(1, nowMs() - startedAt);
    let score = Math.max(1, Math.round(iterations / elapsedMs));
    console.log('Measured Stockfish device score: ' + score + ' ops/ms');
    return score;
}

function getDeviceScore() {
    if (cachedDeviceScore !== null) {
        return cachedDeviceScore;
    }

    cachedDeviceScore = readCachedDeviceScore();
    if (cachedDeviceScore === null) {
        cachedDeviceScore = measureDeviceScore();
        writeCachedDeviceScore(cachedDeviceScore);
    }
    return cachedDeviceScore;
}

function getCalibratedMoveTime() {
    let deviceScore = getDeviceScore();
    let threadFactor = Math.sqrt(getStockfishThreadCount());
    let effectiveScore = Math.max(1, deviceScore * threadFactor);
    let moveTime = Math.round(BASE_MOVE_TIME_MS * REFERENCE_DEVICE_SCORE / effectiveScore);
    return clamp(moveTime, MIN_MOVE_TIME_MS, MAX_MOVE_TIME_MS);
}

function stockfish_start(fen, rating, customSkillLevel = null) {
  let threads = getStockfishThreadCount();
    
  // Use custom skill level if provided, otherwise use stored level
  if (customSkillLevel !== null) {
    currentSkillLevel = customSkillLevel;
  }

  console.log('Loading stockfish with fen: ' + fen + ', skill level ' + currentSkillLevel + ', threads ' + threads);

  stockfish.postMessage('uci');
  stockfish.postMessage('ucinewgame');
  stockfish.postMessage(`setoption name Threads value ${threads}`);
  stockfish.postMessage(`setoption name Skill Level value ${currentSkillLevel}`);
  stockfish.postMessage(`position startpos fen ${fen}`);
  stockfish.postMessage('isready');
}

function stockfish_move(fen) {
    let movetime = getCalibratedMoveTime();
    // Apply the current skill level before each move to ensure it's always set
    stockfish.postMessage(`setoption name Skill Level value ${currentSkillLevel}`);
    stockfish.postMessage(`position fen ${fen}`);
    console.log('Requesting Stockfish move with calibrated movetime: ' + movetime + 'ms');
    stockfish.postMessage(`go movetime ${movetime}`);
}

function stockfish_set_skill_level(skillLevel) {
    // Just store the skill level, don't send to engine yet
    // It will be applied on the next move via stockfish_move()
    currentSkillLevel = skillLevel;
    console.log('Skill level set to: ' + skillLevel + ' (will apply on next engine move)');
}

export { stockfish_load, stockfish_move, stockfish_start, stockfish_set_skill_level }

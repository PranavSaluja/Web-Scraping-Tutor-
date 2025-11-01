// src/scraper.js
// Usage: node src/scraper.js SPARK
// Requires: src/jiraClient.js (implemented earlier)

const fs = require('fs').promises;
const path = require('path');


const { searchIssues, DEFAULT_MAX_RESULTS } = require('./jiraClient');

const DEFAULT_MAX_RESULTS_LOCAL = DEFAULT_MAX_RESULTS || 50;
const POLITE_DELAY_MS = 350; // adjust upward if you encounter 429

function sleep(ms) {
  return new Promise((res) => setTimeout(res, ms));
}

async function ensureDir(dir) {
    // fs is already required at top as: const fs = require('fs').promises;
    try {
      await fs.mkdir(dir, { recursive: true });
    } catch (err) {
      // In rare cases, race conditions may cause EEXIST - ignore it
      if (err.code !== 'EEXIST') throw err;
    }
  }
  

async function loadCheckpoint(projectKey) {
  const fp = path.join('checkpoints', `${projectKey}.json`);
  try {
    const raw = await fs.readFile(fp, 'utf8');
    return JSON.parse(raw);
  } catch (e) {
    return { startAt: 0 };
  }
}

async function saveCheckpoint(projectKey, obj) {
  await ensureDir('checkpoints');
  const fp = path.join('checkpoints', `${projectKey}.json`);
  await fs.writeFile(fp, JSON.stringify(obj, null, 2), 'utf8');
}

async function saveRawPage(projectKey, startAt, data) {
  const dir = path.join('raw', projectKey);
  await ensureDir(dir);
  const fp = path.join(dir, `page_${startAt}.json`);
  await fs.writeFile(fp, JSON.stringify(data, null, 2), 'utf8');
  console.log(`Saved raw/${projectKey}/page_${startAt}.json`);
}

async function scrapeProject(projectKey, {
  maxResults = DEFAULT_MAX_RESULTS_LOCAL,
  politeDelayMs = POLITE_DELAY_MS
} = {}) {
  console.log(`Starting scrape for project=${projectKey}`);
  const cp = await loadCheckpoint(projectKey);
  let startAt = cp.startAt || 0;
  let total = Infinity;
  let pageCount = 0;

  while (startAt < total) {
    const jql = `project=${projectKey} ORDER BY created DESC`;
    console.log(`Fetching page for ${projectKey} startAt=${startAt}`);

    try {
      const resp = await searchIssues({ jql, startAt, maxResults });
      // resp should contain: startAt, maxResults, total, issues[]
      if (!resp || !Array.isArray(resp.issues)) {
        console.warn(`Malformed response at startAt=${startAt}. Saving raw and advancing.`);
        await saveRawPage(projectKey, startAt, resp || { malformed: true });
        startAt += maxResults;
        await saveCheckpoint(projectKey, { startAt });
        // polite delay before next attempt
        await sleep(politeDelayMs);
        continue;
      }

      await saveRawPage(projectKey, startAt, resp);

      total = typeof resp.total === 'number' ? resp.total : total;
      console.log(`Fetched ${resp.issues.length} issues; total=${total}`);

      // advance checkpoint AFTER we saved raw page
      startAt += maxResults;
      await saveCheckpoint(projectKey, { startAt });
      pageCount += 1;

      // polite delay to avoid throttling
      await sleep(politeDelayMs);
    } catch (err) {
      console.error(`Error fetching ${projectKey} at startAt=${startAt}:`, err.message || err);
      console.error('Waiting a bit before retrying...');
      // small wait; jiraClient already has retry logic but network or unknown errors may occur
      await sleep(2000);
      // do not advance startAt; we'll retry this page
    }
  }

  console.log(`Completed scraping project=${projectKey}. Pages fetched: ${pageCount}.`);
}

// CLI Entrypoint
async function main() {
  const projectKey = process.argv[2];
  if (!projectKey) {
    console.error('Usage: node src/scraper.js <PROJECT_KEY>');
    console.error('Examples: SPARK KAFKA AIRFLOW');
    process.exit(1);
  }
  await scrapeProject(projectKey);
}

if (require.main === module) {
  main().catch((err) => {
    console.error('Fatal error in scraper:', err);
    process.exit(1);
  });
}

module.exports = { scrapeProject };

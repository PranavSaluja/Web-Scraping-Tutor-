// src/transformer.js
// Usage: node src/transformer.js SPARK
const fs = require('fs');
const fsp = require('fs').promises;
const path = require('path');
const glob = require('glob');
const { toPlainText } = require('./utils/htmlToText');

async function ensureDir(dir) {
  try {
    await fsp.mkdir(dir, { recursive: true });
  } catch (e) {
    if (e.code !== 'EEXIST') throw e;
  }
}

function sortPageFiles(files) {
  // files like raw/SPARK/page_0.json, page_50.json
  return files.sort((a, b) => {
    const na = Number(path.basename(a).replace(/[^0-9]/g, '') || 0);
    const nb = Number(path.basename(b).replace(/[^0-9]/g, '') || 0);
    return na - nb;
  });
}

function buildOutputObject(projectKey, issue) {
  const fields = issue.fields || {};
  const safe = v => (v === null || v === undefined) ? null : v;

  const assignee = fields.assignee ? (fields.assignee.displayName || fields.assignee.name || null) : null;
  const reporter = fields.reporter ? (fields.reporter.displayName || fields.reporter.name || null) : null;
  const priority = fields.priority ? (fields.priority.name || null) : null;
  const status = fields.status ? (fields.status.name || null) : null;

  const description_raw = fields.description || '';
  const description_plain = toPlainText(description_raw);

  const comments_arr = [];
  if (fields.comment && Array.isArray(fields.comment.comments)) {
    for (const c of fields.comment.comments) {
      // comment body may be HTML
      const body = c.body || '';
      comments_arr.push(toPlainText(body));
    }
  }

  return {
    issue_id: issue.key,
    project: projectKey,
    title: safe(fields.summary) || '',
    status,
    priority,
    assignee,
    reporter,
    labels: Array.isArray(fields.labels) ? fields.labels : [],
    created_at: fields.created || null,
    updated_at: fields.updated || null,
    description_plaintext: description_plain,
    comments_plaintext: comments_arr,
    derived: {
      // keep this minimal for now; you can add summary/classification later
      summary: (description_plain.split('\n')[0] || '').slice(0, 200)
    }
  };
}

async function transformProject(projectKey) {
  const rawDir = path.join('raw', projectKey);
  const outDir = 'out';
  await ensureDir(outDir);

  // find raw files
  const pattern = path.join(rawDir, 'page_*.json');
  const files = glob.sync(pattern);
  if (!files || files.length === 0) {
    console.error(`No raw files found for project ${projectKey} in ${rawDir}`);
    process.exit(1);
  }

  const sorted = sortPageFiles(files);
  const outPath = path.join(outDir, `${projectKey}.jsonl`);
  // open append stream
  const stream = fs.createWriteStream(outPath, { flags: 'a' });

  // dedupe by issue key within this run
  const seen = new Set();

  for (const file of sorted) {
    console.log('Processing', file);
    try {
      const raw = await fsp.readFile(file, 'utf8');
      const page = JSON.parse(raw);
      if (!page || !Array.isArray(page.issues)) {
        console.warn('Skipping malformed page file:', file);
        continue;
      }
      for (const issue of page.issues) {
        const key = issue.key;
        if (seen.has(key)) continue;
        seen.add(key);
        const obj = buildOutputObject(projectKey, issue);
        stream.write(JSON.stringify(obj) + '\n');
      }
    } catch (e) {
      console.error('Error processing file', file, e.message);
      // continue processing next files
    }
  }

  stream.end();
  console.log(`Transformation complete. Output at ${outPath}`);
}

// CLI
if (require.main === module) {
  const projectKey = process.argv[2];
  if (!projectKey) {
    console.error('Usage: node src/transformer.js <PROJECT_KEY>');
    process.exit(1);
  }
  transformProject(projectKey).catch(err => {
    console.error('Fatal transformer error:', err);
    process.exit(1);
  });
}

module.exports = { transformProject };

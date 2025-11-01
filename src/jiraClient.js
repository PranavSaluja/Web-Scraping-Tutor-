// src/jiraClient.js
// Node 14+
// npm install axios

const axios = require('axios');

const BASE_URL = 'https://issues.apache.org/jira/rest/api/2';
const DEFAULT_FIELDS = [
  'summary',
  'description',
  'comment',
  'priority',
  'status',
  'assignee',
  'reporter',
  'labels',
  'created',
  'updated'
].join(',');
const DEFAULT_MAX_RESULTS = 50;
const REQUEST_TIMEOUT_MS = 20000;
const MAX_RETRY_ATTEMPTS = 5;
const BASE_BACKOFF_MS = 500; // base for exponential backoff
const JITTER_MS = 300; // random jitter

function sleep(ms) {
  return new Promise((res) => setTimeout(res, ms));
}

function buildAxiosConfig() {
  return {
    timeout: REQUEST_TIMEOUT_MS,
    headers: {
      'Accept': 'application/json',
      'User-Agent': 'jira-scraper/0.1 (+https://github.com/your-username)'
    }
  };
}

async function fetchWithRetry(url, axiosConfig = {}, maxAttempts = MAX_RETRY_ATTEMPTS) {
  let attempt = 0;
  while (attempt < maxAttempts) {
    attempt += 1;
    try {
      // eslint-disable-next-line no-await-in-loop
      const res = await axios.get(url, { ...buildAxiosConfig(), ...axiosConfig });
      return res;
    } catch (err) {
      const status = err.response && err.response.status;
      // If 429 and Retry-After header present -> use it
      if (status === 429) {
        const ra = err.response.headers && err.response.headers['retry-after'];
        const wait = ra ? (parseInt(ra, 10) * 1000) : (BASE_BACKOFF_MS * Math.pow(2, attempt - 1) + Math.floor(Math.random() * JITTER_MS));
        console.warn(`[jiraClient] 429 received. attempt ${attempt}/${maxAttempts}. Waiting ${wait}ms before retry.`);
        // eslint-disable-next-line no-await-in-loop
        await sleep(wait);
      } else if (status && status >= 500 && status < 600) {
        // Server errors: exponential backoff with jitter
        const wait = BASE_BACKOFF_MS * Math.pow(2, attempt - 1) + Math.floor(Math.random() * JITTER_MS);
        console.warn(`[jiraClient] ${status} server error. attempt ${attempt}/${maxAttempts}. Backing off ${wait}ms.`);
        // eslint-disable-next-line no-await-in-loop
        await sleep(wait);
      } else if (!status) {
        // Network / timeout
        const wait = BASE_BACKOFF_MS * Math.pow(2, attempt - 1) + Math.floor(Math.random() * JITTER_MS);
        console.warn(`[jiraClient] Network/error (no status). attempt ${attempt}/${maxAttempts}. Backing off ${wait}ms. Err: ${err.message}`);
        // eslint-disable-next-line no-await-in-loop
        await sleep(wait);
      } else {
        // 4xx other than 429 -> don't retry (client error)
        const info = `Request failed with status ${status}. URL: ${url}`;
        const e = new Error(info);
        e.status = status;
        e.attempts = attempt;
        throw e;
      }

      if (attempt >= maxAttempts) {
        const info = `Max attempts reached (${maxAttempts}) for URL: ${url}`;
        const e = new Error(info);
        e.status = status || 'network';
        e.attempts = attempt;
        throw e;
      }
    }
  }
  // should not reach here
  throw new Error('Unexpected fetchWithRetry exit');
}

function encodeParams(params = {}) {
  const esc = encodeURIComponent;
  return Object.keys(params)
    .map(k => `${esc(k)}=${esc(params[k])}`)
    .join('&');
}

/**
 * searchIssues
 * @param {Object} opts
 * @param {string} opts.jql - JQL string, required
 * @param {number} [opts.startAt=0]
 * @param {number} [opts.maxResults=DEFAULT_MAX_RESULTS]
 * @param {string} [opts.fields=DEFAULT_FIELDS]
 */
async function searchIssues({ jql, startAt = 0, maxResults = DEFAULT_MAX_RESULTS, fields = DEFAULT_FIELDS }) {
  if (!jql) throw new Error('searchIssues requires jql');
  const params = {
    jql,
    startAt,
    maxResults,
    fields
  };
  const url = `${BASE_URL}/search?${encodeParams(params)}`;
  const res = await fetchWithRetry(url);
  return res.data;
}

/**
 * getIssue
 * @param {string} issueKey
 * @param {Object} opts
 * @param {string} [opts.fields=DEFAULT_FIELDS]
 */
async function getIssue(issueKey, { fields = DEFAULT_FIELDS } = {}) {
  if (!issueKey) throw new Error('getIssue requires issueKey');
  const url = `${BASE_URL}/issue/${encodeURIComponent(issueKey)}?fields=${encodeURIComponent(fields)}`;
  const res = await fetchWithRetry(url);
  return res.data;
}

/**
 * getIssueComments
 * @param {string} issueKey
 * @param {Object} opts
 * @param {number} [opts.startAt=0]
 * @param {number} [opts.maxResults=50]
 */
async function getIssueComments(issueKey, { startAt = 0, maxResults = 50 } = {}) {
  if (!issueKey) throw new Error('getIssueComments requires issueKey');
  const params = { startAt, maxResults };
  const url = `${BASE_URL}/issue/${encodeURIComponent(issueKey)}/comment?${encodeParams(params)}`;
  const res = await fetchWithRetry(url);
  return res.data;
}

module.exports = {
  searchIssues,
  getIssue,
  getIssueComments,
  // export constants for use elsewhere
  DEFAULT_FIELDS,
  DEFAULT_MAX_RESULTS
};

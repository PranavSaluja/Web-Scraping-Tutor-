const jc = require('./jiraClient');

async function test() {
  const r = await jc.searchIssues({ jql: 'project=SPARK', maxResults: 3 });
  console.log('issues:', r.issues.length, 'total:', r.total);
  if (r.issues.length) {
    console.log('fields of first issue:', Object.keys(r.issues[0].fields || {}));
    const key = r.issues[0].key;
    const issue = await jc.getIssue(key);
    console.log('got issue:', issue.key, issue.fields.summary);
    const cm = await jc.getIssueComments(key);
    console.log('comments count:', cm.total || (cm.comments && cm.comments.length));
  }
}
test().catch(e => console.error('ERR', e.message, e.status, e.attempts));

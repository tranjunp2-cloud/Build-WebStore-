#!/usr/bin/env node
/**
 * Collect team metrics from GitHub API
 * Used by weekly-metrics.yml
 *
 * Usage:
 *   node collect-metrics.js --repo "owner/repo" --period 7
 *
 * Requires GITHUB_TOKEN env var
 *
 * Output: JSON with raw data + formatted Lark card content
 */

const { argv } = process;

const args = argv.slice(2);
const repoArg = args[args.indexOf('--repo') + 1] || '';
const period = parseInt(args[args.indexOf('--period') + 1]) || 7;

const [owner, repo] = repoArg.split('/');
const token = process.env.GITHUB_TOKEN;

if (!owner || !repo || !token) {
  console.error('Usage: GITHUB_TOKEN=xxx node collect-metrics.js --repo "owner/repo" --period 7');
  process.exit(1);
}

const headers = {
  Authorization: `Bearer ${token}`,
  Accept: 'application/vnd.github+json',
  'X-GitHub-Api-Version': '2022-11-28',
};

async function fetchJSON(url) {
  const resp = await fetch(url, { headers });
  if (!resp.ok) throw new Error(`GitHub API ${resp.status}: ${url}`);
  return resp.json();
}

async function fetchAllPages(baseUrl, params = {}) {
  const results = [];
  let page = 1;
  const maxPages = 5;

  while (page <= maxPages) {
    const url = new URL(baseUrl);
    url.searchParams.set('per_page', '100');
    url.searchParams.set('page', String(page));
    for (const [k, v] of Object.entries(params)) {
      url.searchParams.set(k, v);
    }

    const data = await fetchJSON(url.toString());
    if (!Array.isArray(data) || data.length === 0) break;
    results.push(...data);
    if (data.length < 100) break;
    page++;
  }

  return results;
}

async function main() {
  const since = new Date();
  since.setDate(since.getDate() - period);
  const sinceISO = since.toISOString();

  // ── Collect commits ──
  const commits = await fetchAllPages(
    `https://api.github.com/repos/${owner}/${repo}/commits`,
    { since: sinceISO }
  );

  const commitsByAuthor = {};
  for (const c of commits) {
    const author = c.author?.login || c.commit?.author?.name || 'unknown';
    commitsByAuthor[author] = (commitsByAuthor[author] || 0) + 1;
  }

  // ── Collect PRs ──
  const allPRs = await fetchAllPages(
    `https://api.github.com/repos/${owner}/${repo}/pulls`,
    { state: 'all', sort: 'updated', direction: 'desc' }
  );

  const recentPRs = allPRs.filter(pr => new Date(pr.updated_at) >= since);
  const mergedPRs = recentPRs.filter(pr => pr.merged_at && new Date(pr.merged_at) >= since);
  const openPRs = recentPRs.filter(pr => pr.state === 'open');

  // PRs by author
  const prsByAuthor = {};
  for (const pr of mergedPRs) {
    const author = pr.user?.login || 'unknown';
    prsByAuthor[author] = (prsByAuthor[author] || 0) + 1;
  }

  // Average review time (request → first review)
  let totalReviewTime = 0;
  let reviewCount = 0;
  for (const pr of mergedPRs.slice(0, 20)) {
    try {
      const reviews = await fetchJSON(
        `https://api.github.com/repos/${owner}/${repo}/pulls/${pr.number}/reviews`
      );
      if (reviews.length > 0) {
        const firstReview = new Date(reviews[0].submitted_at);
        const prCreated = new Date(pr.created_at);
        const diffHours = (firstReview - prCreated) / (1000 * 60 * 60);
        if (diffHours > 0 && diffHours < 168) { // Cap at 1 week
          totalReviewTime += diffHours;
          reviewCount++;
        }
      }
    } catch {
      // Skip if review fetch fails
    }
  }
  const avgReviewHours = reviewCount > 0 ? (totalReviewTime / reviewCount).toFixed(1) : 'N/A';

  // ── CI pass rate ──
  let ciPassRate = 'N/A';
  try {
    const runs = await fetchJSON(
      `https://api.github.com/repos/${owner}/${repo}/actions/workflows/ci.yml/runs?per_page=30&created=>${sinceISO.split('T')[0]}`
    );
    if (runs.workflow_runs?.length > 0) {
      const total = runs.workflow_runs.length;
      const passed = runs.workflow_runs.filter(r => r.conclusion === 'success').length;
      ciPassRate = `${Math.round((passed / total) * 100)}%`;
    }
  } catch {
    // CI data unavailable
  }

  // ── Issues ──
  const openIssues = await fetchAllPages(
    `https://api.github.com/repos/${owner}/${repo}/issues`,
    { state: 'open', labels: 'user-story' }
  );

  const closedIssues = await fetchAllPages(
    `https://api.github.com/repos/${owner}/${repo}/issues`,
    { state: 'closed', labels: 'user-story', since: sinceISO }
  );

  // Filter out PRs from issues
  const openStories = openIssues.filter(i => !i.pull_request);
  const closedStories = closedIssues.filter(i => !i.pull_request);

  // ── Compute scores ──
  const completionRate = openStories.length + closedStories.length > 0
    ? Math.round((closedStories.length / (openStories.length + closedStories.length)) * 100)
    : 0;

  // Review time score: 100 if <4h, 50 if <8h, 0 if >8h
  let reviewScore = 0;
  if (avgReviewHours !== 'N/A') {
    const hours = parseFloat(avgReviewHours);
    if (hours < 4) reviewScore = 100;
    else if (hours < 8) reviewScore = 50;
  }

  // ── All unique contributors ──
  const allAuthors = new Set([
    ...Object.keys(commitsByAuthor),
    ...Object.keys(prsByAuthor),
  ]);

  // ── Build per-member table ──
  const memberMetrics = [];
  for (const author of allAuthors) {
    memberMetrics.push({
      member: author,
      commits: commitsByAuthor[author] || 0,
      prsMerged: prsByAuthor[author] || 0,
    });
  }
  memberMetrics.sort((a, b) => b.commits - a.commits);

  // ── Build Lark report content ──
  let larkContent = `**Period:** Last ${period} days\n\n`;

  // Team summary
  larkContent += `**Team Summary**\n`;
  larkContent += `Commits: ${commits.length} | PRs Merged: ${mergedPRs.length} | PRs Open: ${openPRs.length}\n`;
  larkContent += `Avg Review Time: ${avgReviewHours}h | CI Pass Rate: ${ciPassRate}\n`;
  larkContent += `Stories Done: ${closedStories.length} | Stories Open: ${openStories.length} | Completion: ${completionRate}%\n\n`;

  // Per member
  larkContent += `**Per Member**\n`;
  for (const m of memberMetrics) {
    larkContent += `@${m.member}: ${m.commits} commits, ${m.prsMerged} PRs merged\n`;
  }

  // ── Output ──
  const output = {
    period,
    generatedAt: new Date().toISOString(),
    summary: {
      totalCommits: commits.length,
      totalPRsMerged: mergedPRs.length,
      totalPRsOpen: openPRs.length,
      avgReviewTimeHours: avgReviewHours,
      ciPassRate,
      storiesClosed: closedStories.length,
      storiesOpen: openStories.length,
      completionRate: `${completionRate}%`,
      reviewScore,
    },
    members: memberMetrics,
    larkContent,
  };

  console.log(JSON.stringify(output, null, 2));
}

main().catch(e => {
  console.error('Error:', e.message);
  process.exit(1);
});

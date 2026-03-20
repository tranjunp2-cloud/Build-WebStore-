#!/usr/bin/env node
/**
 * Generate changelog from Conventional Commits
 * Used by release-changelog.yml
 *
 * Usage:
 *   node generate-changelog.js --from "v0.1.0" --to "HEAD"
 *
 * Output:
 *   - Changelog markdown to stdout
 *   - NEW_VERSION written to .new-version file
 */

const { execSync } = require('child_process');
const { argv } = process;
const fs = require('fs');

const args = argv.slice(2);
const fromRef = args[args.indexOf('--from') + 1] || 'v0.0.0';
const toRef = args[args.indexOf('--to') + 1] || 'HEAD';

// Conventional Commits regex (matches commitlint.config.js types)
const CC_RE = /^(feat|fix|docs|style|refactor|perf|test|build|ci|chore)(\(.+?\))?(!)?:\s+(.+)$/;

const TYPE_LABELS = {
  feat: 'Features',
  fix: 'Bug Fixes',
  docs: 'Documentation',
  style: 'Styles',
  refactor: 'Refactoring',
  perf: 'Performance',
  test: 'Tests',
  build: 'Build',
  ci: 'CI/CD',
  chore: 'Chores',
};

// Display order (most important first)
const TYPE_ORDER = ['feat', 'fix', 'perf', 'refactor', 'docs', 'test', 'ci', 'build', 'style', 'chore'];

function getCommits() {
  try {
    const range = fromRef === 'v0.0.0' ? toRef : `${fromRef}..${toRef}`;
    const log = execSync(
      `git log ${range} --format="%H|||%s|||%an" --no-merges`,
      { encoding: 'utf-8' }
    ).trim();

    if (!log) return [];

    return log.split('\n').map(line => {
      const [hash, subject, author] = line.split('|||');
      return { hash: hash?.trim(), subject: subject?.trim(), author: author?.trim() };
    }).filter(c => c.hash && c.subject);
  } catch {
    return [];
  }
}

function parseCommit(commit) {
  const match = commit.subject.match(CC_RE);
  if (!match) return null;

  return {
    type: match[1],
    scope: match[2] ? match[2].slice(1, -1) : null,
    breaking: !!match[3],
    description: match[4],
    hash: commit.hash,
    shortHash: commit.hash?.substring(0, 7),
    author: commit.author,
  };
}

function computeVersion(commits, currentVersion) {
  const [major, minor, patch] = currentVersion.replace('v', '').split('.').map(Number);

  const hasBreaking = commits.some(c => c.breaking);
  const hasFeat = commits.some(c => c.type === 'feat');
  const hasFix = commits.some(c => ['fix', 'perf'].includes(c.type));

  if (hasBreaking) return `${major + 1}.0.0`;
  if (hasFeat) return `${major}.${minor + 1}.0`;
  if (hasFix) return `${major}.${minor}.${patch + 1}`;
  return `${major}.${minor}.${patch + 1}`; // Default: patch bump
}

function main() {
  const rawCommits = getCommits();

  if (rawCommits.length === 0) {
    console.error('No commits found in range');
    process.exit(1);
  }

  const parsed = rawCommits.map(parseCommit).filter(Boolean);
  const unparsed = rawCommits.filter(c => !parseCommit(c));

  if (parsed.length === 0) {
    console.error('No conventional commits found');
    process.exit(1);
  }

  // Compute new version
  const newVersion = computeVersion(parsed, fromRef);
  fs.writeFileSync('.new-version', newVersion);

  // Group by type
  const grouped = {};
  for (const c of parsed) {
    if (!grouped[c.type]) grouped[c.type] = [];
    grouped[c.type].push(c);
  }

  // Build changelog
  const date = new Date().toISOString().split('T')[0];
  const lines = [`# v${newVersion} (${date})`, ''];

  // Breaking changes first
  const breaking = parsed.filter(c => c.breaking);
  if (breaking.length > 0) {
    lines.push('## BREAKING CHANGES');
    for (const c of breaking) {
      const scope = c.scope ? `**${c.scope}:** ` : '';
      lines.push(`- ${scope}${c.description} (${c.shortHash})`);
    }
    lines.push('');
  }

  // Grouped by type
  for (const type of TYPE_ORDER) {
    if (!grouped[type]) continue;

    lines.push(`## ${TYPE_LABELS[type]}`);
    for (const c of grouped[type]) {
      const scope = c.scope ? `**${c.scope}:** ` : '';
      lines.push(`- ${scope}${c.description} (${c.shortHash})`);
    }
    lines.push('');
  }

  // Contributors
  const contributors = [...new Set(parsed.map(c => c.author))].sort();
  if (contributors.length > 0) {
    lines.push('## Contributors');
    lines.push(contributors.map(c => `- ${c}`).join('\n'));
    lines.push('');
  }

  // Stats
  lines.push('---');
  lines.push(`_${parsed.length} commits from ${contributors.length} contributor(s)_`);

  console.log(lines.join('\n'));
}

main();

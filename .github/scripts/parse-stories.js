#!/usr/bin/env node
/**
 * Parse User Stories from docs/stories/*.md into structured JSON
 * Used by story-sync.yml to auto-create GitHub Issues
 *
 * Usage:
 *   node parse-stories.js --files "docs/stories/F09-products-crud-stories.md,docs/stories/F02-auth-stories.md"
 *   node parse-stories.js --all    # Parse all story files
 *
 * Output: JSON array to stdout
 */

const fs = require('fs');
const path = require('path');
const { argv } = process;

// ── Regex patterns (verified against actual story file format) ──

// Feature header: "> **Feature:** F09 — Products CRUD"
const FEATURE_RE = />\s*\*\*Feature:\*\*\s*(F\d+)\s*[—–-]\s*(.+)/;

// Feature wave/priority: "> **Wave:** 4 | **Priority:** P0 | **Ref PRD:** [link](path)"
const FEATURE_META_RE = />\s*\*\*Wave:\*\*\s*(\d+)\s*\|\s*\*\*Priority:\*\*\s*(P\d)/;

// PRD reference link: "[F09-products-crud.md](../prd/F09-products-crud.md)"
const PRD_LINK_RE = /\[([^\]]+)\]\(([^)]+)\)/;

// Story heading: "## US-007: Products — CRUD + AI Description"
const STORY_HEADING_RE = /^##\s+(US-[\w-]+):\s*(.+?)(?:\s*[⭐🆕]+)?$/m;

// Story metadata: "**Wave 4** | **P0** | **L** | Status: Draft"
const STORY_META_RE = /\*\*Wave\s+(\d+)\*\*\s*\|\s*\*\*(P\d)\s*[🌟]*\*\*\s*\|\s*\*\*(XS|S|M|L|XL)\*\*\s*\|\s*Status:\s*(.+)/;

// Code block content
const CODE_BLOCK_RE = /```(?:\w*)\s*\n([\s\S]*?)```/;

function parseStoryFile(filePath) {
  const content = fs.readFileSync(filePath, 'utf-8');
  const lines = content.split('\n');
  const stories = [];

  // Extract feature-level metadata
  let featureId = '';
  let featureName = '';
  let featureWave = '';
  let featurePriority = '';
  let prdLink = '';

  const featureMatch = content.match(FEATURE_RE);
  if (featureMatch) {
    featureId = featureMatch[1].trim();
    featureName = featureMatch[2].trim();
  }

  const featureMetaMatch = content.match(FEATURE_META_RE);
  if (featureMetaMatch) {
    featureWave = featureMetaMatch[1];
    featurePriority = featureMetaMatch[2];
  }

  const prdMatch = content.match(/Ref PRD:\*\*\s*\[([^\]]+)\]\(([^)]+)\)/);
  if (prdMatch) {
    prdLink = prdMatch[2];
  }

  // Split into story sections by ## heading
  const storyBlocks = content.split(/(?=^## US-)/m).filter(block => block.startsWith('## US-'));

  for (const block of storyBlocks) {
    const headingMatch = block.match(STORY_HEADING_RE);
    if (!headingMatch) continue;

    const storyId = headingMatch[1].trim();
    const title = headingMatch[2].trim();

    // Parse story metadata
    const metaMatch = block.match(STORY_META_RE);
    const wave = metaMatch ? metaMatch[1] : featureWave;
    const priority = metaMatch ? metaMatch[2] : featurePriority;
    const size = metaMatch ? metaMatch[3] : 'M';
    const status = metaMatch ? metaMatch[4].trim() : 'Draft';

    // Extract Story block
    let storyText = '';
    const storySection = block.match(/### Story\s*\n([\s\S]*?)(?=###|$)/);
    if (storySection) {
      const codeMatch = storySection[1].match(CODE_BLOCK_RE);
      storyText = codeMatch ? codeMatch[1].trim() : storySection[1].trim();
    }

    // Extract Acceptance Criteria
    let acceptanceCriteria = '';
    const acSection = block.match(/### Acceptance Criteria\s*\n([\s\S]*?)(?=###|$)/);
    if (acSection) {
      const codeMatch = acSection[1].match(CODE_BLOCK_RE);
      acceptanceCriteria = codeMatch ? codeMatch[1].trim() : acSection[1].trim();
    }

    // Extract Definition of Done
    const dodItems = [];
    const dodSection = block.match(/### Definition of Done\s*\n([\s\S]*?)(?=###|$)/);
    if (dodSection) {
      const itemRe = /- \[[ x]\]\s+(.+)/g;
      let m;
      while ((m = itemRe.exec(dodSection[1])) !== null) {
        dodItems.push(m[1].trim());
      }
    }

    // Extract MY Market Notes (if present)
    let marketNotes = '';
    const notesSection = block.match(/### MY Market Notes\s*\n([\s\S]*?)(?=###|$)/);
    if (notesSection) {
      marketNotes = notesSection[1].trim();
    }

    stories.push({
      storyId,
      title,
      featureId: featureId || path.basename(filePath).match(/F\d+/)?.[0] || '',
      featureName,
      wave: parseInt(wave) || 0,
      priority,
      size,
      status,
      storyText,
      acceptanceCriteria,
      definitionOfDone: dodItems,
      marketNotes,
      prdLink,
      sourceFile: filePath,
    });
  }

  return stories;
}

function main() {
  const args = argv.slice(2);
  let files = [];

  if (args.includes('--all')) {
    const storiesDir = path.resolve('docs/stories');
    if (fs.existsSync(storiesDir)) {
      files = fs.readdirSync(storiesDir)
        .filter(f => f.match(/^F\d+-.*-stories\.md$/))
        .map(f => path.join(storiesDir, f));
    }
  } else if (args.includes('--files')) {
    const idx = args.indexOf('--files');
    if (args[idx + 1]) {
      files = args[idx + 1].split(',').map(f => f.trim()).filter(Boolean);
    }
  }

  if (files.length === 0) {
    console.error('Usage: parse-stories.js --files "file1.md,file2.md" or --all');
    process.exit(1);
  }

  const allStories = [];
  for (const file of files) {
    const resolved = path.resolve(file);
    if (!fs.existsSync(resolved)) {
      console.error(`Warning: File not found: ${file}`);
      continue;
    }
    const stories = parseStoryFile(resolved);
    allStories.push(...stories);
  }

  // Output JSON to stdout
  console.log(JSON.stringify(allStories, null, 2));
}

main();

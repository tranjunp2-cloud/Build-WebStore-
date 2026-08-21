export type CoverageRule = { source: string; targets: string[] };

export type ChangeImpact = {
  coverageMapVersion: string;
  mappedTargetIds: string[];
  unmappedPaths: string[];
};

/** Parses the intentionally flat, versioned coverage-map.yml format without a runtime YAML dependency. */
export function parseCoverageMap(contents: string): {
  version: string;
  rules: CoverageRule[];
} {
  const version = contents.match(/^version:\s*(\d+)\s*$/m)?.[1];
  if (!version)
    throw new Error("coverage-map.yml must declare a numeric version");

  const blocks: string[] = [];
  let activeBlock: string[] | undefined;
  for (const line of contents.split("\n")) {
    if (line.trimStart().startsWith("- {")) {
      activeBlock = [line];
      if (line.includes("}")) {
        blocks.push(activeBlock.join("\n"));
        activeBlock = undefined;
      }
      continue;
    }
    if (!activeBlock) continue;
    activeBlock.push(line);
    if (line.trim() === "}") {
      blocks.push(activeBlock.join("\n"));
      activeBlock = undefined;
    }
  }

  const rules = blocks.flatMap((block) => {
    const source = block.match(/source:\s*["']([^"']+)["']/)?.[1];
    const targets = block
      .match(/targets:\s*\[([\s\S]*?)\]/)?.[1]
      .split(",")
      .map((target) => target.trim())
      .filter(Boolean);
    if (!source || !targets?.length)
      throw new Error(`Invalid coverage-map rule: ${block}`);
    return [{ source, targets }];
  });
  if (!rules.length)
    throw new Error("coverage-map.yml must contain at least one rule");
  return { version: `v${version}`, rules };
}

function globToExpression(glob: string): RegExp {
  const escaped = glob
    .replace(/[|\\{}()[\]^$+?.]/g, "\\$&")
    .replace(/\*\*/g, "___DOUBLE_STAR___")
    .replace(/\*/g, "[^/]*")
    .replace(/___DOUBLE_STAR___/g, ".*");
  return new RegExp(`^${escaped}$`);
}

export function resolveChangeImpact(
  changedPaths: string[],
  coverageMap: { version: string; rules: CoverageRule[] },
): ChangeImpact {
  const mappedTargetIds = new Set<string>();
  const unmappedPaths: string[] = [];
  const compiledRules = coverageMap.rules.map((rule) => ({
    ...rule,
    expression: globToExpression(rule.source),
  }));

  for (const changedPath of changedPaths) {
    const matchingRules = compiledRules.filter((rule) =>
      rule.expression.test(changedPath),
    );
    if (!matchingRules.length) {
      unmappedPaths.push(changedPath);
      continue;
    }
    // Governance requires the most-specific mapping to win, so a broad fallback
    // cannot silently expand the blast radius of a specialised target rule.
    const longestSource = Math.max(
      ...matchingRules.map((rule) => rule.source.length),
    );
    for (const rule of matchingRules.filter(
      (rule) => rule.source.length === longestSource,
    )) {
      for (const target of rule.targets) mappedTargetIds.add(target);
    }
  }
  return {
    coverageMapVersion: coverageMap.version,
    mappedTargetIds: [...mappedTargetIds].sort(),
    unmappedPaths,
  };
}

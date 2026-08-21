# US-F37-04 handoff — Schema 35 contract

## Boundary

US-F37-02 exports a pure `SchemaGenerationArtifact → SchemaScoreResult` contract. US-F37-04/#1312 owns runtime aggregation, API/dashboard exposure, issues/actions, and the overall `20/35/15/30` total.

## Contract

```ts
type SchemaGenerationArtifact = {
  strictLocalBusiness: JsonLdNode | null
  organization: JsonLdNode | null
  subtypeEvidence: ValidatedSubtypeEvidence | null
}

calculateSchemaScore(artifact): {
  score: number
  breakdown: {
    localBusiness: 0 | 10
    subtype: 0 | 4
    openingHours: 0 | 5
    geo: 0 | 4
    telephone: 0 | 3
    url: 0 | 3
    priceRange: 0 | 3
    organization: 0 | 3
  }
}
```

The result is derived only from nodes generated from the same site snapshot. FAQ is intentionally absent and cannot add Schema points. Weak Contact fallback nodes never enter the artifact.

## Consumer requirements

- Call `generateSchemaGenerationArtifact(siteSnapshot)` once.
- Pass that exact artifact to `calculateSchemaScore()`.
- Do not reconstruct Schema booleans from database fields or page blocks.
- Preserve the exact maximum of 35 and overall bucket ownership `Business 20 + Schema 35 + AI 15 + Technical 30`.
- Keep authenticated aggregation/API/dashboard work in #1312.

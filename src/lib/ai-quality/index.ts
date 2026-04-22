/**
 * ai-quality barrel — public API for src/app route handlers.
 * Import from here, not from individual files.
 */
export { scoreFixture, loadRubric, DEFAULT_RUBRIC_VERSION } from './scorer'
export type { RubricVersion, ScoreFixtureArgs, FixtureScore, DimensionScore } from './scorer'
export { buildFixture } from './build-fixture'
export type { PayloadTemplate, PayloadPage } from './build-fixture'

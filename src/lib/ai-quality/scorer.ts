/**
 * Scorer shim — re-exports from scripts/test-harness/rubric/scorer-lib.
 * Keeps scripts/ harness intact while enabling clean imports in src/app/*.
 * Do NOT import from scripts/ directly in route handlers.
 */
export {
    scoreFixture,
    loadRubric,
    rubricPath,
    reportPath,
    scoreAll,
    buildUniquenessContext,
    writeReport,
    readMatrix,
    readReport,
    isReportStale,
    DEFAULT_RUBRIC_VERSION,
    MATRIX_PATH,
    LATEST_REPORT_PATH,
} from '../../../scripts/test-harness/rubric/scorer-lib'

export type { RubricVersion, ScoreFixtureArgs } from '../../../scripts/test-harness/rubric/scorer-lib'
export type {
    FixtureScore,
    DimensionScore,
    CriterionResult,
    Rubric,
    RubricReport,
} from '../../../scripts/test-harness/rubric/rubric.schema'

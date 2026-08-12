# F40 — QA Control Center

## US-F40-04: QA Inbox and Feature Health Detail

### [x] AUTO TC-F40-04-02 — Editor Product Grid variant evidence and retest

**Preconditions:** Staging has the isolated `QA-Tshirt-SML` fixture and a super-admin E2E account. The target is `editor-productgrid-variants`; its selected pack is `editor-product-grid-variants-smoke` only.

```gherkin
GIVEN a tester opens the Editor Product Grid using QA-Tshirt-SML
WHEN the Product Grid binds the fixture variants
THEN the visible variant list contains S, M and L exactly once
AND the terminal run records target editor-productgrid-variants, fixture QA-Tshirt-SML,
  expected count 3, actual count 3 and the approved safe evidence metadata
```

**Failure evidence contract:** a missing/duplicate variant records `VISUAL_THRESHOLD_EXCEEDED` only for an approved visual comparison whose measured difference is greater than its threshold; functional count mismatch uses `VARIANT_COUNT_MISMATCH`.

**Safety:** the pack is staging-only, uses the registered fixture lease, runs no arbitrary command and never creates a GitHub issue.

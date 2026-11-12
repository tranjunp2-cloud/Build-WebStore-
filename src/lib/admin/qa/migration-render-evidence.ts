/**
 * Evidence contract for the Block Comparison view. It deliberately has no
 * fallback from inferred PW1 previews to a PW2 migration result.
 */
export type Pw2DataStatus = "migrated" | "missing" | "mismatch" | "unverified";
export type ComponentStatus = "supported" | "unsupported" | "unverified";
export type LiveRenderStatus = "rendered" | "not_rendered" | "unverified";
export type RenderEvidenceOverall = "pass" | "needs_review" | "failed";

export type SafeFieldEvidence = {
  label: string;
  pw1: string | null;
  pw2: string | null;
  status: "match" | "mismatch" | "unverified";
};

/**
 * Sanitized PW2 layout data for a future verified renderer. It must originate
 * from the mapped Payload layout block, never from the PW1 comparison record.
 */
export type Pw2RenderModel = {
  blockType: string;
  title: string;
  headline: string | null;
  subheadline: string | null;
  bodyText: string | null;
  imageUrl: string | null;
  ctaLabel: string | null;
};

export type BlockRenderEvidence = {
  legacyId: string;
  pw2Data: {
    status: Pw2DataStatus;
    pageId: string | null;
    layoutBlockId: string | null;
    blockType: string | null;
    mappingVersion: string | null;
    renderModel: Pw2RenderModel | null;
    checkedAt: string;
    reasonCode: string;
    fields: SafeFieldEvidence[];
  };
  component: {
    status: ComponentStatus;
    registryBlockType: string | null;
    registryVersion: string | null;
    reasonCode: string;
  };
  liveRender: {
    status: LiveRenderStatus;
    checkedAt: string | null;
    evidenceRef: string | null;
    reasonCode: string;
  };
  overall: RenderEvidenceOverall;
};

export type MigrationRenderEvidenceSnapshot = {
  storeId: string;
  pageId: string;
  generatedAt: string;
  mode: "unavailable" | "demo" | "verified";
  message: string;
  blocks: BlockRenderEvidence[];
};

export type MigrationRenderEvidenceProvider = {
  getPageEvidence(input: { storeId: string; pageId: string }): Promise<MigrationRenderEvidenceSnapshot>;
};

const SENSITIVE_KEY = /(password|secret|token|api[_-]?key|authorization|credential|email|phone|address|khách\s*hàng|nguời\s*mua|điện\s*thoại|địa\s*chỉ)/i;
const SAFE_EVIDENCE_FIELD_KEY = /^(tiêu\s*đề|headline|title|slug|block\s*type|loại\s*block|layout\s*block|thứ\s*tự|order)$/i;
const MAX_TEXT = 240;

export function deriveRenderEvidenceOverall(input: Pick<BlockRenderEvidence, "pw2Data" | "component" | "liveRender">): RenderEvidenceOverall {
  if (input.pw2Data.status === "missing" || input.pw2Data.status === "mismatch" || input.liveRender.status === "not_rendered") return "failed";
  if (input.pw2Data.status === "migrated" && input.component.status === "supported" && input.liveRender.status === "rendered") return "pass";
  return "needs_review";
}

function safeText(value: unknown): string | null {
  if (typeof value !== "string") return null;
  const text = value.replace(/[\u0000-\u001F\u007F]/g, " ").trim().slice(0, MAX_TEXT);
  return text || null;
}

function safeOpaque(value: unknown): string | null {
  const text = safeText(value);
  return text && /^[A-Za-z0-9_-]{1,128}$/.test(text) ? text : null;
}

function safeCode(value: unknown): string {
  const text = safeText(value);
  return text && /^[A-Z0-9_:-]{1,96}$/.test(text) ? text : "UNVERIFIED";
}

function safeVersion(value: unknown): string | null {
  const text = safeText(value);
  return text && /^[A-Za-z0-9_.-]{1,96}$/.test(text) ? text : null;
}

function safePw2DataStatus(value: unknown): Pw2DataStatus {
  return value === "migrated" || value === "missing" || value === "mismatch"
    ? value
    : "unverified";
}

function safeComponentStatus(value: unknown): ComponentStatus {
  return value === "supported" || value === "unsupported" ? value : "unverified";
}

function safeLiveRenderStatus(value: unknown): LiveRenderStatus {
  return value === "rendered" || value === "not_rendered" ? value : "unverified";
}

/** Server DTO boundary: only small, pre-classified display values leave the server. */
export function sanitizeRenderEvidence(snapshot: MigrationRenderEvidenceSnapshot): MigrationRenderEvidenceSnapshot {
  const blocks = Array.isArray(snapshot.blocks) ? snapshot.blocks.map((block) => {
    const fields = Array.isArray(block.pw2Data.fields) ? block.pw2Data.fields.flatMap((field) => {
      const key = field.label ?? "";
      // The adapter must classify fields before serializing. A deny-list alone
      // is not enough because PW1/PW2 can contain customer or order content.
      if (SENSITIVE_KEY.test(key) || !SAFE_EVIDENCE_FIELD_KEY.test(key.trim())) return [];
      return [{
        label: safeText(field.label) ?? "Trường đối soát",
        pw1: safeText(field.pw1),
        pw2: safeText(field.pw2),
        status: field.status === "match" || field.status === "mismatch" ? field.status : "unverified" as const,
      }];
    }) : [];
    const pw2Data = {
      status: safePw2DataStatus(block.pw2Data.status),
      pageId: safeOpaque(block.pw2Data.pageId),
      layoutBlockId: safeOpaque(block.pw2Data.layoutBlockId),
      blockType: safeOpaque(block.pw2Data.blockType),
      mappingVersion: safeVersion(block.pw2Data.mappingVersion),
      // A native PW2 renderer/live frame has not been handed over yet. Never
      // serialize raw Payload layout content as a substitute preview.
      renderModel: null,
      checkedAt: safeText(block.pw2Data.checkedAt) ?? new Date(0).toISOString(),
      reasonCode: safeCode(block.pw2Data.reasonCode),
      fields,
    };
    const component = {
      status: safeComponentStatus(block.component.status),
      registryBlockType: safeOpaque(block.component.registryBlockType),
      registryVersion: safeVersion(block.component.registryVersion),
      reasonCode: safeCode(block.component.reasonCode),
    };
    const liveRender = {
      status: safeLiveRenderStatus(block.liveRender.status),
      checkedAt: safeText(block.liveRender.checkedAt),
      evidenceRef: safeOpaque(block.liveRender.evidenceRef),
      reasonCode: safeCode(block.liveRender.reasonCode),
    };
    return { legacyId: safeOpaque(block.legacyId) ?? "unknown", pw2Data, component, liveRender, overall: deriveRenderEvidenceOverall({ pw2Data, component, liveRender }) };
  }) : [];
  return {
    storeId: safeOpaque(snapshot.storeId) ?? "unknown",
    pageId: safeOpaque(snapshot.pageId) ?? "unknown",
    generatedAt: safeText(snapshot.generatedAt) ?? new Date(0).toISOString(),
    mode: snapshot.mode === "verified" || snapshot.mode === "demo" ? snapshot.mode : "unavailable",
    message:
      snapshot.mode === "demo"
        ? "Dữ liệu mẫu để duyệt UI; không phải bằng chứng migration thực tế."
        : snapshot.mode === "verified"
          ? "Bằng chứng migration PW2 đã được xác nhận."
          : "Chưa có mapping PW1 → PW2 đã xác nhận. Không suy đoán kết quả migration.",
    blocks,
  };
}

export function createUnavailableRenderEvidence(input: { storeId: string; pageId: string; legacyIds: string[]; now?: Date }): MigrationRenderEvidenceSnapshot {
  const checkedAt = (input.now ?? new Date()).toISOString();
  const blocks = input.legacyIds.map((legacyId) => {
    const pw2Data: BlockRenderEvidence["pw2Data"] = { status: "unverified", pageId: null, layoutBlockId: null, blockType: null, mappingVersion: null, renderModel: null, checkedAt, reasonCode: "MAPPING_UNAVAILABLE", fields: [] };
    const component: BlockRenderEvidence["component"] = { status: "unverified", registryBlockType: null, registryVersion: null, reasonCode: "PW2_BLOCK_UNRESOLVED" };
    const liveRender: BlockRenderEvidence["liveRender"] = { status: "unverified", checkedAt: null, evidenceRef: null, reasonCode: "LIVE_CHECK_NOT_RUN" };
    return { legacyId, pw2Data, component, liveRender, overall: deriveRenderEvidenceOverall({ pw2Data, component, liveRender }) };
  });
  return { storeId: input.storeId, pageId: input.pageId, generatedAt: checkedAt, mode: "unavailable", message: "Chưa có mapping PW1 → PW2 đã xác nhận. Không suy đoán kết quả migration.", blocks };
}

/** Explicit local-review fixture. Never register it as a migration provider. */
export function createDemoRenderEvidence(input: { storeId: string; pageId: string; legacyIds: string[]; now?: Date }): MigrationRenderEvidenceSnapshot {
  const checkedAt = (input.now ?? new Date()).toISOString();
  const blocks = input.legacyIds.map((legacyId, index) => {
    const kind = index % 4;
    const pw2Data: BlockRenderEvidence["pw2Data"] = kind === 2
      ? { status: "missing", pageId: null, layoutBlockId: null, blockType: null, mappingVersion: "demo-v1", renderModel: null, checkedAt, reasonCode: "PW2_BLOCK_NOT_FOUND", fields: [] }
      : { status: "migrated", pageId: `PW2-PAGE-${input.pageId}`, layoutBlockId: `PW2-BLOCK-${index + 1}`, blockType: kind === 1 ? "unsupported_demo_block" : "banner", mappingVersion: "demo-v1", renderModel: null, checkedAt, reasonCode: "DEMO_MAPPING_CONFIRMED", fields: [{ label: "Tiêu đề", pw1: "Nội dung mẫu PW1", pw2: kind === 3 ? "Nội dung PW2 khác" : "Nội dung mẫu PW1", status: kind === 3 ? "mismatch" : "match" }] };
    if (kind === 3) pw2Data.status = "mismatch";
    const component: BlockRenderEvidence["component"] = pw2Data.status === "migrated"
      ? { status: kind === 1 ? "unsupported" : "supported", registryBlockType: pw2Data.blockType, registryVersion: "demo-registry-v1", reasonCode: kind === 1 ? "RENDERER_NOT_REGISTERED" : "RENDERER_REGISTERED" }
      : { status: "unverified", registryBlockType: null, registryVersion: null, reasonCode: "PW2_BLOCK_UNRESOLVED" };
    // Fixtures may exercise data/component combinations, but may never claim a
    // real storefront render happened. Only an authorized live runner can set
    // this layer to rendered.
    const liveRender: BlockRenderEvidence["liveRender"] = {
      status: "unverified",
      checkedAt: null,
      evidenceRef: null,
      reasonCode: "DEMO_LIVE_NOT_RUN",
    };
    return { legacyId, pw2Data, component, liveRender, overall: deriveRenderEvidenceOverall({ pw2Data, component, liveRender }) };
  });
  return { storeId: input.storeId, pageId: input.pageId, generatedAt: checkedAt, mode: "demo", message: "Dữ liệu mẫu để duyệt UI; không phải bằng chứng migration thực tế.", blocks };
}

let evidenceProvider: MigrationRenderEvidenceProvider | null = null;
export function registerMigrationRenderEvidenceProvider(provider: MigrationRenderEvidenceProvider | null): void { evidenceProvider = provider; }
export async function getMigrationRenderEvidence(input: { storeId: string; pageId: string; legacyIds: string[] }): Promise<MigrationRenderEvidenceSnapshot> {
  if (!evidenceProvider) return createUnavailableRenderEvidence(input);

  let snapshot: MigrationRenderEvidenceSnapshot;
  try {
    snapshot = await evidenceProvider.getPageEvidence(input);
  } catch {
    return createUnavailableRenderEvidence(input);
  }
  // A future adapter is an external trust boundary. Do not let a faulty query
  // show another store/page's evidence in the current inspection.
  if (
    !snapshot ||
    typeof snapshot !== "object" ||
    snapshot.storeId !== input.storeId ||
    snapshot.pageId !== input.pageId
  ) {
    return createUnavailableRenderEvidence(input);
  }
  const allowedLegacyIds = new Set(input.legacyIds);
  return {
    ...snapshot,
    blocks: Array.isArray(snapshot.blocks)
      ? snapshot.blocks.filter(
          (block): block is BlockRenderEvidence =>
            Boolean(block) &&
            typeof block === "object" &&
            typeof block.legacyId === "string" &&
            allowedLegacyIds.has(block.legacyId),
        )
      : [],
  };
}

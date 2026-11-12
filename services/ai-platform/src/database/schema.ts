import { bigint, bigserial, boolean, customType, integer, jsonb, pgTable, primaryKey, real, text, timestamp } from "drizzle-orm/pg-core";

const bytea = customType<{ data: Buffer; driverData: Buffer }>({ dataType: () => "bytea" });

/** Drizzle view of the tables created in migrations.ts (source of truth for DDL). */
export const aiRuns = pgTable("ai_runs", {
	id: text("id").primaryKey(),
	organizationId: text("organization_id").notNull(),
	tenantId: text("tenant_id"),
	userId: text("user_id").notNull(),
	surface: text("surface").notNull(),
	domain: text("domain").notNull(),
	status: text("status").notNull(),
	run: jsonb("run").notNull(),
	threadId: text("thread_id"),
	/** Exact user turn sent to the model; replayed byte-for-byte as thread history. */
	userMessage: text("user_message"),
	/** Paused-run state (model messages so far + question flow); never sent to the browser. */
	state: jsonb("state"),
	createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
	updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
});

export const aiThreads = pgTable("ai_threads", {
	id: text("id").primaryKey(),
	organizationId: text("organization_id").notNull(),
	tenantId: text("tenant_id"),
	userId: text("user_id").notNull(),
	title: text("title").notNull(),
	/** "auto" (from the prompt / drafts), "user" (renamed) or "task" (the to-do item's title) — only "auto" is ever retitled */
	titleSource: text("title_source").notNull().default("auto"),
	preview: text("preview"),
	runCount: integer("run_count").notNull().default(0),
	/** the record the chat was started on (kind + id + label at the time) */
	entityKind: text("entity_kind"),
	entityId: text("entity_id"),
	entityLabel: text("entity_label"),
	/** the to-do item this chat handles ("shop:orders_to_confirm"); set at creation, never changed */
	taskKey: text("task_key"),
	createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
	updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
});

/** One row per run start (quota); kept when the run or its chat is deleted, pruned after 2 days. */
export const aiRunStarts = pgTable("ai_run_starts", {
	runId: text("run_id").primaryKey(),
	organizationId: text("organization_id").notNull(),
	userId: text("user_id").notNull(),
	createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
	/** the start waited for a slot (FIFO by created_at while its run is `queued`) */
	queued: boolean("queued").notNull().default(false),
	/** the chat it continues (one active run per chat); null for a new chat */
	threadId: text("thread_id"),
	/** the client's id for this prompt: a repeated start attaches to this run */
	clientRequestId: text("client_request_id"),
	/** who asked, for teammates' "Stop … and run mine" (owners / admins) */
	userName: text("user_name"),
});

/** Picture quota: one row per generation, reserved before the provider is called (see PictureQuota). */
export const aiImageReservations = pgTable("ai_image_reservations", {
	id: text("id").primaryKey(),
	organizationId: text("organization_id").notNull(),
	userId: text("user_id").notNull(),
	pictures: integer("pictures").notNull(),
	createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
});

export const aiChangeSets = pgTable("ai_change_sets", {
	id: text("id").primaryKey(),
	runId: text("run_id").notNull(),
	organizationId: text("organization_id").notNull(),
	status: text("status").notNull(),
	actionKind: text("action_kind"),
	changeSet: jsonb("change_set").notNull(),
	claimedAt: timestamp("claimed_at", { withTimezone: true }),
	createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
	updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
});

export const aiUsageEvents = pgTable("ai_usage_events", {
	id: bigserial("id", { mode: "number" }).primaryKey(),
	organizationId: text("organization_id").notNull(),
	userId: text("user_id"),
	surface: text("surface").notNull(),
	task: text("task").notNull(),
	runId: text("run_id"),
	provider: text("provider"),
	model: text("model"),
	inputTokens: integer("input_tokens"),
	outputTokens: integer("output_tokens"),
	cachedInputTokens: integer("cached_input_tokens"),
	costUsdMicros: bigint("cost_usd_micros", { mode: "number" }),
	latencyMs: integer("latency_ms"),
	outcome: text("outcome").notNull(),
	errorCode: text("error_code"),
	// why it failed: status + the provider's message, keys masked (ledger/error-detail.ts)
	errorDetail: text("error_detail"),
	createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
});

export const aiAttachments = pgTable("ai_attachments", {
	id: text("id").primaryKey(),
	organizationId: text("organization_id").notNull(),
	userId: text("user_id").notNull(),
	threadId: text("thread_id"),
	kind: text("kind").notNull(),
	origin: text("origin").notNull(),
	ref: text("ref"),
	name: text("name").notNull(),
	mime: text("mime").notNull(),
	size: integer("size").notNull(),
	content: bytea("content").notNull(),
	/** Text read out of a document (PDF/CSV/XLSX) — what the model sees. */
	textContent: text("text_content"),
	credit: text("credit"),
	createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
});

export const aiDecisions = pgTable(
	"ai_decisions",
	{
		organizationId: text("organization_id").notNull(),
		fingerprint: text("fingerprint").notNull(),
		stage: text("stage").notNull(),
		provider: text("provider").notNull(),
		model: text("model").notNull(),
		choice: text("choice"),
		confidence: real("confidence").notNull(),
		probabilities: jsonb("probabilities").notNull(),
		createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
	},
	(table) => [primaryKey({ columns: [table.organizationId, table.fingerprint] })],
);

/** Per-user choices about a work item (snooze, dismiss, last raised); the items themselves are computed. */
export const aiWorkState = pgTable(
	"ai_work_state",
	{
		organizationId: text("organization_id").notNull(),
		userId: text("user_id").notNull(),
		key: text("key").notNull(),
		snoozedUntil: timestamp("snoozed_until", { withTimezone: true }),
		dismissedFp: text("dismissed_fp"),
		lastRaisedAt: timestamp("last_raised_at", { withTimezone: true }),
		updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
	},
	(table) => [primaryKey({ columns: [table.organizationId, table.userId, table.key] })],
);

/** Prime Studio "Providers & models": one row per provider / custom endpoint. Secrets are AES-256-GCM sealed (settings/secret-box.ts). */
export const aiProviderSettings = pgTable("ai_provider_settings", {
	id: text("id").primaryKey(),
	kind: text("kind").notNull(),
	/** null = inherit (on) */
	enabled: boolean("enabled"),
	baseUrl: text("base_url"),
	options: jsonb("options").notNull().default({}),
	secretCiphertext: text("secret_ciphertext"),
	secretIv: text("secret_iv"),
	secretTag: text("secret_tag"),
	secretLast4: text("secret_last4"),
	secretKeyVersion: text("secret_key_version"),
	secretSetBy: text("secret_set_by"),
	secretSetAt: timestamp("secret_set_at", { withTimezone: true }),
	lastTest: jsonb("last_test"),
	updatedBy: text("updated_by"),
	updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
});

/** Single row (id "gateway"): Cloudflare AI Gateway address, per-provider paths and the sealed token. */
export const aiGatewaySettings = pgTable("ai_gateway_settings", {
	id: text("id").primaryKey().default("gateway"),
	baseUrl: text("base_url"),
	paths: jsonb("paths").notNull().default({}),
	tokenCiphertext: text("token_ciphertext"),
	tokenIv: text("token_iv"),
	tokenTag: text("token_tag"),
	tokenLast4: text("token_last4"),
	tokenKeyVersion: text("token_key_version"),
	tokenSetBy: text("token_set_by"),
	tokenSetAt: timestamp("token_set_at", { withTimezone: true }),
	updatedBy: text("updated_by"),
	updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
});

/** Single row (id "routing"): tier chains, effort, timeouts and the picture chain set in Studio. */
export const aiRoutingSettings = pgTable("ai_routing_settings", {
	id: text("id").primaryKey().default("routing"),
	value: jsonb("value").notNull().default({}),
	updatedBy: text("updated_by"),
	updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
});

/** Task -> tier overrides (absent row = the task's catalog tier). */
export const aiTaskRouting = pgTable("ai_task_routing", {
	taskId: text("task_id").primaryKey(),
	tier: text("tier").notNull(),
	updatedBy: text("updated_by"),
	updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
});

/** Runtime knobs set in Studio (absent row = env / default). */
export const aiRuntimeSettings = pgTable("ai_runtime_settings", {
	key: text("key").primaryKey(),
	value: jsonb("value").notNull(),
	updatedBy: text("updated_by"),
	updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
});

/** Every settings change; `snapshot` is the NON-secret state after it (never a key). */
export const aiSettingsHistory = pgTable("ai_settings_history", {
	id: text("id").primaryKey(),
	at: timestamp("at", { withTimezone: true }).notNull().defaultNow(),
	actor: jsonb("actor").notNull(),
	area: text("area").notNull(),
	summary: text("summary").notNull(),
	snapshot: jsonb("snapshot").notNull(),
	restorable: boolean("restorable").notNull().default(true),
});

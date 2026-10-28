import { z } from "zod";

/** Usage the platform reports back for one task call (all attempts summed). */
export const AiUsageSummarySchema = z.object({
	provider: z.string(),
	model: z.string(),
	inputTokens: z.number().int().nonnegative().optional(),
	outputTokens: z.number().int().nonnegative().optional(),
	costUsdMicros: z.number().int().nonnegative().nullable(),
	latencyMs: z.number().int().nonnegative(),
	/** Earlier candidates of the alias chain that failed before this one answered. */
	fallbacks: z.array(z.object({ provider: z.string(), model: z.string(), error: z.string() })).default([]),
});
export type AiUsageSummary = z.infer<typeof AiUsageSummarySchema>;

export const RunTaskResponseSchema = z.object({
	taskId: z.string(),
	promptVersion: z.string(),
	requestId: z.string(),
	output: z.unknown(),
	usage: AiUsageSummarySchema,
});
export type RunTaskResponse<T = unknown> = Omit<z.infer<typeof RunTaskResponseSchema>, "output"> & { output: T };

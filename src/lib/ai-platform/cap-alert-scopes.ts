/** What an `ai-cap-alerts` row is about. */
export const AI_CAP_ALERT_SCOPES = ["platform-daily", "platform-monthly", "shop-daily"] as const;
export type AiCapAlertScope = (typeof AI_CAP_ALERT_SCOPES)[number];

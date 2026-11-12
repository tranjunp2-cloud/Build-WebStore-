import "server-only";

import { createHash } from "node:crypto";
import type { PlatformUser } from "@/types/user";

/**
 * Pure tenant/user identity helpers shared by the AI platform wiring: they map a
 * Payload user + tenant membership onto the ids the AI platform bills against.
 * (The ECH bridge-token signing of the monorepo is deliberately not part of this app.)
 */

/**
 * Deterministically formats an upstream identity user ID into a valid platform UserId: user_${string}.
 */
export function toPlatformUserId(id: string | number): string {
	const raw = String(id).trim();
	if (/^user_[a-z0-9_-]+$/.test(raw)) {
		return raw;
	}
	const hash = createHash("sha256")
		.update(`prime:user:${raw}`)
		.digest("hex")
		.slice(0, 24);
	return `user_${hash}`;
}

const PLATFORM_ORG_ID_PATTERN = /^org_[a-z0-9]{20,30}$/;

/**
 * Deterministically formats an upstream tenant ID into a valid platform OrganizationId: org_[a-z0-9]{20,30}.
 */
export function toPlatformOrganizationId(id: string | number): string {
	const raw = String(id).trim();
	if (PLATFORM_ORG_ID_PATTERN.test(raw)) {
		return raw;
	}
	const hash = createHash("sha256")
		.update(`prime:tenant:${raw}`)
		.digest("hex")
		.slice(0, 24);
	return `org_${hash}`;
}

export type TenantMembershipItem = NonNullable<PlatformUser["tenants"]>[number];

export function extractTenantRawId(
	tenant: TenantMembershipItem["tenant"] | string | number | null | undefined,
): string | null {
	if (!tenant) return null;
	if (typeof tenant === "object" && "id" in tenant) {
		return String(tenant.id);
	}
	return String(tenant);
}

/**
 * Reads name/slug off a populated tenant relation on the membership row.
 * The relation is populated by Payload depth — pass the result to
 * createEchBridgeToken so the platform-side organization mirrors the tenant's
 * display name and slug instead of the derived org hash.
 */
export function bridgeTenantIdentity(
	item: TenantMembershipItem | undefined | null,
): { tenantName?: string; tenantSlug?: string } {
	const tenant = item?.tenant;
	if (!tenant || typeof tenant !== "object") return {};
	return {
		tenantName: tenant.name || undefined,
		tenantSlug: tenant.slug || undefined,
	};
}

export interface TenantPlatformOrgRef {
	id: string;
	name?: string;
	slug?: string;
}

/**
 * Reads an explicit platform-organization binding off a tenant doc's
 * `metaData.platformOrgId` (+ optional `platformOrgName`/`platformOrgSlug`
 * display mirrors). Used to pin a PW tenant onto an already-existing
 * platform organization — e.g. a legacy ECH org carrying real data — instead
 * of deriving a fresh `org_<hash>`. Absent/invalid values return null so
 * callers fall back to the deterministic hash.
 */
export function resolveTenantPlatformOrg(
	tenant: TenantMembershipItem["tenant"] | null | undefined,
): TenantPlatformOrgRef | null {
	if (!tenant || typeof tenant !== "object") return null;
	const meta = tenant.metaData;
	const id =
		typeof meta?.platformOrgId === "string" ? meta.platformOrgId.trim() : "";
	if (!PLATFORM_ORG_ID_PATTERN.test(id)) return null;
	const pick = (key: "platformOrgName" | "platformOrgSlug") => {
		const value = meta?.[key];
		return typeof value === "string" && value.trim().length > 0
			? value.trim()
			: undefined;
	};
	return { id, name: pick("platformOrgName"), slug: pick("platformOrgSlug") };
}

/**
 * Resolves the effective platform organization for a membership row:
 * `metaData.platformOrgId` override when present, else the derived
 * `org_<sha256>` of the raw tenant id. `name`/`slug` always describe the
 * organization the token will represent (override mirrors preferred, then
 * the tenant's own display fields) so API-side org upserts stay idempotent.
 */
export function resolveTenantOrganization(
	item: TenantMembershipItem | undefined | null,
): TenantPlatformOrgRef | null {
	const rawId = extractTenantRawId(item?.tenant);
	if (!rawId) return null;
	const identity = bridgeTenantIdentity(item);
	const override = resolveTenantPlatformOrg(item?.tenant);
	if (override) {
		return {
			id: override.id,
			name: override.name ?? identity.tenantName,
			slug: override.slug ?? identity.tenantSlug,
		};
	}
	return {
		id: toPlatformOrganizationId(rawId),
		name: identity.tenantName,
		slug: identity.tenantSlug,
	};
}

function isTenantDocSuspended(item: TenantMembershipItem): boolean {
	const tenant = item.tenant;
	return (
		typeof tenant === "object" &&
		tenant !== null &&
		(tenant as { status?: string }).status === "suspended"
	);
}

export interface VerifyTenantMembershipResult {
	allowed: boolean;
	membership?: TenantMembershipItem;
	tenantId?: string;
	organizationId?: string;
	reason?: "unauthenticated" | "no_tenants" | "not_a_member" | "inactive_tenant" | "no_active_tenant";
}

/**
 * Validates whether a user is an active member of a requested workspace/tenant.
 * Never blindly trusts a tenant ID or assumes tenants[0].
 */
export function verifyTenantMembership(
	user: PlatformUser | null | undefined,
	requestedTenantId?: string | null,
): VerifyTenantMembershipResult {
	if (!user) {
		return { allowed: false, reason: "unauthenticated" };
	}

	const tenants = user.tenants;
	if (!tenants || tenants.length === 0) {
		return { allowed: false, reason: "no_tenants" };
	}

	if (requestedTenantId && requestedTenantId.trim().length > 0) {
		const target = requestedTenantId.trim();
		const match = tenants.find((item) => {
			const rawId = extractTenantRawId(item.tenant);
			if (!rawId) return false;
			const orgId = resolveTenantOrganization(item)?.id;
			return rawId === target || orgId === target;
		});

		if (!match) {
			return { allowed: false, reason: "not_a_member" };
		}

		if (
			match.status === "pending" ||
			(match.status as string) === "suspended" ||
			isTenantDocSuspended(match)
		) {
			return { allowed: false, reason: "inactive_tenant" };
		}

		const rawId = extractTenantRawId(match.tenant)!;
		return {
			allowed: true,
			membership: match,
			tenantId: rawId,
			organizationId: resolveTenantOrganization(match)?.id,
		};
	}

	// If no specific tenant was requested, select the first ACTIVE tenant —
	// an active membership on a suspended tenant doc (e.g. SSO ban-user) is
	// still not usable for minting bridge tokens.
	const activeTenant = tenants.find(
		(item) =>
			item.status !== "pending" &&
			(item.status as string) !== "suspended" &&
			!isTenantDocSuspended(item),
	);

	if (!activeTenant) {
		return { allowed: false, reason: "no_active_tenant" };
	}

	const rawId = extractTenantRawId(activeTenant.tenant)!;
	return {
		allowed: true,
		membership: activeTenant,
		tenantId: rawId,
		organizationId: resolveTenantOrganization(activeTenant)?.id,
	};
}

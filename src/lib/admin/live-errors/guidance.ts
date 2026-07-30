import type {
    LiveErrorGuidance,
    LiveErrorSource,
} from './contracts'

type GuidanceInput = {
    source: LiveErrorSource
    statusCode: number | null
    message: string
    hasApplicationFrames: boolean
}

const GUIDANCE: Record<LiveErrorGuidance['category'], Omit<LiveErrorGuidance, 'category'>> = {
    'http-500-503': {
        investigationArea: 'Application route, dependency, or recent deployment',
        checks: [
            'Inspect the top application frame',
            'Compare the first occurrence with the latest deployment',
        ],
        escalationCondition: 'Escalate when the application frame is unavailable or the deployment comparison is inconclusive',
        label: 'Suggested next checks',
    },
    timeout: {
        investigationArea: 'Database, external provider, or function duration',
        checks: [
            'Inspect external calls and database latency',
            'Inspect Vercel function duration',
        ],
        escalationCondition: 'Escalate when the timed-out dependency cannot be identified or the timeout repeats during manual verification',
        label: 'Suggested next checks',
    },
    authentication: {
        investigationArea: 'Authentication, role, tenant isolation, or environment',
        checks: [
            'Verify session and role',
            'Verify tenant and environment configuration',
        ],
        escalationCondition: 'Escalate when the session, role, tenant, and environment are correct but access still fails',
        label: 'Suggested next checks',
    },
    'not-found': {
        investigationArea: 'Domain mapping, middleware, route, or rewrite',
        checks: [
            'Verify tenant-domain mapping',
            'Verify middleware and route resolution',
        ],
        escalationCondition: 'Escalate when domain mapping and route resolution are both correct but the route still returns 404',
        label: 'Suggested next checks',
    },
    'rate-limit': {
        investigationArea: 'Provider quota or application rate limit',
        checks: [
            'Inspect provider quota',
            'Inspect retry and rate-limit behavior',
        ],
        escalationCondition: 'Escalate when provider quota and application rate-limit state do not explain the rejection',
        label: 'Suggested next checks',
    },
    'application-exception': {
        investigationArea: 'Application frame or release regression',
        checks: [
            'Inspect the first in-application frame',
            'Compare affected release or deployment',
        ],
        escalationCondition: 'Escalate when no in-application frame exists or the release comparison is inconclusive',
        label: 'Suggested next checks',
    },
    unmatched: {
        investigationArea: 'Provider evidence requires manual investigation',
        checks: [
            'Open the provider event',
            'Inspect route, timestamp, and adjacent logs',
        ],
        escalationCondition: 'Escalate when the provider event lacks the route, status, or application frame needed to classify it',
        label: 'Suggested next checks',
    },
}

export function getGuidance(input: GuidanceInput): LiveErrorGuidance {
    let category: LiveErrorGuidance['category']

    if (input.statusCode === 504 || /\btime(?:d)?\s*out\b/i.test(input.message)) {
        category = 'timeout'
    } else if (input.statusCode !== null && input.statusCode >= 500 && input.statusCode <= 503) {
        category = 'http-500-503'
    } else if (input.statusCode === 401 || input.statusCode === 403) {
        category = 'authentication'
    } else if (input.statusCode === 404) {
        category = 'not-found'
    } else if (input.statusCode === 429) {
        category = 'rate-limit'
    } else if (input.hasApplicationFrames || input.source === 'sentry') {
        category = 'application-exception'
    } else {
        category = 'unmatched'
    }

    return { category, ...GUIDANCE[category] }
}

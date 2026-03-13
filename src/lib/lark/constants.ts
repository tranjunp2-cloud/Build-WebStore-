/**
 * Lark Bot — Configuration & Constants
 * Bot config, team mapping, command definitions
 */

// ─── Lark API Config ─────────────────────────────────────────────────────

/** Base URL for Lark Open API (use LARK_API_BASE env for Feishu) */
export const LARK_API_BASE =
    process.env.LARK_API_BASE || 'https://open.larksuite.com/open-apis'

export const LARK_APP_ID = process.env.LARK_APP_ID || ''
export const LARK_APP_SECRET = process.env.LARK_APP_SECRET || ''
export const LARK_ENCRYPT_KEY = process.env.LARK_ENCRYPT_KEY || ''
export const LARK_VERIFICATION_TOKEN = process.env.LARK_VERIFICATION_TOKEN || ''

// ─── GitHub Config ───────────────────────────────────────────────────────

export const GITHUB_TOKEN = process.env.GITHUB_TOKEN || ''
export const GITHUB_REPO = process.env.GITHUB_REPO || 'nicenathapong/ech-prime-web-v2'
export const GITHUB_API_BASE = 'https://api.github.com'

// ─── Bot Commands ────────────────────────────────────────────────────────

export interface BotCommand {
    command: string
    aliases: string[]
    description: string
    usage: string
    example: string
}

export const BOT_COMMANDS: BotCommand[] = [
    {
        command: '/help',
        aliases: ['help', 'h'],
        description: 'Hiển thị danh sách commands',
        usage: '/help',
        example: '/help',
    },
    {
        command: '/ci',
        aliases: ['ci', 'build'],
        description: 'Xem CI/CD status mới nhất',
        usage: '/ci [branch]',
        example: '/ci staging',
    },
    {
        command: '/deploy',
        aliases: ['deploy', 'staging', 'prod'],
        description: 'Xem deploy status',
        usage: '/deploy [staging|prod]',
        example: '/deploy staging',
    },
    {
        command: '/pr',
        aliases: ['pr', 'pull'],
        description: 'Xem PR list hoặc chi tiết PR',
        usage: '/pr [list|<number>]',
        example: '/pr 31',
    },
    {
        command: '/pr reviewer',
        aliases: [],
        description: 'Gợi ý reviewer cho PR',
        usage: '/pr reviewer <number>',
        example: '/pr reviewer 31',
    },
    {
        command: '/note',
        aliases: ['note', 'ghi'],
        description: 'Thêm ghi chú kiến thức cho bot',
        usage: '/note <nội dung>',
        example: '/note auth dùng JWT + refresh token, token hết hạn 15 phút',
    },
    {
        command: '/bot stats',
        aliases: ['stats', 'thongke'],
        description: 'Xem thống kê knowledge base của bot',
        usage: '/bot stats',
        example: '/bot stats',
    },
]

// ─── Team Mapping ────────────────────────────────────────────────────────

export interface TeamMember {
    name: string
    githubUsername: string
    role: string
    /** Domains they own (for reviewer suggestion) */
    domains: string[]
}

/**
 * Team mapping — used for reviewer suggestion & PR routing
 * larkOpenId will be populated from env or Lark API at runtime
 */
export const TEAM_MEMBERS: TeamMember[] = [
    {
        name: 'Nhân',
        githubUsername: 'haynoikonike',
        role: 'PM',
        domains: ['docs', 'planning'],
    },
    {
        name: 'Tín',
        githubUsername: 'tinnt-prime',
        role: 'SA',
        domains: ['architecture', 'infra', 'devops'],
    },
    {
        name: 'Lee',
        githubUsername: 'Mr-LeeB',
        role: 'BE Lead',
        domains: ['src/collections', 'src/lib', 'src/app/api', 'payload'],
    },
    {
        name: 'Đức',
        githubUsername: 'levietducprime',
        role: 'FE Lead',
        domains: ['src/components', 'src/app/(', 'src/store', 'tailwind', 'ui'],
    },
    {
        name: 'Ary',
        githubUsername: 'aryhibye',
        role: 'QA',
        domains: ['src/__tests__', 'test', 'playwright', 'vitest'],
    },
    {
        name: 'Jun',
        githubUsername: 'tranjunp2-cloud',
        role: 'UI/UX',
        domains: ['design', 'assets', 'public'],
    },
]

// ─── Domain → File Path Mapping (for reviewer suggestion) ────────────────

export const DOMAIN_PATTERNS: Record<string, string[]> = {
    frontend: ['src/components/', 'src/app/(', 'src/store/', 'tailwind'],
    backend: ['src/collections/', 'src/lib/', 'src/app/api/'],
    devops: ['.github/', '.do/', 'Dockerfile', 'docker-compose', 'scripts/'],
    testing: ['src/__tests__/', '*.test.ts', '*.spec.ts', 'vitest', 'playwright'],
    ui: ['public/', 'src/assets/', 'design/'],
}

// ─── Rate Limiting (prevent spam) ────────────────────────────────────────

/** Max messages per user per minute */
export const USER_RATE_LIMIT = 10

/** Max AI calls per user per hour */
export const AI_RATE_LIMIT = 30

// ─── Misc ────────────────────────────────────────────────────────────────

/** Event dedup window (ms) — 5 minutes */
export const EVENT_DEDUP_TTL = 5 * 60 * 1000

/** Max dedup cache size */
export const EVENT_DEDUP_MAX_SIZE = 1000

/** Conversation context TTL (ms) — 30 minutes */
export const CONVERSATION_TTL = 30 * 60 * 1000

/** Max messages in conversation context */
export const CONVERSATION_MAX_MESSAGES = 20

/** Bot name for @mention detection */
export const BOT_NAME = 'PrimeBot'

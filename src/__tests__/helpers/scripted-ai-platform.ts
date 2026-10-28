/**
 * Test double for the AI platform as prime-web's sitegen code sees it.
 *
 * `scripted` is the model under test: installing one (`scripted.mockImplementation(() => ({ chat:
 * { completions: { create } } }))`) makes an AI actor available; with no model, there is no actor and
 * the composed steps throw AiUnavailableError, exactly as in production without a platform.
 * `scriptedActorScope` builds the replacement for `@/lib/ai-platform/actor-scope`: the real
 * AiUnavailableError and the real helpers, with the platform-facing functions backed by `scripted`.
 * Each composed request is recorded in `scripted.taskIds` by task id.
 */

export type ScriptedReply = {
    choices: Array<{ message: { content: string | null } }>
    model?: string
    usage?: { prompt_tokens?: number; completion_tokens?: number }
}

export type ScriptedCreate = (opts: { messages: Array<{ role: string; content: string }> }) => Promise<ScriptedReply>

export const scripted = {
    create: null as ScriptedCreate | null,
    taskIds: [] as string[],
    mockImplementation(factory: () => { chat: { completions: { create: ScriptedCreate } } }): void {
        scripted.create = factory().chat.completions.create
    },
}

type ActorScopeModule = {
    AiUnavailableError: new () => Error
}

export function scriptedActorScope<T extends ActorScopeModule>(actual: T) {
    return {
        ...actual,
        currentAiActor: () => (scripted.create ? { tenantId: '1' } : null),
        completeComposed: async (taskId: string, messages: { system?: string; user: string }) => {
            if (!scripted.create) throw new actual.AiUnavailableError()
            scripted.taskIds.push(taskId)
            const reply = await scripted.create({
                messages: [
                    { role: 'system', content: messages.system ?? '' },
                    { role: 'user', content: messages.user },
                ],
            })
            return {
                content: reply.choices[0]!.message.content ?? '',
                model: reply.model ?? 'test',
                inputTokens: reply.usage?.prompt_tokens ?? 0,
                outputTokens: reply.usage?.completion_tokens ?? 0,
            }
        },
    }
}

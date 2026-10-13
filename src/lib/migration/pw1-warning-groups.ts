export function groupMigrationWarnings(value: unknown) {
    const groups: Record<'waitingBe'|'presentation'|'functionality'|'links'|'other', string[]> = {waitingBe:[],presentation:[],functionality:[],links:[],other:[]}
    for (const warning of Array.isArray(value) ? value : []) {
        if (typeof warning !== 'string') continue
        if (/BE readiness|identity mapping is not verified|separate BE import|destination entity mapping required|category CTA retains source URL|Brand .* CTA deferred|sourceSettings retained/.test(warning)) groups.waitingBe.push(warning)
        else if (/carousel layout not verified|brand|palette/i.test(warning)) groups.presentation.push(warning)
        else if (/filter\/sort|search mapping is pending/.test(warning)) groups.functionality.push(warning)
        else if (/source link|source URL|shared by source pages|temporary URL/i.test(warning)) groups.links.push(warning)
        else groups.other.push(warning)
    }
    return groups
}

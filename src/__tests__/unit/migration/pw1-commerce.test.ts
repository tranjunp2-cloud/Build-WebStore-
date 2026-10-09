import {expect,it} from 'vitest'
import {migrationAllowsTracking} from '@/lib/migration/pw1-commerce'
it('[TC-F35.M27] respects migrated tracking without changing ordinary sites', () => {
    expect(migrationAllowsTracking({pw1Commerce:{cart:true,orderTracking:false}})).toBe(false)
    expect(migrationAllowsTracking({pw1Commerce:{cart:true,orderTracking:true}})).toBe(true)
    expect(migrationAllowsTracking({cartWidget:{}})).toBe(true)
    expect(migrationAllowsTracking(null)).toBe(true)
})

// @vitest-environment node
import { describe, expect, it } from 'vitest'
import {createLocalReq,type Payload,type PayloadRequest} from 'payload'
import { PgDialect } from 'drizzle-orm/pg-core'
import { selectStoreIds } from '@/lib/migration/pw1-json/selectors'
import { isMigrationContext, localTarget, migrationContext, transactionClient } from '@/lib/migration/pw1-json/runtime'

describe('[TC-F42-IMP-001] Store selector preserves source identity', () => {
  it('sorts and deduplicates IDs beyond JS safe integer range', () => {
    // Arrange
    const ids = ['9007199254740993', '10', '2', '9007199254740992', '2']
    // Act
    const selected = selectStoreIds(ids, { all: true })
    // Assert
    expect(selected).toEqual(['2', '10', '9007199254740992', '9007199254740993'])
  })
  it('selects an inclusive sparse range and distinguishes a no-match range', () => {
    // Arrange
    const ids = ['205', '285', '300']
    // Act / Assert
    expect(selectStoreIds(ids, { fromStore: '205', toStore: '285' })).toEqual(['205', '285'])
    expect(selectStoreIds(ids, { fromStore: '206', toStore: '284' })).toEqual([])
    expect(selectStoreIds(ids, { stores: '285,205,285' })).toEqual(['205', '285'])
  })
  it.each([{}, {store: '205', all: true}, {fromStore:'205'}, {fromStore:'300',toStore:'205'}, {store:'0205'}, {stores:'205,'}, {store:'206'}])('rejects ambiguous or invalid selector %j', selector => {
    // Arrange / Act / Assert
    expect(() => selectStoreIds(['205', '285'], selector)).toThrow()
  })
})

describe('[TC-F42-IMP-006] Local clone target and unforgeable migration context', () => {
  it.each(['postgres://u:p@example.com/pw1_import_1886_test','postgres://u:p@localhost/primeweb','postgres://u:p@localhost/pw1_import_1886_test?host=example.com','postgres://u:p@localhost/pw1_import_1886_test?options=anything'])('rejects unsafe apply target without exposing URI', uri => {
    // Arrange / Act
    let message = ''
    try { localTarget(uri, true) } catch (error) { message = (error as Error).message }
    // Assert
    expect(message).toMatch(/^[A-Z_]+$/)
    expect(message).not.toContain(uri)
  })
  it('permits an explicitly named existing local DB without weakening host/options guards', () => {
    // Arrange
    const uri = 'postgres://u:p@localhost:5433/primeweb'
    // Act / Assert
    expect(() => localTarget(uri, true, 'primeweb')).not.toThrow()
    expect(() => localTarget(uri, true, 'other_db')).toThrow('LOCAL_DATABASE_NAME_MISMATCH')
    expect(() => localTarget(uri, true, '')).toThrow('LOCAL_DATABASE_NAME_MISMATCH')
    expect(() => localTarget('postgres://u:p@example.com/primeweb', true, 'primeweb')).toThrow('LOCAL_DATABASE_REQUIRED')
    expect(() => localTarget(uri + '?host=example.com', true, 'primeweb')).toThrow('DATABASE_OPTION_NOT_ALLOWED')
    expect(() => localTarget(uri + '?options=anything', true, 'primeweb')).toThrow('DATABASE_OPTION_NOT_ALLOWED')
    expect(localTarget(uri, true, 'primeweb').identity).toBe(localTarget(uri, false).identity)
  })
  it('requires an exact Neon host and database and verifies TLS for the target pool', () => {
    // Arrange
    const host = 'ep-test.c-6.us-east-2.aws.neon.tech'
    const uri = `postgresql://owner:secret@${host}/primeweb?sslmode=require&channel_binding=require`

    // Act
    const target = localTarget(uri, true, 'primeweb', host)

    // Assert
    expect(target.uri).not.toContain('sslmode=')
    expect(target.uri).not.toContain('channel_binding=')
    expect(target.ssl).toEqual({ rejectUnauthorized: true })
    expect(target.enableChannelBinding).toBe(true)
    expect(() => localTarget(uri, true, 'primeweb')).toThrow('LOCAL_DATABASE_REQUIRED')
    expect(() => localTarget(uri, true, 'other', host)).toThrow('LOCAL_DATABASE_NAME_MISMATCH')
    expect(() => localTarget(uri, true, undefined, host)).toThrow('ISOLATED_CLONE_REQUIRED')
  })
  it('rejects a mismatched Neon host, disabled TLS and connection overrides', () => {
    // Arrange
    const host = 'ep-test.c-6.us-east-2.aws.neon.tech'
    const base = `postgresql://owner:secret@${host}/primeweb`

    // Act / Assert
    expect(() => localTarget(base, true, 'primeweb', 'ep-other.c-6.us-east-2.aws.neon.tech')).toThrow('NEON_TARGET_HOST_MISMATCH')
    expect(() => localTarget(base, true, 'primeweb', `${host}.evil.example`)).toThrow('NEON_TARGET_HOST_MISMATCH')
    expect(() => localTarget(`${base}?sslmode=disable`, true, 'primeweb', host)).toThrow('NEON_SSL_REQUIRED')
    expect(() => localTarget(`${base}?host=localhost`, true, 'primeweb', host)).toThrow('DATABASE_OPTION_NOT_ALLOWED')
    expect(() => localTarget(`${base}?channel_binding=disable`, true, 'primeweb', host)).toThrow('DATABASE_OPTION_NOT_ALLOWED')
  })
  it('preserves private capability through actual Payload local request normalization',async()=>{
    // Arrange — skip localization/dataloader services, exercise actual request context merge.
    const payload={config:{localization:false,serverURL:'http://localhost'}} as unknown as Payload
    const request={context:migrationContext(),i18n:{t:()=>''},payloadDataLoader:{}} as unknown as Partial<PayloadRequest>
    // Act
    const first=await createLocalReq({req:request},payload)
    const second=await createLocalReq({req:first},payload)
    // Assert
    expect(isMigrationContext(first.context)).toBe(true)
    expect(isMigrationContext(second.context)).toBe(true)
    expect(isMigrationContext({migrationProfile:'pw1-json-v1'})).toBe(false)
  })
  it('accepts clone and read-only original while fingerprint excludes credentials', () => {
    // Arrange / Act
    const a = localTarget('postgres://u:a@localhost:5433/pw1_import_1886_test', true)
    const b = localTarget('postgres://v:b@localhost:5433/pw1_import_1886_test', true)
    // Assert
    expect(a.identity).toBe(b.identity)
    expect(() => localTarget('postgres://u:p@localhost:5433/primeweb', false)).not.toThrow()
    expect(isMigrationContext(migrationContext())).toBe(true)
    expect(isMigrationContext({ migration: true })).toBe(false)
    expect(isMigrationContext(JSON.parse(JSON.stringify(migrationContext())))).toBe(false)
  })
})

describe('[TC-F42-IMP-011] Transaction parameter binding', () => {
  it('binds hostile values and repeated positional references without interpolation', async () => {
    // Arrange
    const captured: ReturnType<PgDialect['sqlToQuery']>[] = []
    const client = transactionClient({execute: async query => { captured.push(new PgDialect().sqlToQuery(query)); return {rows:[{ok:1}],rowCount:1} }})
    const hostile = "'; DROP TABLE users; --"
    // Act
    const result = await client.query('SELECT $2, $1, $2', [42, hostile])
    // Assert
    expect(captured[0].sql).toBe('SELECT $1, $2, $3')
    expect(captured[0].params).toEqual([hostile,42,hostile])
    expect(result).toEqual({rows:[{ok:1}],rowCount:1})
    await client.query('SELECT $1::text[]', [['alpha', 'beta']])
    expect(captured[1].sql).toBe('SELECT $1::text[]')
    expect(captured[1].params).toEqual([['alpha','beta']])
    await expect(client.query('SELECT $2',[1])).rejects.toThrow('SQL_PARAMETER_MISSING')
  })
})

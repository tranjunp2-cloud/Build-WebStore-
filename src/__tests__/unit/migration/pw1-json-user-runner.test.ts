// @vitest-environment node
import { describe, expect, it } from 'vitest'
import { argumentsForUsers, runUserImport } from '@/lib/migration/pw1-json/user-runner'

describe('[TC-F42-IMP-USERS] User migration CLI contract', () => {
  it('accepts valid manifest and store selectors', () => {
    const single = argumentsForUsers(['--manifest', '/path/to/import-manifest.json', '--store', '205'])
    expect(single).toMatchObject({ manifest: '/path/to/import-manifest.json', store: '205' })

    const multi = argumentsForUsers(['--manifest', '/path/to/import-manifest.json', '--stores', '205,285', '--dry-run'])
    expect(multi).toMatchObject({ manifest: '/path/to/import-manifest.json', stores: '205,285', dryRun: true })

    const range = argumentsForUsers(['--manifest', '/path/to/import-manifest.json', '--from-store', '100', '--to-store', '200', '--output-file', '/private/users.json', '--output-master', '/private/master-with-destination.json'])
    expect(range).toMatchObject({ fromStore: '100', toStore: '200', outputFile: '/private/users.json', outputMaster: '/private/master-with-destination.json' })

    const all = argumentsForUsers(['--manifest', '/path/to/import-manifest.json', '--all', '--local-database', 'primeweb'])
    expect(all).toMatchObject({ all: true, localDatabase: 'primeweb' })
  })

  it('handles help option cleanly', async () => {
    const helpArgs = argumentsForUsers(['--help'])
    expect(helpArgs.help).toBe(true)
    const result = await runUserImport(helpArgs)
    expect(result).toEqual([])
  })

  it.each([
    [['--store', '205']],
    [['--manifest', '/m']],
    [['--manifest', '/m', '--store', '205', '--all']],
    [['--manifest', '/m', '--from-store', '100']],
    [['--manifest', '/m', '--to-store', '200']],
    [['--manifest', '/m', '--store', '205', '--local-database', 'invalid db name!']],
    [['--manifest', '/m', '--store', '205', '--output-master', 'relative.json']],
    [['--invalid-flag']],
  ])('rejects invalid argument combinations %j', args => {
    expect(() => argumentsForUsers(args)).toThrow()
  })
})

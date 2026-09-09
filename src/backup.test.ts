import { describe, expect, it } from 'vitest'
import { createBackup, parseBackup } from './backup'

describe('learning data backups', () => {
  it('exports only Learning Vim keys', () => {
    const values = new Map([
      ['learning-vim:locale', 'ja'],
      ['unrelated:key', 'secret'],
    ])
    const storage = {
      length: values.size,
      key: (index: number) => [...values.keys()][index] ?? null,
      getItem: (key: string) => values.get(key) ?? null,
    }

    expect(createBackup(storage, '1.0.0').data).toEqual({ 'learning-vim:locale': 'ja' })
  })

  it('accepts a valid backup', () => {
    const backup = parseBackup(JSON.stringify({
      schemaVersion: 1,
      exportedAt: '2026-09-09T00:00:00.000Z',
      appVersion: '1.0.0',
      data: { 'learning-vim:locale': 'en' },
    }))

    expect(backup.data['learning-vim:locale']).toBe('en')
  })

  it('rejects unrelated storage keys', () => {
    expect(() => parseBackup(JSON.stringify({
      schemaVersion: 1,
      data: { 'another-app:token': 'nope' },
    }))).toThrow('invalid learning data')
  })
})

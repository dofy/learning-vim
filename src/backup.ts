export const storagePrefix = 'learning-vim:'

export interface LearningBackup {
  schemaVersion: 1
  exportedAt: string
  appVersion: string
  data: Record<string, string>
}

export function createBackup(
  storage: Pick<Storage, 'key' | 'getItem' | 'length'>,
  appVersion: string,
): LearningBackup {
  const data: Record<string, string> = {}

  for (let index = 0; index < storage.length; index += 1) {
    const key = storage.key(index)
    if (!key?.startsWith(storagePrefix)) continue
    const value = storage.getItem(key)
    if (value !== null) data[key] = value
  }

  return {
    schemaVersion: 1,
    exportedAt: new Date().toISOString(),
    appVersion,
    data,
  }
}

export function parseBackup(source: string): LearningBackup {
  if (source.length > 5_000_000) throw new Error('Backup is too large')

  const parsed: unknown = JSON.parse(source)
  if (!parsed || typeof parsed !== 'object') throw new Error('Backup must be an object')

  const candidate = parsed as Partial<LearningBackup>
  if (candidate.schemaVersion !== 1 || !candidate.data || typeof candidate.data !== 'object') {
    throw new Error('Unsupported backup format')
  }

  const entries = Object.entries(candidate.data)
  if (entries.length > 1_000) throw new Error('Backup has too many entries')
  for (const [key, value] of entries) {
    if (!key.startsWith(storagePrefix) || typeof value !== 'string') {
      throw new Error('Backup contains invalid learning data')
    }
  }

  return {
    schemaVersion: 1,
    exportedAt: typeof candidate.exportedAt === 'string' ? candidate.exportedAt : '',
    appVersion: typeof candidate.appVersion === 'string' ? candidate.appVersion : '',
    data: Object.fromEntries(entries),
  }
}

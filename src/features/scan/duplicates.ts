/**
 * Two ways an import can repeat itself: the same file added twice (identical
 * bytes), and two different scans of the same page (same page number). The
 * first is dropped at import; the second is kept, because the second scan may
 * be the better one, and flagged so the user can remove the one they do not want.
 */
import { frameAt } from '../../domain/frameMap'

export interface SkippedDuplicate {
  /** File that was not added. */
  name: string
  /** Scan already in the list with the same content. */
  sameAs: string
}

/**
 * Split `files` into the ones to import and the ones whose content is already
 * in `existing` (name by hash) or earlier in the same batch.
 */
export function splitDuplicateFiles<F extends { name: string }>(files: { file: F; hash: string | null }[], existing: Map<string, string>): { fresh: F[]; skipped: SkippedDuplicate[] } {
  const seen = new Map(existing)
  const fresh: F[] = []
  const skipped: SkippedDuplicate[] = []
  for (const { file, hash } of files) {
    const sameAs = hash ? seen.get(hash) : undefined
    if (sameAs !== undefined) {
      skipped.push({ name: file.name, sameAs })
      continue
    }
    if (hash) seen.set(hash, file.name)
    fresh.push(file)
  }
  return { fresh, skipped }
}

export interface PageDuplicate {
  page: number
  /** Names of the other scans claiming the same page. */
  others: string[]
  /** Whether this scan's frames are the ones currently cut for the page. */
  inUse: boolean
}

/**
 * For every scan that shares its page number with another, which scans those
 * are and whether this one's frames are the ones in `outputFrames`.
 */
export function pageDuplicates(
  scans: { id: string; name: string; page: number | null }[],
  outputFrames: Map<number, { scanId?: string }>,
  perPage: number,
): Map<string, PageDuplicate> {
  const byPage = new Map<number, typeof scans>()
  for (const s of scans) {
    if (s.page === null) continue
    const list = byPage.get(s.page) ?? []
    list.push(s)
    byPage.set(s.page, list)
  }
  const out = new Map<string, PageDuplicate>()
  for (const [page, list] of byPage) {
    if (list.length < 2) continue
    const used = outputFrames.get(frameAt(page, 0, perPage))?.scanId
    for (const s of list) out.set(s.id, { page, others: list.filter((o) => o !== s).map((o) => o.name), inUse: used === s.id })
  }
  return out
}

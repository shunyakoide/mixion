import { useEffect, useMemo, useState } from 'react'

/**
 * Object URLs for blobs, created and revoked inside an effect. A `useMemo` URL
 * would be revoked by StrictMode's mount → cleanup → mount cycle and never recreated.
 */
export function useObjectUrls(blobs: Blob[] | null): string[] {
  const [urls, setUrls] = useState<string[]>([])
  useEffect(() => {
    const next = blobs?.map((b) => URL.createObjectURL(b)) ?? []
    // The URLs are the external resource this effect owns; state is how the render learns about them.
    // eslint-disable-next-line react/set-state-in-effect
    setUrls(next)
    return () => {
      next.forEach((u) => URL.revokeObjectURL(u))
      setUrls([])
    }
  }, [blobs])
  return urls
}

export function useObjectUrl(blob: Blob | null): string | null {
  const list = useMemo(() => (blob ? [blob] : null), [blob])
  return useObjectUrls(list)[0] ?? null
}

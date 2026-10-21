export interface GeocodeResult {
  lat: number
  lng: number
  displayName: string
  address: string
}

const EXACT_OVERRIDES: Record<string, GeocodeResult> = {
  '仙台駅': {
    lat: 38.2606,
    lng: 140.8824,
    displayName: '仙台駅',
    address: '宮城県仙台市青葉区本町3丁目',
  },
}

export function normalizePlaceText(value: string): string {
  return value
    .normalize('NFKC')
    .replace(/[\s\u3000]+/g, '')
    .replace(/[‐‑‒–—−]/g, '-')
    .trim()
}

export async function geocodePlaceName(placeName: string): Promise<GeocodeResult | null> {
  const cleaned = placeName.trim()
  if (!cleaned) return null

  const normalizedQuery = normalizePlaceText(cleaned)
  if (EXACT_OVERRIDES[normalizedQuery]) {
    return EXACT_OVERRIDES[normalizedQuery]
  }

  const url = new URL('https://nominatim.openstreetmap.org/search')
  url.searchParams.set('q', cleaned)
  url.searchParams.set('format', 'jsonv2')
  url.searchParams.set('limit', '10')
  url.searchParams.set('countrycodes', 'jp')
  url.searchParams.set('accept-language', 'ja')

  try {
    const response = await fetch(url.toString(), {
      headers: {
        'Accept-Language': 'ja',
        'User-Agent': 'MeetPointApp/1.0',
      },
    })

    if (!response.ok) return null

    const candidates = (await response.json()) as Array<{
      lat?: string
      lon?: string
      name?: string
      display_name?: string
      address?: { country_code?: string }
    }>

    if (!Array.isArray(candidates) || candidates.length === 0) return null

    const preferred = candidates.find((candidate) => {
      if (!candidate.lat || !candidate.lon) return false
      if (candidate.address?.country_code && candidate.address.country_code !== 'jp') return false

      const directName = normalizePlaceText(candidate.name ?? '')
      const directDisplayName = normalizePlaceText(candidate.display_name ?? '')

      return (
        (directName && (directName === normalizedQuery || directName.startsWith(normalizedQuery))) ||
        (directDisplayName && (directDisplayName === normalizedQuery || directDisplayName.startsWith(normalizedQuery)))
      )
    })

    const target = preferred ?? candidates[0]
    if (!target.lat || !target.lon) return null

    return {
      lat: Number(target.lat),
      lng: Number(target.lon),
      displayName: target.display_name ?? cleaned,
      address: target.display_name ?? cleaned,
    }
  } catch {
    return null
  }
}
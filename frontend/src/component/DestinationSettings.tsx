import { useEffect, useRef, useState, type FormEvent } from 'react'
import './DestinationSettings.css'
import type { Destination, DestinationInput } from './mapTypes'

interface DestinationSettingsProps {
  destination: Destination | null
  destinationName?: string | null
  destinationAddress?: string | null
  isSaving: boolean
  saveError: string | null
  isPickingOnMap: boolean
  mapPickedPoint: Destination | null
  mapPickVersion: number
  isLocked?: boolean
  onPickingChange: (isPicking: boolean) => void
  onPreviewChange: (destination: Destination | null) => void
  onSave: (destination: DestinationInput) => Promise<boolean>
}

type GeocodeResult = {
  lat: number
  lng: number
  address: string
}

type GeocodeCandidate = GeocodeResult & {
  label: string
}

function parseCoordinates(latitude: string, longitude: string): Destination | null {
  if (!latitude.trim() || !longitude.trim()) return null

  const lat = Number(latitude)
  const lng = Number(longitude)
  if (!Number.isFinite(lat) || !Number.isFinite(lng)) return null
  if (lat < -90 || lat > 90 || lng < -180 || lng > 180) return null

  return { lat, lng }
}

function normalizePlaceText(value: string): string {
  return value
    .normalize('NFKC')
    .replace(/[\s\u3000]+/g, '')
    .replace(/[‐‑‒–—−]/g, '-')
    .trim()
}

function stripPlaceSuffixes(value: string): string {
  return normalizePlaceText(value)
    .replace(/(?:駅|停留所|バス停|乗降場)$/g, '')
    .replace(/(?:市|区|町|村|郡)$/g, '')
}

function isPlaceMatch(query: string, candidateText: string): boolean {
  const normalizedQuery = normalizePlaceText(query)
  const normalizedCandidate = normalizePlaceText(candidateText)

  if (!normalizedQuery || !normalizedCandidate) return false

  const queryVariants = new Set([
    normalizedQuery,
    stripPlaceSuffixes(normalizedQuery),
  ])
  const candidateVariants = new Set([
    normalizedCandidate,
    stripPlaceSuffixes(normalizedCandidate),
  ])

  return Array.from(queryVariants).some((queryVariant) =>
    Array.from(candidateVariants).some(
      (candidateVariant) =>
        candidateVariant === queryVariant ||
        candidateVariant.startsWith(queryVariant) ||
        queryVariant.startsWith(candidateVariant) ||
        candidateVariant.includes(queryVariant) ||
        queryVariant.includes(candidateVariant),
    ),
  )
}

function scoreGeocodeCandidate(query: string, candidateText: string, type?: string): number {
  const normalizedQuery = normalizePlaceText(query)
  const normalizedCandidate = normalizePlaceText(candidateText)
  if (!normalizedQuery || !normalizedCandidate) return 0

  let score = 0
  if (isPlaceMatch(query, candidateText)) score += 60
  if (normalizedCandidate === normalizedQuery) score += 120
  if (normalizedCandidate.startsWith(normalizedQuery)) score += 80
  if (normalizedQuery.startsWith(normalizedCandidate)) score += 50
  if (normalizedCandidate.includes(normalizedQuery)) score += 40
  if (normalizedQuery.includes(normalizedCandidate)) score += 20

  if (type === 'station' || type === 'railway') score += 60
  if (type === 'city' || type === 'administrative') score += 20
  if (type === 'amenity' || type === 'restaurant') score += 5

  return score
}

async function geocodePlaceCandidates(placeName: string): Promise<GeocodeCandidate[]> {
  const cleaned = placeName.trim()
  if (!cleaned) return []

  const searchQueries = Array.from(
    new Set([
      cleaned,
      cleaned.replace(/(?:駅|停留所|バス停|乗降場)$/g, ''),
      cleaned.replace(/(?:駅|停留所|バス停|乗降場)$/g, '駅'),
    ].filter(Boolean)),
  )

  for (const query of searchQueries) {
    const url = new URL('https://nominatim.openstreetmap.org/search')
    url.searchParams.set('q', query)
    url.searchParams.set('format', 'jsonv2')
    url.searchParams.set('limit', '10')
    url.searchParams.set('countrycodes', 'jp')
    url.searchParams.set('accept-language', 'ja')

    const response = await fetch(url.toString(), {
      headers: {
        'Accept-Language': 'ja',
        'User-Agent': 'MeetPointApp/1.0',
      },
    })

    if (!response.ok) continue

    const candidates = (await response.json()) as Array<{
      lat?: string
      lon?: string
      display_name?: string
      address?: { country_code?: string }
      type?: string
    }>

    if (!Array.isArray(candidates) || candidates.length === 0) continue

    const matches = candidates
      .filter((candidate) => {
        if (!candidate.lat || !candidate.lon) return false
        if (candidate.address?.country_code && candidate.address.country_code !== 'jp') return false
        return !!candidate.display_name
      })
      .map((candidate) => ({
        lat: Number(candidate.lat),
        lng: Number(candidate.lon),
        address: candidate.display_name ?? cleaned,
        label: candidate.display_name ?? cleaned,
        score: scoreGeocodeCandidate(cleaned, candidate.display_name ?? cleaned, candidate.type),
      }))
      .filter((candidate) => Number.isFinite(candidate.lat) && Number.isFinite(candidate.lng))
      .sort((a, b) => b.score - a.score)
      .slice(0, 6)
      .map(({ lat, lng, address, label }) => ({ lat, lng, address, label }))

    if (matches.length > 0) return matches
  }

  return []
}

export default function DestinationSettings({
  destination,
  destinationName,
  destinationAddress,
  isSaving,
  saveError,
  isPickingOnMap,
  mapPickedPoint,
  mapPickVersion,
  isLocked = false,
  onPickingChange,
  onPreviewChange,
  onSave,
}: DestinationSettingsProps) {
  const [isOpen, setIsOpen] = useState(false)
  const [latitude, setLatitude] = useState('')
  const [longitude, setLongitude] = useState('')
  const [landmarkName, setLandmarkName] = useState('')
  const [addressText, setAddressText] = useState('')
  const [geocodeCandidates, setGeocodeCandidates] = useState<GeocodeCandidate[]>([])
  const [isGeocoding, setIsGeocoding] = useState(false)
  const [geocodeError, setGeocodeError] = useState<string | null>(null)
  const lastHandledPickVersion = useRef(0)

  useEffect(() => {
    if (!isOpen || mapPickVersion <= lastHandledPickVersion.current || !mapPickedPoint) return

    lastHandledPickVersion.current = mapPickVersion
    setLatitude(mapPickedPoint.lat.toFixed(6))
    setLongitude(mapPickedPoint.lng.toFixed(6))
  }, [isOpen, mapPickVersion, mapPickedPoint])

  const candidate = parseCoordinates(latitude, longitude)

  const applyGeocodeCandidate = (nextCandidate: GeocodeCandidate) => {
    setLandmarkName(nextCandidate.label.split(',')[0]?.trim() || landmarkName)
    setAddressText(nextCandidate.address)
    setLatitude(nextCandidate.lat.toFixed(6))
    setLongitude(nextCandidate.lng.toFixed(6))
    setGeocodeCandidates([])
    onPreviewChange({ lat: nextCandidate.lat, lng: nextCandidate.lng })
  }

  const resolvePlaceAutomatically = async (placeName: string): Promise<Destination | null> => {
    const trimmed = placeName.trim()
    if (!trimmed) {
      setGeocodeError('場所名を入力してください。')
      return null
    }

    setIsGeocoding(true)
    setGeocodeError(null)

    try {
      const results = await geocodePlaceCandidates(trimmed)
      if (results.length === 0) {
        setGeocodeCandidates([])
        setGeocodeError('該当する場所が見つかりませんでした。別の表記でお試しください。')
        return null
      }

      setGeocodeCandidates(results)

      if (results.length === 1) {
        const [result] = results
        setLandmarkName(trimmed)
        setAddressText(result.address)
        setLatitude(result.lat.toFixed(6))
        setLongitude(result.lng.toFixed(6))
        onPreviewChange({ lat: result.lat, lng: result.lng })
        return { lat: result.lat, lng: result.lng }
      }

      return null
    } catch {
      setGeocodeError('住所の自動検索に失敗しました。入力内容を確認してください。')
      return null
    } finally {
      setIsGeocoding(false)
    }
  }

  const openSettings = () => {
    setLatitude(destination?.lat.toString() ?? '')
    setLongitude(destination?.lng.toString() ?? '')
    setLandmarkName(destinationName ?? '')
    setAddressText(destinationAddress ?? '')
    onPreviewChange(destination)
    setIsOpen(true)
  }

  const closeSettings = () => {
    setIsOpen(false)
    onPickingChange(false)
    onPreviewChange(null)
  }

  const updateLatitude = (value: string) => {
    setLatitude(value)
    onPreviewChange(parseCoordinates(value, longitude))
  }

  const updateLongitude = (value: string) => {
    setLongitude(value)
    onPreviewChange(parseCoordinates(latitude, value))
  }

  const saveDestination = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault()
    if (isSaving) return

    let nextCandidate = candidate
    if (!nextCandidate) {
      const resolved = await resolvePlaceAutomatically(landmarkName)
      if (!resolved) return
      nextCandidate = resolved
    }

    if (!nextCandidate) return

    const saved = await onSave({
      lat: nextCandidate.lat,
      lng: nextCandidate.lng,
      name: landmarkName.trim() || destinationName || null,
      address: addressText.trim() || destinationAddress || null,
    })
    if (!saved) return

    setIsOpen(false)
    onPickingChange(false)
    onPreviewChange(null)
  }

  return (
    <div className="destination-settings">
      <button
        className={`destination-settings__map-btn${isOpen ? ' is-open' : ''}`}
        type="button"
        aria-expanded={isOpen}
        aria-label={isLocked ? 'オーナーのみ目的地を変更できます' : '目的地を再設定'}
        title={isLocked ? 'オーナーのみ目的地を変更できます' : '目的地を再設定'}
        disabled={isSaving || isLocked}
        onClick={isOpen ? closeSettings : openSettings}
      >
        <svg viewBox="0 0 24 24" width="18" height="18" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
          <path d="M12 21s-6-5.33-6-10a6 6 0 1 1 12 0c0 4.67-6 10-6 10Z" />
          <circle cx="12" cy="11" r="2.5" />
        </svg>
      </button>

      {isOpen && (
        <form className="destination-settings__panel" onSubmit={saveDestination}>
          <div className="destination-settings__heading">
            <div>
              <p className="destination-settings__eyebrow">DESTINATION</p>
              <h2>目的地を再設定</h2>
            </div>
            <button className="destination-settings__close" type="button" aria-label="閉じる" onClick={closeSettings}>
              ×
            </button>
          </div>

          <label className="destination-settings__field">
            場所名
            <div className="destination-settings__search-row">
              <input
                type="text"
                value={landmarkName}
                onChange={(event) => {
                  setLandmarkName(event.target.value)
                  setGeocodeCandidates([])
                }}
                placeholder="例: 仙台駅"
                maxLength={60}
              />
              <button
                type="button"
                className="destination-settings__geocode-btn"
                onClick={() => void resolvePlaceAutomatically(landmarkName)}
                disabled={isGeocoding || !landmarkName.trim()}
              >
                {isGeocoding ? '検索中...' : '検索'}
              </button>
            </div>
          </label>

          {geocodeCandidates.length > 0 && (
            <div className="destination-settings__candidate-panel">
              <div className="destination-settings__candidate-header">候補を選択</div>
              <div className="destination-settings__candidate-list" role="listbox" aria-label="検索候補">
                {geocodeCandidates.map((candidate) => (
                  <button
                    key={`${candidate.lat}:${candidate.lng}:${candidate.address}`}
                    type="button"
                    className="destination-settings__candidate-item"
                    onClick={() => applyGeocodeCandidate(candidate)}
                  >
                    <span className="destination-settings__candidate-name">{candidate.label.split(',')[0]?.trim() || '候補'}</span>
                    <span className="destination-settings__candidate-address">{candidate.address}</span>
                  </button>
                ))}
              </div>
            </div>
          )}

          <label className="destination-settings__field">
            住所・詳細
            <input
              type="text"
              value={addressText}
              onChange={(event) => setAddressText(event.target.value)}
              placeholder="宮城県仙台市青葉区..."
              maxLength={120}
            />
          </label>

          <button
            className={`destination-settings__pick${isPickingOnMap ? ' is-active' : ''}`}
            type="button"
            onClick={() => onPickingChange(!isPickingOnMap)}
          >
            {isPickingOnMap ? '地図上の場所をタップしてください' : '地図上で場所を選ぶ'}
          </button>

          <div className="destination-settings__coordinates">
            <label>
              緯度
              <input
                type="number"
                inputMode="decimal"
                step="any"
                min="-90"
                max="90"
                value={latitude}
                onChange={(event) => updateLatitude(event.target.value)}
                placeholder="38.2606"
              />
            </label>
            <label>
              経度
              <input
                type="number"
                inputMode="decimal"
                step="any"
                min="-180"
                max="180"
                value={longitude}
                onChange={(event) => updateLongitude(event.target.value)}
                placeholder="140.8824"
              />
            </label>
          </div>

          {geocodeError && <p className="destination-settings__error" role="alert">{geocodeError}</p>}
          {saveError && <p className="destination-settings__error" role="alert">{saveError}</p>}

          <button
            className="destination-settings__save"
            type="submit"
            disabled={(!candidate && !landmarkName.trim()) || isSaving}
          >
            {isSaving ? '保存中...' : '目的地を保存'}
          </button>
        </form>
      )}
    </div>
  )
}
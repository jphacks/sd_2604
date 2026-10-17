import { useEffect, useRef, useState, type FormEvent } from 'react'
import './DestinationSettings.css'
import type { Destination, DestinationInput } from './mapTypes'

const exactPlaceOverrides: Record<string, { lat: number; lng: number; displayName: string }> = {
  '仙台駅': { lat: 38.2606, lng: 140.8824, displayName: '仙台駅' },
}

function normalizePlaceText(value: string): string {
  return value
    .normalize('NFKC')
    .replace(/[\s\u3000]+/g, '')
    .replace(/[‐‑‒–—−]/g, '-')
    .trim()
}

async function geocodePlaceName(placeName: string): Promise<{ lat: number; lng: number; displayName: string } | null> {
  const cleaned = placeName.trim()
  if (!cleaned) return null

  const normalizedQuery = normalizePlaceText(cleaned)
  const exactOverride = exactPlaceOverrides[normalizedQuery]
  if (exactOverride) return exactOverride

  const url = new URL('https://nominatim.openstreetmap.org/search')
  url.searchParams.set('q', cleaned)
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

  if (!preferred || !preferred.lat || !preferred.lon) return null

  return {
    lat: Number(preferred.lat),
    lng: Number(preferred.lon),
    displayName: preferred.display_name ?? cleaned,
  }
}

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

function parseCoordinates(latitude: string, longitude: string): Destination | null {
  if (!latitude.trim() || !longitude.trim()) return null

  const lat = Number(latitude)
  const lng = Number(longitude)
  if (!Number.isFinite(lat) || !Number.isFinite(lng)) return null
  if (lat < -90 || lat > 90 || lng < -180 || lng > 180) return null

  return { lat, lng }
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
  const [placeQuery, setPlaceQuery] = useState('')
  const [landmarkName, setLandmarkName] = useState('')
  const [addressText, setAddressText] = useState('')
  const [searchError, setSearchError] = useState<string | null>(null)
  const [isSearching, setIsSearching] = useState(false)
  const lastHandledPickVersion = useRef(0)

  useEffect(() => {
    if (!isOpen || mapPickVersion <= lastHandledPickVersion.current || !mapPickedPoint) return

    lastHandledPickVersion.current = mapPickVersion
    setLatitude(mapPickedPoint.lat.toFixed(6))
    setLongitude(mapPickedPoint.lng.toFixed(6))
  }, [isOpen, mapPickVersion, mapPickedPoint])

  const candidate = parseCoordinates(latitude, longitude)

  const handleSearchPlace = async () => {
    const trimmed = placeQuery.trim()
    if (!trimmed) {
      setSearchError('場所名を入力してください。')
      return
    }

    setIsSearching(true)
    setSearchError(null)
    try {
      const result = await geocodePlaceName(trimmed)
      if (!result) {
        setSearchError('目的地を見つけられませんでした。別の表記でお試しください。')
        return
      }

      setLandmarkName(trimmed)
      setAddressText(result.displayName)
      setLatitude(result.lat.toFixed(6))
      setLongitude(result.lng.toFixed(6))
      setPlaceQuery(result.displayName)
      onPreviewChange({ lat: result.lat, lng: result.lng })
    } catch {
      setSearchError('検索に失敗しました。別の表記でお試しください。')
    } finally {
      setIsSearching(false)
    }
  }

  const openSettings = () => {
    if (isLocked) return
    setLatitude(destination?.lat.toString() ?? '')
    setLongitude(destination?.lng.toString() ?? '')
    setPlaceQuery(destinationName ?? '')
    setLandmarkName(destinationName ?? '')
    setAddressText(destinationAddress ?? '')
    setSearchError(null)
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
    if (!candidate || isSaving) return

    const saved = await onSave({
      lat: candidate.lat,
      lng: candidate.lng,
      name: landmarkName.trim() || destinationName || placeQuery.trim() || null,
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
        className="destination-settings__trigger"
        type="button"
        aria-expanded={isOpen}
        disabled={isSaving || isLocked}
        onClick={isOpen ? closeSettings : openSettings}
      >
        {isOpen ? '閉じる' : destination ? '目的地を変更' : '目的地を設定'}
      </button>

      {isOpen && (
        <form className="destination-settings__panel" onSubmit={saveDestination}>
          <div className="destination-settings__heading">
            <div>
              <p className="destination-settings__eyebrow">DESTINATION</p>
              <h2>目的地を設定</h2>
            </div>
            <button className="destination-settings__close" type="button" aria-label="閉じる" onClick={closeSettings}>
              ×
            </button>
          </div>

          <p className="destination-settings__hint">
            地図をクリックするか、場所名を検索して座標を補完してください。
          </p>

          <div className="destination-settings__search-row" style={{ display: 'flex', gap: 8, marginBottom: 12 }}>
            <input
              type="text"
              value={placeQuery}
              onChange={(event) => setPlaceQuery(event.target.value)}
              placeholder="例: 仙台駅"
              style={{ flex: 1, padding: '10px 12px', borderRadius: 8, border: '1px solid #c7d0ca', fontSize: 16 }}
            />
            <button
              type="button"
              onClick={handleSearchPlace}
              disabled={isSearching || !placeQuery.trim()}
              style={{ padding: '10px 14px', borderRadius: 8, border: '1px solid #c7d0ca', background: '#dfe9e3', fontWeight: 700, cursor: isSearching || !placeQuery.trim() ? 'not-allowed' : 'pointer' }}
            >
              {isSearching ? '検索中...' : '住所を自動検索'}
            </button>
          </div>

          {searchError && <p className="destination-settings__error" role="alert">{searchError}</p>}

          <button
            className={`destination-settings__pick${isPickingOnMap ? ' is-active' : ''}`}
            type="button"
            onClick={() => onPickingChange(!isPickingOnMap)}
          >
            {isPickingOnMap ? '地図上の場所をクリックしてください' : '地図上で場所を選ぶ'}
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
                placeholder="例: 38.2606"
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
                placeholder="例: 140.8824"
              />
            </label>
          </div>

          <label style={{ display: 'grid', gap: 6 }}>
            <span>目的地名</span>
            <input
              type="text"
              value={landmarkName}
              onChange={(event) => setLandmarkName(event.target.value)}
              placeholder="例: 仙台駅"
            />
          </label>

          <label style={{ display: 'grid', gap: 6 }}>
            <span>住所・詳細</span>
            <input
              type="text"
              value={addressText}
              onChange={(event) => setAddressText(event.target.value)}
              placeholder="例: 仙台市青葉区一番町"
            />
          </label>

          <p className="destination-settings__scope-note">
            保存するとこの部屋の共有地図に反映されます。URL の room パラメータに部屋IDが保持されます。
          </p>

          {saveError && <p className="destination-settings__error" role="alert">{saveError}</p>}

          <button className="destination-settings__save" type="submit" disabled={!candidate || isSaving}>
            {isSaving ? '保存中...' : '目的地を共有保存'}
          </button>
        </form>
      )}
    </div>
  )
}

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

function parseCoordinates(latitude: string, longitude: string): Destination | null {
  if (!latitude.trim() || !longitude.trim()) return null

  const lat = Number(latitude)
  const lng = Number(longitude)
  if (!Number.isFinite(lat) || !Number.isFinite(lng)) return null
  if (lat < -90 || lat > 90 || lng < -180 || lng > 180) return null

  return { lat, lng }
}

interface GeocodeResult {
  lat: number
  lng: number
  displayName: string
  address: string
}

async function geocodePlaceName(query: string): Promise<GeocodeResult | null> {
  const normalized = query.trim()
  if (!normalized) return null

  const url = new URL('https://nominatim.openstreetmap.org/search')
  url.searchParams.set('q', normalized)
  url.searchParams.set('format', 'jsonv2')
  url.searchParams.set('limit', '1')
  url.searchParams.set('accept-language', 'ja')

  const response = await fetch(url.toString(), {
    headers: {
      Accept: 'application/json',
      'Accept-Language': 'ja',
    },
  })

  if (!response.ok) {
    throw new Error('Geocoding failed')
  }

  const records = (await response.json()) as Array<{ lat?: string; lon?: string; display_name?: string; address?: Record<string, string> }>
  const first = records[0]
  if (!first || typeof first.lat !== 'string' || typeof first.lon !== 'string') return null

  const lat = Number(first.lat)
  const lng = Number(first.lon)
  if (!Number.isFinite(lat) || !Number.isFinite(lng)) return null

  return {
    lat,
    lng,
    displayName: first.display_name || normalized,
    address: first.address && typeof first.address === 'object'
      ? Object.values(first.address).filter((value) => typeof value === 'string' && value.trim()).slice(0, 3).join(' / ')
      : normalized,
  }
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

  const resolvePlaceAutomatically = async (placeName: string): Promise<Destination | null> => {
    const trimmed = placeName.trim()
    if (!trimmed) {
      setGeocodeError('場所名を入力してください。')
      return null
    }

    setIsGeocoding(true)
    setGeocodeError(null)

    try {
      const result = await geocodePlaceName(trimmed)
      if (!result) {
        setGeocodeError('該当する場所が見つかりませんでした。別の表記でお試しください。')
        return null
      }

      setLandmarkName(trimmed)
      setAddressText(result.address)
      setLatitude(result.lat.toFixed(6))
      setLongitude(result.lng.toFixed(6))
      onPreviewChange({ lat: result.lat, lng: result.lng })
      return { lat: result.lat, lng: result.lng }
    } catch {
      setGeocodeError('住所の自動検索に失敗しました。入力内容を確認してください。')
      return null
    } finally {
      setIsGeocoding(false)
    }
  }

  const openSettings = () => {
    if (isLocked) return
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
      name: landmarkName.trim() || null,
      address: addressText.trim() || null,
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
        {isLocked ? '目的地確定済み' : isOpen ? '閉じる' : destination ? '目的地を変更' : '目的地を設定'}
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
            入力した場所名から住所と座標を自動で探して、確定保存できます。
          </p>

          <label>
            場所名
            <input
              type="text"
              value={landmarkName}
              onChange={(event) => setLandmarkName(event.target.value)}
              placeholder="会津若松駅"
              maxLength={60}
            />
          </label>

          <div style={{ display: 'flex', gap: 8 }}>
            <button type="button" onClick={() => void resolvePlaceAutomatically(landmarkName)} disabled={isGeocoding || !landmarkName.trim()}>
              {isGeocoding ? '検索中...' : '住所を自動検索'}
            </button>
          </div>

          <label>
            住所・詳細
            <input
              type="text"
              value={addressText}
              onChange={(event) => setAddressText(event.target.value)}
              placeholder="東京都渋谷区神南1-2-3"
              maxLength={120}
            />
          </label>

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

          <p className="destination-settings__scope-note">
            保存するとこの部屋の共有地図に反映されます。URL の room パラメータに部屋IDが保持されます。
          </p>

          {geocodeError && <p className="destination-settings__error" role="alert">{geocodeError}</p>}
          {saveError && <p className="destination-settings__error" role="alert">{saveError}</p>}

          <button className="destination-settings__save" type="submit" disabled={(!candidate && !landmarkName.trim()) || isSaving}>
            {isSaving ? '保存中...' : '目的地を共有保存'}
          </button>
        </form>
      )}
    </div>
  )
}
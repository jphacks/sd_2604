import { useEffect, useRef, useState, type FormEvent } from 'react'
import type { Destination, DestinationInput } from '../types/index'
import { geocodePlaceName } from '../utils/geocoding'
import styles from './DestinationSettings.module.css'

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
    <div className={styles['destination-settings']}>
      <button
        className={[
          styles['destination-settings__map-btn'],
          isOpen && styles['is-open']
        ].filter(Boolean).join(' ')}
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
        <form className={styles['destination-settings__panel']} onSubmit={saveDestination}>
          <div className={styles['destination-settings__heading']}>
            <div>
              <p className={styles['destination-settings__eyebrow']}>DESTINATION</p>
              <h2>目的地を再設定</h2>
            </div>
            <button className={styles['destination-settings__close']} type="button" aria-label="閉じる" onClick={closeSettings}>
              ×
            </button>
          </div>

          <label className={styles['destination-settings__field']}>
            場所名
            <div className={styles['destination-settings__search-row']}>
              <input
                type="text"
                value={landmarkName}
                onChange={(event) => setLandmarkName(event.target.value)}
                placeholder="仙台駅"
                maxLength={60}
              />
              <button
                type="button"
                className={styles['destination-settings__geocode-btn']}
                onClick={() => void resolvePlaceAutomatically(landmarkName)}
                disabled={isGeocoding || !landmarkName.trim()}
              >
                {isGeocoding ? '検索中...' : '検索'}
              </button>
            </div>
          </label>

          <label className={styles['destination-settings__field']}>
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
            className={[
              styles['destination-settings__pick'],
              isPickingOnMap && styles['is-active']
            ].filter(Boolean).join(' ')}
            type="button"
            onClick={() => onPickingChange(!isPickingOnMap)}
          >
            {isPickingOnMap ? '地図上の場所をタップしてください' : '地図上で場所を選ぶ'}
          </button>

          <div className={styles['destination-settings__coordinates']}>
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

          {geocodeError && <p className={styles['destination-settings__error']} role="alert">{geocodeError}</p>}
          {saveError && <p className={styles['destination-settings__error']} role="alert">{saveError}</p>}

          <button
            className={styles['destination-settings__save']}
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
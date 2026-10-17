import { useEffect, useRef, useState, type FormEvent } from 'react'
import './DestinationSettings.css'
import type { Destination } from './mapTypes'

interface DestinationSettingsProps {
  destination: Destination | null
  isSaving: boolean
  saveError: string | null
  isPickingOnMap: boolean
  mapPickedPoint: Destination | null
  mapPickVersion: number
  onPickingChange: (isPicking: boolean) => void
  onPreviewChange: (destination: Destination | null) => void
  onSave: (destination: Destination) => Promise<boolean>
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
  isSaving,
  saveError,
  isPickingOnMap,
  mapPickedPoint,
  mapPickVersion,
  onPickingChange,
  onPreviewChange,
  onSave,
}: DestinationSettingsProps) {
  const [isOpen, setIsOpen] = useState(false)
  const [latitude, setLatitude] = useState('')
  const [longitude, setLongitude] = useState('')
  const lastHandledPickVersion = useRef(0)

  useEffect(() => {
    if (!isOpen || mapPickVersion <= lastHandledPickVersion.current || !mapPickedPoint) return

    lastHandledPickVersion.current = mapPickVersion
    setLatitude(mapPickedPoint.lat.toFixed(6))
    setLongitude(mapPickedPoint.lng.toFixed(6))
  }, [isOpen, mapPickVersion, mapPickedPoint])

  const candidate = parseCoordinates(latitude, longitude)

  const openSettings = () => {
    setLatitude(destination?.lat.toString() ?? '')
    setLongitude(destination?.lng.toString() ?? '')
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

    const saved = await onSave(candidate)
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
        disabled={isSaving}
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
            地図をクリックするか、座標を入力してください。
          </p>

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

          {saveError && <p className="destination-settings__error" role="alert">{saveError}</p>}

          <button className="destination-settings__save" type="submit" disabled={!candidate || isSaving}>
            {isSaving ? '保存中...' : '目的地を共有保存'}
          </button>
        </form>
      )}
    </div>
  )
}
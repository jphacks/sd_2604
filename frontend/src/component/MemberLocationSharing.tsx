import { useEffect, useRef, useState } from 'react'
import type { MapApiClient } from './MapApiClient'
import type { Destination } from './mapTypes'
import { MemberLocationService } from './MemberLocationService'
import './MemberLocationSharing.css'

interface MemberLocationSharingProps {
  apiClient: MapApiClient
  destination: Destination | null
  roomId?: string | null
  userId?: string
  userName?: string
}

interface OwnLocationStatus {
  distanceMetres: number
  etaMinutes: number | null
  paceIsEstimated: boolean
  locationJammed: boolean
}

function getParticipantId(): string {
  const storageKey = 'meetpoint.participant-id'

  try {
    const savedId = localStorage.getItem(storageKey)
    if (savedId) return savedId

    const newId = crypto.randomUUID()
    localStorage.setItem(storageKey, newId)
    return newId
  } catch {
    return `participant-${Date.now()}-${Math.random().toString(36).slice(2)}`
  }
}

function getStoredParticipantName(defaultName: string): string {
  const storageKey = 'meetpoint.participant-name'

  try {
    const savedName = localStorage.getItem(storageKey)
    if (savedName && savedName.trim()) return savedName.trim()
  } catch {
    // ignore access failures and fall back below
  }

  try {
    localStorage.setItem(storageKey, defaultName)
  } catch {
    // ignore storage failures
  }

  return defaultName
}

function formatDistance(metres: number): string {
  return metres >= 1000 ? `${(metres / 1000).toFixed(1)} km` : `${Math.round(metres)} m`
}

export default function MemberLocationSharing({
  apiClient,
  destination,
  roomId,
  userId,
  userName = '自分',
}: MemberLocationSharingProps) {
  const [participantId] = useState(userId ?? getParticipantId)
  const [participantName] = useState(() => getStoredParticipantName(userName || '自分'))
  const [isSharing, setIsSharing] = useState(false)
  const [jamOutsideRadius, setJamOutsideRadius] = useState(true)
  const [locationStatus, setLocationStatus] = useState<OwnLocationStatus | null>(null)
  const [errorMessage, setErrorMessage] = useState<string | null>(null)
  const jamOutsideRadiusRef = useRef(jamOutsideRadius)
  const destinationLat = destination?.lat
  const destinationLng = destination?.lng

  const displayName = participantName.trim() || '自分'

  useEffect(() => {
    jamOutsideRadiusRef.current = jamOutsideRadius
  }, [jamOutsideRadius])

  useEffect(() => {
    if (!isSharing || destinationLat === undefined || destinationLng === undefined) return
    const target = { lat: destinationLat, lng: destinationLng }

    const locationService = new MemberLocationService()
    let disposed = false
    let lastSyncAt = 0
    let watchId: number | null = null
    let isUsingLowAccuracy = false

    const startWatching = (enableHighAccuracy: boolean) => {
      if (disposed) return
      isUsingLowAccuracy = !enableHighAccuracy
      watchId = navigator.geolocation.watchPosition(
      (position) => {
        if (disposed) return
        setErrorMessage(null)
        const sample = {
          latitude: position.coords.latitude,
          longitude: position.coords.longitude,
          accuracy: position.coords.accuracy,
          speed: position.coords.speed,
          timestamp: position.timestamp,
        }
        const update = locationService.createUpdate(
          participantId,
          displayName,
          sample,
          target,
          jamOutsideRadiusRef.current,
        )

        setLocationStatus({
          distanceMetres: update.distanceMetres,
          etaMinutes: update.payload.etaMinutes,
          paceIsEstimated: update.paceIsEstimated,
          locationJammed: update.payload.locationJammed,
        })

        const now = Date.now()
        if (now - lastSyncAt < 5000) return
        lastSyncAt = now

        void apiClient.syncLocation(roomId, update.payload)
          .then(() => {
            if (!disposed) setErrorMessage(null)
          })
          .catch(() => {
            if (!disposed) setErrorMessage('位置を送信できません。通信を確認しています。')
          })
      },
      (error) => {
        if (disposed) return
        if (error.code === error.PERMISSION_DENIED) {
          setErrorMessage('位置情報が許可されていません。ブラウザーと端末の設定で許可してください。')
          setIsSharing(false)
          return
        }

        if (!isUsingLowAccuracy) {
          setErrorMessage('GPSで現在地を取得できないため、ネットワーク測位へ切り替えています。')
          if (watchId !== null) navigator.geolocation.clearWatch(watchId)
          startWatching(false)
          return
        }

        const message = error.code === error.TIMEOUT
          ? '現在地の取得に時間がかかっています。屋外へ移動するか、端末の位置情報サービスを確認してください。'
          : '端末が現在地を特定できません。位置情報サービスとWi-Fi・モバイル通信を確認してください。'
        setErrorMessage(message)
      },
      {
        enableHighAccuracy,
        maximumAge: enableHighAccuracy ? 5000 : 15000,
        timeout: enableHighAccuracy ? 15000 : 30000,
      },
      )
    }

    startWatching(true)

    return () => {
      disposed = true
      if (watchId !== null) navigator.geolocation.clearWatch(watchId)
    }
  }, [apiClient, destinationLat, destinationLng, displayName, isSharing, participantId, roomId])

  const toggleSharing = () => {
    if (!destination) {
      setErrorMessage('先に目的地を設定してください。')
      return
    }
    if (!window.isSecureContext) {
      setErrorMessage('位置情報を使うにはHTTPS接続が必要です。localhostで試すか、HTTPSで開いてください。')
      return
    }
    if (!isSharing && !navigator.geolocation) {
      setErrorMessage('このブラウザーでは位置情報を利用できません。')
      return
    }
    setErrorMessage(null)
    setIsSharing((current) => !current)
  }

  return (
    <div className="location-sharing" aria-live="polite">
      <div className="location-sharing__summary">
        <div className="location-sharing__identity">
          <span className={`location-sharing__indicator${isSharing ? ' is-active' : ''}`} />
          <div>
            <p className="location-sharing__eyebrow">MY LOCATION</p>
            <strong>{isSharing ? '位置情報を共有中' : '位置情報は共有していません'}</strong>
          </div>
        </div>

        <label className="location-sharing__name-field">
          <span>名前</span>
          <input type="text" value={participantName} readOnly aria-label="参加者名" />
        </label>

        {isSharing && locationStatus && (
          <div className="location-sharing__estimate">
            <span>直線距離 {formatDistance(locationStatus.distanceMetres)}</span>
            <strong>
              {locationStatus.etaMinutes === null
                ? 'ペース計測中'
                : locationStatus.etaMinutes === 0
                  ? '到着圏内'
                  : `${locationStatus.paceIsEstimated ? '徒歩目安' : '到着目安'} ${locationStatus.etaMinutes}分`}
            </strong>
          </div>
        )}

        <button
          className={`location-sharing__toggle${isSharing ? ' is-sharing' : ''}`}
          type="button"
          onClick={toggleSharing}
        >
          {isSharing ? '共有を停止' : '現在地を共有'}
        </button>
      </div>

      <div className="location-sharing__privacy">
        <label className="location-sharing__jam-toggle">
          <input
            type="checkbox"
            checked={jamOutsideRadius}
            onChange={(event) => setJamOutsideRadius(event.target.checked)}
          />
          <span>目的地から500mより外では位置をぼかす</span>
        </label>
        <p className={!jamOutsideRadius ? 'is-warning' : undefined}>
          {jamOutsideRadius
            ? '500m以内は正確な位置、圏外は端末上で約700m単位に丸めた位置を送信します。到着目安と方角は別に共有します。'
            : 'OFFでは500m圏外も正確な現在地を通信し、参加者全員の地図に表示します。'}
        </p>
      </div>

      {errorMessage && <p className="location-sharing__error" role="status">{errorMessage}</p>}
    </div>
  )
}
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
    // ignore access failures
  }

  return defaultName
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

          const now = Date.now()
          if (now - lastSyncAt < 5000) return
          lastSyncAt = now

          void apiClient
            .syncLocation(roomId, update.payload)
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
            setErrorMessage('位置情報が許可されていません。ブラウザの設定で許可してください。')
            setIsSharing(false)
            return
          }

          if (!isUsingLowAccuracy) {
            if (watchId !== null) navigator.geolocation.clearWatch(watchId)
            startWatching(false)
            return
          }

          const message =
            error.code === error.TIMEOUT
              ? '現在地の取得に時間がかかっています。'
              : '端末が現在地を特定できません。'
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

  const handleToggleSharing = (nextSharing: boolean) => {
    if (nextSharing) {
      if (!destination) {
        setErrorMessage('先に目的地を設定してください。')
        return
      }
      if (!window.isSecureContext) {
        setErrorMessage('位置情報を使うにはHTTPS接続が必要です。')
        return
      }
      if (!navigator.geolocation) {
        setErrorMessage('このブラウザーでは位置情報を利用できません。')
        return
      }
    }
    setErrorMessage(null)
    setIsSharing(nextSharing)
  }

  return (
    <div className="location-sharing" aria-live="polite">
      <label className="location-sharing__switch-row">
        <input
          type="checkbox"
          className="location-sharing__switch-input"
          checked={isSharing}
          onChange={(event) => handleToggleSharing(event.target.checked)}
        />
        <span className="location-sharing__switch-slider" aria-hidden="true" />
        <span className="location-sharing__switch-label">共有中</span>
      </label>

      <label className="location-sharing__jam-row">
        <input
          type="checkbox"
          checked={jamOutsideRadius}
          onChange={(event) => setJamOutsideRadius(event.target.checked)}
        />
        <span>ジャミング</span>
      </label>

      {errorMessage && (
        <p className="location-sharing__error" role="status">
          {errorMessage}
        </p>
      )}
    </div>
  )
}
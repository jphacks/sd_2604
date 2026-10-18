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

function getDeviceId(): string {
  if (typeof window === 'undefined') return 'unknown-device'

  const existing = window.localStorage.getItem('meetpoint.device-id')
  if (existing && existing.trim()) return existing

  const fingerprint = [
    window.navigator.userAgent,
    window.navigator.language,
    window.screen.width,
    window.screen.height,
    window.screen.colorDepth,
  ].join('|')

  const next = btoa(fingerprint).replace(/[^a-zA-Z0-9]/g, '').slice(0, 32) || `device-${Date.now()}`
  window.localStorage.setItem('meetpoint.device-id', next)
  return next
}

function getParticipantId(roomId?: string | null): string {
  const storageKey = roomId ? `meetpoint.room-participant.${roomId}` : 'meetpoint.participant-id'

  try {
    const saved = localStorage.getItem(storageKey)
    if (saved) {
      try {
        const parsed = JSON.parse(saved) as { id?: string }
        if (typeof parsed.id === 'string' && parsed.id.trim()) return parsed.id
      } catch {
        // ignore malformed data
      }
    }

    const generated = roomId ? `${getDeviceId()}-${roomId}` : `${getDeviceId()}-global`
    localStorage.setItem(storageKey, JSON.stringify({ id: generated }))
    return generated
  } catch {
    return roomId ? `${getDeviceId()}-${roomId}` : `${getDeviceId()}-global`
  }
}

function getStoredParticipantName(defaultName: string, roomId?: string | null): string {
  const storageKey = roomId ? `meetpoint.room-participant.${roomId}` : 'meetpoint.participant-name'

  try {
    const saved = localStorage.getItem(storageKey)
    if (saved) {
      try {
        const parsed = JSON.parse(saved) as { name?: string }
        if (typeof parsed.name === 'string' && parsed.name.trim()) return parsed.name.trim()
      } catch {
        // ignore malformed data
      }
    }

    const globalName = localStorage.getItem('meetpoint.participant-name')
    if (globalName && globalName.trim()) return globalName.trim()
  } catch {
    // ignore storage failures
  }

  return defaultName
}

function writeRoomParticipant(roomId: string | null | undefined, participant: { id: string; name: string }) {
  if (!roomId) return

  try {
    localStorage.setItem(`meetpoint.room-participant.${roomId}`, JSON.stringify({ id: participant.id, name: participant.name }))
  } catch {
    // ignore storage failures
  }
}

export default function MemberLocationSharing({
  apiClient,
  destination,
  roomId,
  userId,
  userName = '自分',
}: MemberLocationSharingProps) {
  const [participantId] = useState(userId ?? getParticipantId(roomId))
  const [participantName, setParticipantName] = useState(() => getStoredParticipantName(userName || '自分', roomId))
  const [isSharing, setIsSharing] = useState(true)
  const [jamOutsideRadius, setJamOutsideRadius] = useState(true)
  const [errorMessage, setErrorMessage] = useState<string | null>(null)
  const jamOutsideRadiusRef = useRef(jamOutsideRadius)
  const destinationLat = destination?.lat
  const destinationLng = destination?.lng

  useEffect(() => {
    jamOutsideRadiusRef.current = jamOutsideRadius
  }, [jamOutsideRadius])

  useEffect(() => {
    const nextName = (userName || '自分').trim()
    if (nextName) {
      setParticipantName(nextName)
      try {
        localStorage.setItem('meetpoint.participant-name', nextName)
        if (roomId) {
          writeRoomParticipant(roomId, { id: participantId, name: nextName })
        }
      } catch {
        // ignore storage failures
      }
    }
  }, [participantId, roomId, userName])

  const displayName = participantName.trim() || '自分'

  useEffect(() => {
    if (!isSharing || destinationLat === undefined || destinationLng === undefined) return

    const target = { lat: destinationLat, lng: destinationLng }
    const locationService = new MemberLocationService()
    let disposed = false
    let watchId: number | null = null
    let isUsingLowAccuracy = false

    const startWatching = (enableHighAccuracy: boolean) => {
      if (disposed) return

      isUsingLowAccuracy = !enableHighAccuracy
      watchId = navigator.geolocation.watchPosition(
        (position) => {
          if (disposed) return

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

          setErrorMessage(
            error.code === error.TIMEOUT
              ? '現在地の取得に時間がかかっています。屋外へ移動するか、端末の位置情報サービスを確認してください。'
              : '端末が現在地を特定できません。位置情報サービスとWi-Fi・モバイル通信を確認してください。',
          )
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
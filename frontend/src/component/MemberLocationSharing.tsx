import { useEffect, useRef, useState } from 'react'
import type { Destination } from '../types/index'
import { getStoredParticipantName, getOrCreateParticipantId, writeRoomParticipant, saveLastParticipantName } from '../utils/storage'
import type { MapApiClient } from './MapApiClient'
import { MemberLocationService } from './MemberLocationService'
import styles from './MemberLocationSharing.module.css'

interface MemberLocationSharingProps {
  apiClient: MapApiClient
  destination: Destination | null
  roomId?: string | null
  userId?: string
  userName?: string
}

export default function MemberLocationSharing({
  apiClient,
  destination,
  roomId,
  userId,
  userName = '自分',
}: MemberLocationSharingProps) {
  const [participantId] = useState(userId ?? getOrCreateParticipantId(roomId))
  const displayName = (userName || '自分').trim() || getStoredParticipantName('自分', roomId)
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
    if (displayName) {
      saveLastParticipantName(displayName)
      if (roomId) {
        writeRoomParticipant(roomId, { id: participantId, name: displayName })
      }
    }
  }, [displayName, participantId, roomId])

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
    <div className={styles['location-sharing']} aria-live="polite">
      <label className={styles['location-sharing__switch-row']}>
        <input
          type="checkbox"
          className={styles['location-sharing__switch-input']}
          checked={isSharing}
          onChange={(event) => handleToggleSharing(event.target.checked)}
        />
        <span className={styles['location-sharing__switch-slider']} aria-hidden="true" />
        <span className={styles['location-sharing__switch-label']}>共有中</span>
      </label>

      <label className={styles['location-sharing__jam-row']}>
        <input
          type="checkbox"
          checked={jamOutsideRadius}
          onChange={(event) => setJamOutsideRadius(event.target.checked)}
        />
        <span>ジャミング</span>
      </label>

      {errorMessage && (
        <p className={styles['location-sharing__error']} role="status">
          {errorMessage}
        </p>
      )}
    </div>
  )
}
import { useCallback, useEffect, useState } from 'react'
import type { MapApiClient } from '../component/MapApiClient'
import type { Destination, DestinationInput, MapState } from '../types/index'
import { readRoomOwnerId, readRoomParticipant } from '../utils/storage'

interface UseMapRoomParams {
  apiClient: MapApiClient
  roomId?: string | null
  participantId?: string | null
  roomInfoMeetingTime?: string
}

export function useMapRoom({ apiClient, roomId, participantId, roomInfoMeetingTime }: UseMapRoomParams) {
  const [mapState, setMapState] = useState<MapState | null>(null)
  const [connectionError, setConnectionError] = useState(false)
  const [isSavingDestination, setIsSavingDestination] = useState(false)
  const [destinationSaveError, setDestinationSaveError] = useState<string | null>(null)
  const [isSavingMeetingTime, setIsSavingMeetingTime] = useState(false)
  const [meetingTimeSaveError, setMeetingTimeSaveError] = useState<string | null>(null)
  const [previewDestination, setPreviewDestination] = useState<Destination | null>(null)
  const [isPickingOnMap, setIsPickingOnMap] = useState(false)
  const [mapPickedPoint, setMapPickedPoint] = useState<Destination | null>(null)
  const [mapPickVersion, setMapPickVersion] = useState(0)
  const [viewRevision, setViewRevision] = useState(0)

  const currentParticipantId = participantId ?? readRoomParticipant(roomId)?.id ?? null
  const persistedOwnerId = readRoomOwnerId(roomId)

  const isOwner = !!roomId && !!currentParticipantId && (
    (!!mapState?.ownerId && mapState.ownerId === currentParticipantId) ||
    persistedOwnerId === currentParticipantId
  )
  const destinationLocked = Boolean(roomId) && !isOwner
  const meetingTimeLocked = Boolean(roomId) && !isOwner

  const refreshMapState = useCallback(async () => {
    try {
      const nextState = await apiClient.getMapState(roomId)
      setMapState(nextState)
      setConnectionError(false)
    } catch {
      setConnectionError(true)
    }
  }, [apiClient, roomId])

  useEffect(() => {
    let disposed = false

    const runRefresh = async () => {
      try {
        const nextState = await apiClient.getMapState(roomId)
        if (!disposed) {
          setMapState(nextState)
          setConnectionError(false)
        }
      } catch {
        if (!disposed) setConnectionError(true)
      }
    }

    void runRefresh()
    const intervalId = window.setInterval(() => void runRefresh(), 2000)

    return () => {
      disposed = true
      window.clearInterval(intervalId)
    }
  }, [apiClient, roomId])

  const destination = previewDestination ?? mapState?.destination ?? null
  const meetingTime = roomInfoMeetingTime ?? mapState?.meetingTime ?? null

  const saveDestination = async (nextDestination: DestinationInput) => {
    if (!isOwner) {
      setDestinationSaveError('オーナーだけが目的地を変更できます。')
      return false
    }

    setIsSavingDestination(true)
    setDestinationSaveError(null)

    try {
      const updatedDestination = await apiClient.updateDestination(roomId, {
        ...nextDestination,
        userId: currentParticipantId ?? null,
      })
      setMapState((current) => ({
        destination: { lat: updatedDestination.lat, lng: updatedDestination.lng },
        destinationName: updatedDestination.name ?? current?.destinationName ?? null,
        destinationAddress: updatedDestination.address ?? current?.destinationAddress ?? null,
        meetingTime: current?.meetingTime ?? null,
        ownerId: current?.ownerId ?? null,
        members: current?.members ?? [],
      }))
      setViewRevision((revision) => revision + 1)
      return true
    } catch {
      setDestinationSaveError('保存できませんでした。接続を確認して、もう一度お試しください。')
      return false
    } finally {
      setIsSavingDestination(false)
    }
  }

  const saveMeetingTime = async (nextMeetingTime: string | null) => {
    if (!isOwner) {
      setMeetingTimeSaveError('オーナーだけが集合時刻を変更できます。')
      return false
    }

    setIsSavingMeetingTime(true)
    setMeetingTimeSaveError(null)

    try {
      const updatedMeetingTime = await apiClient.updateMeetingTime(roomId, nextMeetingTime, currentParticipantId ?? null)
      setMapState((current) => ({
        destination: current?.destination ?? null,
        destinationName: current?.destinationName ?? null,
        destinationAddress: current?.destinationAddress ?? null,
        meetingTime: updatedMeetingTime,
        ownerId: current?.ownerId ?? null,
        members: current?.members ?? [],
      }))
      await refreshMapState()
      return true
    } catch {
      setMeetingTimeSaveError('集合時刻を保存できませんでした。接続を確認してください。')
      return false
    } finally {
      setIsSavingMeetingTime(false)
    }
  }

  const pickDestinationOnMap = (point: Destination) => {
    setMapPickedPoint(point)
    setMapPickVersion((version) => version + 1)
    setPreviewDestination(point)
    setIsPickingOnMap(false)
  }

  const handleAddDelay = async (minutes: number, memberId: string) => {
    if (!roomId || !memberId) return
    try {
      await apiClient.applyDelay(roomId, memberId, minutes)
      await refreshMapState()
    } catch {
      setMeetingTimeSaveError('遅延時間の更新に失敗しました。')
    }
  }

  return {
    mapState,
    connectionError,
    isSavingDestination,
    destinationSaveError,
    isSavingMeetingTime,
    meetingTimeSaveError,
    isPickingOnMap,
    mapPickedPoint,
    mapPickVersion,
    viewRevision,
    destinationLocked,
    meetingTimeLocked,
    destination,
    meetingTime,
    currentParticipantId,
    setIsPickingOnMap,
    setPreviewDestination,
    saveDestination,
    saveMeetingTime,
    pickDestinationOnMap,
    handleAddDelay
  }
}
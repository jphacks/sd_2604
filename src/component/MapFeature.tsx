import { useCallback, useEffect, useState } from 'react'
import '../App.css'
import DestinationMap from './DestinationMap'
import DestinationSettings from './DestinationSettings'
import type { MapApiClient } from './MapApiClient'
import MeetingTimeSettings from './MeetingTimeSettings'
import MemberLocationSharing from './MemberLocationSharing'
import MemberStatusPanel from './MemberStatusPanel'
import RoomLayout from './RoomLayout'
import type { Destination, DestinationInput, MapState } from './mapTypes'

interface MapFeatureProps {
  apiClient: MapApiClient
  roomInfo?: {
    title?: string
    meetingPlace?: string
    meetingTime?: string
  }
  participant?: {
    id: string
    name: string
  }
  roomId?: string | null
}

export default function MapFeature({ apiClient, participant, roomInfo, roomId }: MapFeatureProps) {
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
  const [delayError, setDelayError] = useState<string | null>(null)

  const currentParticipantId = participant?.id ?? (
    typeof window !== 'undefined' && roomId
      ? (() => {
          const raw = window.localStorage.getItem(`meetpoint.room-participant.${roomId}`)
          if (!raw) return null
          try {
            const parsed = JSON.parse(raw) as { id?: string }
            return typeof parsed.id === 'string' && parsed.id.trim() ? parsed.id : null
          } catch {
            return null
          }
        })()
      : null
  )
  const isOwner = !!roomId && !!currentParticipantId && !!mapState?.ownerId && mapState.ownerId === currentParticipantId
  const destinationLocked = Boolean(roomId) && !isOwner

  useEffect(() => {
    let disposed = false

    const refreshMapState = async () => {
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

    void refreshMapState()
    const intervalId = window.setInterval(() => void refreshMapState(), 5000)

    return () => {
      disposed = true
      window.clearInterval(intervalId)
    }
  }, [apiClient, roomId])

  const destination = previewDestination ?? mapState?.destination ?? null
  const meetingTime = roomInfo?.meetingTime ?? mapState?.meetingTime ?? null

  const updateMembers = useCallback((members: MapState['members']) => {
    setMapState((current) => current ? { ...current, members } : current)
  }, [])

  const addDelay = async (addMinutes: number, memberId: string) => {
    if (!roomId || !memberId) return

    setDelayError(null)
    try {
      const members = await apiClient.addDelay(roomId, memberId, addMinutes)
      updateMembers(members)
    } catch {
      setDelayError('時間調整を保存できませんでした。接続を確認して、もう一度お試しください。')
    }
  }

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
    setIsSavingMeetingTime(true)
    setMeetingTimeSaveError(null)

    try {
      const updatedMeetingTime = await apiClient.updateMeetingTime(roomId, nextMeetingTime)
      setMapState((current) => ({
        destination: current?.destination ?? null,
        destinationName: current?.destinationName ?? null,
        destinationAddress: current?.destinationAddress ?? null,
        meetingTime: updatedMeetingTime,
        members: current?.members ?? [],
      }))
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

  return (
    <RoomLayout
      roomId={roomId}
      meetingTime={meetingTime ?? undefined}
      connectionLabel={connectionError ? 'Disconnected' : mapState ? 'Active' : 'Connecting'}
      connectionError={connectionError}
      meetingTimeControl={
        <MeetingTimeSettings
          meetingTime={meetingTime}
          isSaving={isSavingMeetingTime}
          errorMessage={meetingTimeSaveError}
          onSave={saveMeetingTime}
        />
      }
      mapControls={
        <DestinationSettings
          destination={destination}
          destinationName={mapState?.destinationName ?? roomInfo?.meetingPlace ?? null}
          destinationAddress={mapState?.destinationAddress ?? null}
          isSaving={isSavingDestination}
          saveError={destinationSaveError}
          isPickingOnMap={isPickingOnMap}
          mapPickedPoint={mapPickedPoint}
          mapPickVersion={mapPickVersion}
          isLocked={destinationLocked}
          onPickingChange={setIsPickingOnMap}
          onPreviewChange={setPreviewDestination}
          onSave={saveDestination}
        />
      }
      map={
        <DestinationMap
          state={mapState}
          destination={destination}
          isPickingOnMap={isPickingOnMap}
          viewRevision={viewRevision}
          onPickDestination={pickDestinationOnMap}
        />
      }
      memberStatus={
        <MemberStatusPanel
          members={mapState?.members ?? []}
          destination={destination}
          meetingTime={meetingTime ?? undefined}
          errorMessage={delayError}
          onAddDelay={addDelay}
        />
      }
    >
      <MemberLocationSharing
        apiClient={apiClient}
        destination={destination}
        roomId={roomId}
        userId={participant?.id}
        userName={participant?.name}
        onMembersUpdate={updateMembers}
      />
    </RoomLayout>
  )
}
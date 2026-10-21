import '../App.css'
import { useMapRoom } from '../hooks/useMapRoom'
import DestinationMap from './DestinationMap'
import DestinationSettings from './DestinationSettings'
import type { MapApiClient } from './MapApiClient'
import MeetingTimeSettings from './MeetingTimeSettings'
import MemberLocationSharing from './MemberLocationSharing'
import MemberStatusPanel from './MemberStatusPanel'
import RoomLayout from './RoomLayout'

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
  const {
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
    setIsPickingOnMap,
    setPreviewDestination,
    saveDestination,
    saveMeetingTime,
    pickDestinationOnMap,
    handleAddDelay
  } = useMapRoom({
    apiClient,
    roomId,
    participantId: participant?.id,
    roomInfoMeetingTime: roomInfo?.meetingTime
  })

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
          isLocked={meetingTimeLocked}
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
          onAddDelay={handleAddDelay}
          errorMessage={meetingTimeSaveError}
        />
      }
    >
      <MemberLocationSharing
        apiClient={apiClient}
        destination={destination}
        roomId={roomId}
        userId={participant?.id}
        userName={participant?.name}
      />
    </RoomLayout>
  )
}
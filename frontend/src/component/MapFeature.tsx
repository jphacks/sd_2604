import { useEffect, useState } from 'react'
import '../App.css'
import DestinationMap from './DestinationMap'
import DestinationSettings from './DestinationSettings'
import type { MapApiClient } from './MapApiClient'
import MemberLocationSharing from './MemberLocationSharing'
import RoomLayout from './RoomLayout'
import type { Destination, MapState } from './mapTypes'

interface MapFeatureProps {
  apiClient: MapApiClient
  participant?: {
    id: string
    name: string
  }
}

export default function MapFeature({ apiClient, participant }: MapFeatureProps) {
  const [mapState, setMapState] = useState<MapState | null>(null)
  const [connectionError, setConnectionError] = useState(false)
  const [isSavingDestination, setIsSavingDestination] = useState(false)
  const [destinationSaveError, setDestinationSaveError] = useState<string | null>(null)
  const [previewDestination, setPreviewDestination] = useState<Destination | null>(null)
  const [isPickingOnMap, setIsPickingOnMap] = useState(false)
  const [mapPickedPoint, setMapPickedPoint] = useState<Destination | null>(null)
  const [mapPickVersion, setMapPickVersion] = useState(0)
  const [viewRevision, setViewRevision] = useState(0)

  useEffect(() => {
    let disposed = false

    const refreshMapState = async () => {
      try {
        const nextState = await apiClient.getMapState()
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
  }, [apiClient])

  const destination = previewDestination ?? mapState?.destination ?? null

  const saveDestination = async (nextDestination: Destination) => {
    setIsSavingDestination(true)
    setDestinationSaveError(null)

    try {
      const updatedDestination = await apiClient.updateDestination(nextDestination)
      setMapState((current) => ({
        destination: updatedDestination,
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

  const pickDestinationOnMap = (point: Destination) => {
    setMapPickedPoint(point)
    setMapPickVersion((version) => version + 1)
    setPreviewDestination(point)
    setIsPickingOnMap(false)
  }

  return (
    <RoomLayout
      title="待ち合わせ"
      connectionLabel={connectionError ? 'APIに接続できません' : mapState ? '5秒ごとに更新' : '接続中'}
      connectionError={connectionError}
      headerActions={
        <DestinationSettings
          destination={destination}
          isSaving={isSavingDestination}
          saveError={destinationSaveError}
          isPickingOnMap={isPickingOnMap}
          mapPickedPoint={mapPickedPoint}
          mapPickVersion={mapPickVersion}
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
    >
      <MemberLocationSharing
        apiClient={apiClient}
        destination={destination}
        userId={participant?.id}
        userName={participant?.name}
      />
    </RoomLayout>
  )
}
import 'maplibre-gl/dist/maplibre-gl.css'
import { useRef, type MouseEvent as ReactMouseEvent } from 'react'
import { setWorkerUrl } from 'maplibre-gl'
import mapLibreWorkerUrl from 'maplibre-gl/dist/maplibre-gl-worker.mjs?url'
import type { MapRef } from 'react-map-gl/maplibre'
import Map, { Layer, Marker, NavigationControl, Source } from 'react-map-gl/maplibre'
import './DestinationMap.css'
import type { Destination, MapState, MemberStatus } from './mapTypes'

setWorkerUrl(mapLibreWorkerUrl)

function getStraightLineDistanceMetres(from: Destination, to: Destination): number {
  const earthRadiusMetres = 6_371_000
  const toRadians = (degrees: number) => (degrees * Math.PI) / 180
  const latitudeDelta = toRadians(to.lat - from.lat)
  const longitudeDelta = toRadians(to.lng - from.lng)
  const fromLatitude = toRadians(from.lat)
  const toLatitude = toRadians(to.lat)
  const haversine =
    Math.sin(latitudeDelta / 2) ** 2 +
    Math.cos(fromLatitude) * Math.cos(toLatitude) * Math.sin(longitudeDelta / 2) ** 2

  return earthRadiusMetres * 2 * Math.atan2(Math.sqrt(haversine), Math.sqrt(1 - haversine))
}

function formatDistance(metres: number): string {
  return metres >= 1000 ? `${(metres / 1000).toFixed(1)} km` : `${Math.round(metres)} m`
}

function formatBearing(degrees: number | null | undefined): string | null {
  if (degrees === null || degrees === undefined) return null
  return ['北', '北東', '東', '南東', '南', '南西', '西', '北西'][Math.round(degrees / 45) % 8]
}

interface DestinationMapProps {
  state: MapState | null
  destination: Destination | null
  isPickingOnMap: boolean
  viewRevision: number
  onPickDestination: (destination: Destination) => void
}

export default function DestinationMap({
  state,
  destination,
  isPickingOnMap,
  viewRevision,
  onPickDestination,
}: DestinationMapProps) {
  const mapRef = useRef<MapRef>(null)
  const pointerRef = useRef<{
    lastX: number
    lastY: number
    moved: boolean
  } | null>(null)
  const visibleMembers = (state?.members ?? []).filter(
    (member): member is MemberStatus & { lat: number; lng: number } =>
      member.lat !== null &&
      member.lng !== null &&
      (member.locationJammed === true ||
        !destination ||
        getStraightLineDistanceMetres({ lat: member.lat, lng: member.lng }, destination) <= 500),
  )

  const radiusCoordinates = destination ? Array.from({ length: 65 }, (_, index) => {
    const angle = (index / 64) * Math.PI * 2
    const latitudeOffset = (500 / 111_320) * Math.sin(angle)
    const longitudeOffset =
      (500 / (111_320 * Math.cos((destination.lat * Math.PI) / 180))) * Math.cos(angle)

    return [destination.lng + longitudeOffset, destination.lat + latitudeOffset]
  }) : []
  const radiusArea = destination ? {
    type: 'Feature' as const,
    properties: {},
    geometry: {
      type: 'Polygon' as const,
      coordinates: [radiusCoordinates],
    },
  } : null

  const handlePickMouseDown = (event: ReactMouseEvent<HTMLButtonElement>) => {
    if (event.button !== 0) return
    pointerRef.current = {
      lastX: event.clientX,
      lastY: event.clientY,
      moved: false,
    }
  }

  const handlePickMouseMove = (event: ReactMouseEvent<HTMLButtonElement>) => {
    const pointer = pointerRef.current
    if (!pointer || event.buttons !== 1) return

    const deltaX = event.clientX - pointer.lastX
    const deltaY = event.clientY - pointer.lastY
    if (Math.hypot(deltaX, deltaY) > 2) {
      pointer.moved = true
    }
    if (pointer.moved) mapRef.current?.getMap().panBy([deltaX, deltaY], { duration: 0 })

    pointer.lastX = event.clientX
    pointer.lastY = event.clientY
  }

  const handlePickClick = (event: ReactMouseEvent<HTMLButtonElement>) => {
    const pointer = pointerRef.current
    pointerRef.current = null
    if (pointer?.moved) return

    const bounds = event.currentTarget.getBoundingClientRect()
    const point = mapRef.current?.getMap().unproject([
      event.clientX - bounds.left,
      event.clientY - bounds.top,
    ])
    if (point) onPickDestination({ lat: point.lat, lng: point.lng })
  }

  // NOTE: previously the component returned early when there was no destination and not picking.
  // That prevented the Map component from rendering at all. To ensure the map tiles and controls
  // are visible even before a destination is set, we always render the Map and show the empty
  // placeholder as an overlay when appropriate.

  return (
    <div className="destination-map">
      <Map
        ref={mapRef}
        key={`${state?.destination?.lat ?? 'none'},${state?.destination?.lng ?? 'none'}:${viewRevision}`}
        initialViewState={{
          longitude: destination?.lng ?? 140.8824,
          latitude: destination?.lat ?? 38.2606,
          zoom: 14,
        }}
        mapStyle="https://tiles.openfreemap.org/styles/liberty"
        cursor={isPickingOnMap ? 'crosshair' : undefined}
      >
      {radiusArea && (
        <Source id="privacy-radius" type="geojson" data={radiusArea}>
          <Layer
            id="privacy-radius-fill"
            type="fill"
            paint={{
              'fill-color': '#237765',
              'fill-opacity': 0.1,
            }}
          />
          <Layer
            id="privacy-radius-outline"
            type="line"
            paint={{
              'line-color': '#237765',
              'line-opacity': 0.72,
              'line-width': 2,
              'line-dasharray': [2, 2],
            }}
          />
        </Source>
      )}
      {destination && (
        <Marker longitude={destination.lng} latitude={destination.lat} anchor="bottom">
          <div className={`map-marker map-marker--destination${isPickingOnMap ? ' map-marker--transparent' : ''}`} aria-label="目的地">
            <span className="map-marker__label">目的地</span>
            <span className="map-marker__pin" />
          </div>
        </Marker>
      )}
      {visibleMembers.map((member) => (
        <Marker key={member.id} longitude={member.lng} latitude={member.lat} anchor="bottom">
          <div
            className={`map-marker map-marker--member${member.locationJammed ? ' map-marker--jammed' : ''}${isPickingOnMap ? ' map-marker--transparent' : ''}`}
            aria-label={member.locationJammed
              ? `${member.name}のおおよその位置${formatBearing(member.bearingDegrees) ? `、${formatBearing(member.bearingDegrees)}方向` : ''}${member.etaMinutes === null || member.etaMinutes === undefined ? '' : `、到着目安${member.etaMinutes}分`}`
              : `${member.name}の現在地${destination ? `、目的地まで${formatDistance(getStraightLineDistanceMetres(member, destination))}` : ''}${member.etaMinutes === null || member.etaMinutes === undefined ? '' : `、到着目安${member.etaMinutes}分`}`}
            title={member.name}
          >
            <span className="map-marker__member-label">
              <strong>{member.name}</strong>
              {member.locationJammed ? (
                <span>
                  {formatBearing(member.bearingDegrees) ?? '方角不明'}方面
                  {member.etaMinutes === null || member.etaMinutes === undefined
                    ? ' · 計測中'
                    : ` · 約${member.etaMinutes}分`}
                </span>
              ) : (
                <span>
                  {destination ? formatDistance(getStraightLineDistanceMetres(member, destination)) : '位置共有中'}
                  {member.etaMinutes === null || member.etaMinutes === undefined
                    ? ''
                    : ` · 約${member.etaMinutes}分`}
                </span>
              )}
            </span>
            <span className="map-marker__avatar" aria-hidden="true">
              {member.name.slice(0, 1)}
            </span>
          </div>
        </Marker>
      ))}
      <NavigationControl position="bottom-right" />
      </Map>

      {/* Show the empty placeholder overlay on top of the Map when there's no destination and not picking. */}
      {!destination && !isPickingOnMap && (
        <div className="map-empty" role="status">
          <span className="map-empty__mark" aria-hidden="true">+</span>
          <p className="map-empty__eyebrow">MAP NOT READY</p>
          <h2>目的地を待っています</h2>
          <p>目的地を設定すると、ここに集合場所の地図が表示されます。</p>
        </div>
      )}

      {isPickingOnMap && (
        <button
          className="destination-map__pick-layer"
          type="button"
          aria-label="地図上をクリックして目的地を選択"
          onMouseDown={handlePickMouseDown}
          onMouseMove={handlePickMouseMove}
          onClick={handlePickClick}
        >
          <span>地図をドラッグして移動、タップして目的地を選択</span>
        </button>
      )}
    </div>
  )
}

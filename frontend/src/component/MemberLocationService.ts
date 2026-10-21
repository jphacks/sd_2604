import type { Destination, LocationSyncPayload } from '../types/index'

interface PositionSample {
  latitude: number
  longitude: number
  accuracy: number
  speed: number | null
  timestamp: number
}

export interface LocationUpdate {
  payload: LocationSyncPayload
  distanceMetres: number
  paceIsEstimated: boolean
}

const EARTH_RADIUS_METRES = 6_371_000
const PRIVACY_RADIUS_METRES = 500
const PRIVACY_GRID_METRES = 700
const DEFAULT_WALKING_PACE_METRES_PER_SECOND = 1.2

function toRadians(degrees: number): number {
  return (degrees * Math.PI) / 180
}

function getDistanceMetres(from: Destination, to: Destination): number {
  const latitudeDelta = toRadians(to.lat - from.lat)
  const longitudeDelta = toRadians(to.lng - from.lng)
  const fromLatitude = toRadians(from.lat)
  const toLatitude = toRadians(to.lat)
  const haversine =
    Math.sin(latitudeDelta / 2) ** 2 +
    Math.cos(fromLatitude) * Math.cos(toLatitude) * Math.sin(longitudeDelta / 2) ** 2

  return EARTH_RADIUS_METRES * 2 * Math.atan2(Math.sqrt(haversine), Math.sqrt(1 - haversine))
}

function getBearingDegrees(from: Destination, to: Destination): number {
  const fromLatitude = toRadians(from.lat)
  const toLatitude = toRadians(to.lat)
  const longitudeDelta = toRadians(to.lng - from.lng)
  const y = Math.sin(longitudeDelta) * Math.cos(toLatitude)
  const x =
    Math.cos(fromLatitude) * Math.sin(toLatitude) -
    Math.sin(fromLatitude) * Math.cos(toLatitude) * Math.cos(longitudeDelta)

  return (Math.atan2(y, x) * 180 / Math.PI + 360) % 360
}

function getSessionGridOffset(): { x: number; y: number } {
  const storageKey = 'meetpoint.location-grid-offset'

  try {
    const saved = sessionStorage.getItem(storageKey)
    if (saved) {
      const parsed = JSON.parse(saved) as { x?: unknown; y?: unknown }
      if (typeof parsed.x === 'number' && typeof parsed.y === 'number') return { x: parsed.x, y: parsed.y }
    }

    const randomBytes = new Uint32Array(2)
    crypto.getRandomValues(randomBytes)
    const offset = {
      x: (randomBytes[0] / 0x1_0000_0000) * PRIVACY_GRID_METRES,
      y: (randomBytes[1] / 0x1_0000_0000) * PRIVACY_GRID_METRES,
    }
    sessionStorage.setItem(storageKey, JSON.stringify(offset))
    return offset
  } catch {
    return { x: PRIVACY_GRID_METRES / 2, y: PRIVACY_GRID_METRES / 2 }
  }
}

export class MemberLocationService {
  private previousSample: PositionSample | null = null
  private paceMetresPerSecond: number | null = null
  private hasMeasuredPace = false
  private readonly gridOffset = getSessionGridOffset()

  createUpdate(
    userId: string,
    userName: string,
    sample: PositionSample,
    destination: Destination,
    jamOutsidePrivacyRadius: boolean,
  ): LocationUpdate {
    const actualPosition = { lat: sample.latitude, lng: sample.longitude }
    const distanceMetres = getDistanceMetres(actualPosition, destination)
    const speed = this.updatePace(sample)
    const paceForEta = speed ?? DEFAULT_WALKING_PACE_METRES_PER_SECOND
    const paceIsEstimated = !this.hasMeasuredPace
    const etaMinutes = distanceMetres <= 20
      ? 0
      : Math.ceil(distanceMetres / paceForEta / 60)
    const locationJammed = jamOutsidePrivacyRadius && distanceMetres > PRIVACY_RADIUS_METRES
    const sharedPosition = locationJammed ? this.getJammedPosition(actualPosition) : actualPosition
    const bearingDegrees = locationJammed
      ? Math.round(getBearingDegrees(actualPosition, destination) / 45) * 45 % 360
      : null

    return {
      distanceMetres,
      paceIsEstimated,
      payload: {
        arrivalAt: etaMinutes === 0 ? new Date().toISOString() : null,
        userId,
        userName,
        userLat: sharedPosition.lat,
        userLng: sharedPosition.lng,
        targetLat: destination.lat,
        targetLng: destination.lng,
        speed,
        paceIsEstimated,
        etaMinutes,
        bearingDegrees,
        locationJammed,
      },
    }
  }

  private updatePace(sample: PositionSample): number | null {
    let measuredSpeed = sample.speed

    if (
      (measuredSpeed === null || !Number.isFinite(measuredSpeed) || measuredSpeed < 0.5 || measuredSpeed > 20) &&
      this.previousSample
    ) {
      const elapsedSeconds = (sample.timestamp - this.previousSample.timestamp) / 1000
      const movedMetres = getDistanceMetres(
        { lat: this.previousSample.latitude, lng: this.previousSample.longitude },
        { lat: sample.latitude, lng: sample.longitude },
      )
      const derivedSpeed = movedMetres / elapsedSeconds
      if (
        elapsedSeconds >= 2 &&
        elapsedSeconds <= 90 &&
        movedMetres >= Math.max(3, this.previousSample.accuracy * 0.25, sample.accuracy * 0.25) &&
        derivedSpeed >= 0.5 &&
        derivedSpeed <= 20
      ) {
        measuredSpeed = derivedSpeed
      }
    }

    if (measuredSpeed !== null && Number.isFinite(measuredSpeed) && measuredSpeed >= 0.5 && measuredSpeed <= 20) {
      this.paceMetresPerSecond = this.paceMetresPerSecond === null
        ? measuredSpeed
        : this.paceMetresPerSecond * 0.65 + measuredSpeed * 0.35
      this.hasMeasuredPace = true
    }

    if (
      !this.previousSample ||
      sample.timestamp - this.previousSample.timestamp >= 90_000 ||
      this.hasMeasuredPace
    ) this.previousSample = sample

    return this.paceMetresPerSecond
  }

  private getJammedPosition(position: Destination): Destination {
    const circumference = 2 * Math.PI * EARTH_RADIUS_METRES
    const clampedLatitude = Math.max(-85, Math.min(85, position.lat))
    const x = ((position.lng + 180) / 360) * circumference
    const latitudeRadians = toRadians(clampedLatitude)
    const y = ((1 - Math.log(Math.tan(latitudeRadians) + 1 / Math.cos(latitudeRadians)) / Math.PI) / 2) * circumference
    const cellX = Math.floor((x + this.gridOffset.x) / PRIVACY_GRID_METRES)
    const cellY = Math.floor((y + this.gridOffset.y) / PRIVACY_GRID_METRES)
    const centerX = cellX * PRIVACY_GRID_METRES + PRIVACY_GRID_METRES / 2 - this.gridOffset.x
    const centerY = cellY * PRIVACY_GRID_METRES + PRIVACY_GRID_METRES / 2 - this.gridOffset.y

    return {
      lng: centerX / circumference * 360 - 180,
      lat: (Math.atan(Math.sinh(Math.PI * (1 - 2 * centerY / circumference))) * 180) / Math.PI,
    }
  }
}
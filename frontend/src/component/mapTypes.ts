export interface Destination {
  lat: number
  lng: number
}

export interface MemberStatus {
  id: string
  name: string
  delayMinutes: number
  lat: number | null
  lng: number | null
  speed: number | null
  etaMinutes?: number | null
  bearingDegrees?: number | null
  locationJammed?: boolean
  isWithin500m: boolean
  status: 'on_the_way' | 'arrived'
  updatedAt: string
}

export interface LocationSyncPayload {
  userId: string
  userName: string
  userLat: number
  userLng: number
  targetLat: number
  targetLng: number
  speed: number | null
  etaMinutes: number | null
  bearingDegrees: number | null
  locationJammed: boolean
}

export interface MapState {
  destination: Destination | null
  members: MemberStatus[]
}
export interface Destination {
  lat: number
  lng: number
}

export interface DestinationInput extends Destination {
  name?: string | null
  address?: string | null
}

export interface MemberStatus {
  id: string
  name: string
  delayMinutes: number
  lat: number | null
  lng: number | null
  speed: number | null
  etaMinutes?: number | null
  paceIsEstimated?: boolean
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
  paceIsEstimated: boolean
  bearingDegrees: number | null
  locationJammed: boolean
}

export interface MapState {
  destination: Destination | null
  destinationName?: string | null
  destinationAddress?: string | null
  meetingTime: string | null
  members: MemberStatus[]
}
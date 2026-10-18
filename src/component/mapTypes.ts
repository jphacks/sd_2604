export interface Destination {
  lat: number
  lng: number
}

export interface DestinationInput extends Destination {
  name?: string | null
  address?: string | null
  userId?: string | null
}

export interface MemberStatus {
  /** 到着予定時刻 (ISO 8601 例: '2026-10-17T14:25:00.000Z')。端末が絶対時刻で送る */
  arrivalAt?: string | null
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
  arrivalAt: string | null
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
  ownerId?: string | null
  members: MemberStatus[]
}

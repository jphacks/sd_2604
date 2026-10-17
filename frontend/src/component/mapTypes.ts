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
  isWithin500m: boolean
  status: 'on_the_way' | 'arrived'
  updatedAt: string
}

export interface MapState {
  destination: Destination | null
  members: MemberStatus[]
}
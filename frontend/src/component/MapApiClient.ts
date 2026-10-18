import type { Destination, DestinationInput, LocationSyncPayload, MapState } from './mapTypes'

export interface CreateRoomRequest {
  title: string
  targetName: string
  targetLat: number
  targetLng: number
  meetingTime: string
  destinationName?: string | null
  destinationAddress?: string | null
  ownerId?: string
  ownerName?: string
}

export interface JoinRoomRequest {
  userId: string
  userName: string
}

export interface CreateRoomResponse {
  success: boolean
  roomId?: string
  room?: {
    id: string
    title: string
    targetName: string
    targetLat: number
    targetLng: number
    meetingTime: string
    members: Record<string, unknown>
  }
  error?: string
}

export class MapApiClient {
  private readonly baseUrl: string
  private readonly request: typeof fetch

  constructor(baseUrl: string, request: typeof fetch = fetch) {
    this.baseUrl = baseUrl
    this.request = request.bind(globalThis)
  }

  async createRoom(payload: CreateRoomRequest): Promise<CreateRoomResponse> {
    const response = await this.request(`${this.baseUrl}/api/rooms`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload),
    })

    if (!response.ok) {
      throw new Error(`Room creation failed: ${response.status}`)
    }

    return (await response.json()) as CreateRoomResponse
  }

  async joinRoom(roomId: string, payload: JoinRoomRequest): Promise<{ success: boolean; userId?: string; userName?: string; room?: { id: string; ownerId?: string | null } }> {
    const response = await this.request(`${this.baseUrl}/api/rooms/${encodeURIComponent(roomId)}/join`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload),
    })

    if (!response.ok) {
      throw new Error(`Join room failed: ${response.status}`)
    }

    return (await response.json()) as { success: boolean; userId?: string; userName?: string; room?: { id: string; ownerId?: string | null } }
  }

  async getMapState(roomId?: string | null): Promise<MapState> {
    const endpoint = roomId ? `${this.baseUrl}/api/rooms/${encodeURIComponent(roomId)}/map-state` : `${this.baseUrl}/api/map-state`
    const response = await this.request(endpoint)
    if (!response.ok) throw new Error(`Map state request failed: ${response.status}`)

    const value = (await response.json()) as Partial<MapState> & { targetName?: string | null; destinationName?: string | null }
    if (!Array.isArray(value.members)) throw new Error('Invalid map state response')

    return {
      destination: this.validateDestination(value.destination),
      destinationName: typeof value.destinationName === 'string' && value.destinationName.trim()
        ? value.destinationName.trim()
        : typeof value.targetName === 'string' && value.targetName.trim()
          ? value.targetName.trim()
          : null,
      destinationAddress: typeof value.destinationAddress === 'string' && value.destinationAddress.trim()
        ? value.destinationAddress.trim()
        : null,
      meetingTime: typeof value.meetingTime === 'string' && Number.isFinite(Date.parse(value.meetingTime))
        ? value.meetingTime
        : null,
      ownerId: typeof value.ownerId === 'string' && value.ownerId.trim() ? value.ownerId.trim() : null,
      members: value.members,
    }
  }

  async updateDestination(roomId: string | null | undefined, destination: DestinationInput): Promise<DestinationInput> {
    const endpoint = roomId
      ? `${this.baseUrl}/api/rooms/${encodeURIComponent(roomId)}/destination`
      : `${this.baseUrl}/api/destination`
    const response = await this.request(endpoint, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(destination),
    })
    if (!response.ok) throw new Error(`Destination update failed: ${response.status}`)

    const value = (await response.json()) as { destination?: unknown; destinationName?: unknown; destinationAddress?: unknown }
    const updatedDestination = this.validateDestination(value.destination)
    if (!updatedDestination) throw new Error('Invalid destination response')

    return {
      ...updatedDestination,
      name: typeof value.destinationName === 'string' ? value.destinationName : null,
      address: typeof value.destinationAddress === 'string' ? value.destinationAddress : null,
    }
  }

  async updateMeetingTime(roomId: string | null | undefined, meetingTime: string | null, userId?: string | null): Promise<string | null> {
    const endpoint = roomId
      ? `${this.baseUrl}/api/rooms/${encodeURIComponent(roomId)}/meeting-time`
      : `${this.baseUrl}/api/meeting-time`
    const response = await this.request(endpoint, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ meetingTime, userId: userId ?? null }),
    })
    if (!response.ok) throw new Error(`Meeting time update failed: ${response.status}`)

    const value = (await response.json()) as { meetingTime?: unknown }
    if (value.meetingTime === null) return null
    if (typeof value.meetingTime !== 'string' || !Number.isFinite(Date.parse(value.meetingTime))) {
      throw new Error('Invalid meeting time response')
    }
    return value.meetingTime
  }

  async syncLocation(roomId: string | null | undefined, payload: LocationSyncPayload): Promise<void> {
    const endpoint = roomId
      ? `${this.baseUrl}/api/rooms/${encodeURIComponent(roomId)}/sync`
      : `${this.baseUrl}/api/location/sync`
    const response = await this.request(endpoint, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload),
    })
    if (!response.ok) throw new Error(`Location sync failed: ${response.status}`)
  }

  private validateDestination(value: unknown): Destination | null {
    if (value === null || value === undefined) return null
    if (typeof value !== 'object') throw new Error('Invalid destination coordinates')

    const coordinates = value as Partial<Destination>
    if (
      typeof coordinates.lat !== 'number' ||
      typeof coordinates.lng !== 'number' ||
      !Number.isFinite(coordinates.lat) ||
      !Number.isFinite(coordinates.lng) ||
      coordinates.lat < -90 ||
      coordinates.lat > 90 ||
      coordinates.lng < -180 ||
      coordinates.lng > 180
    ) {
      throw new Error('Invalid destination coordinates')
    }

    return { lat: coordinates.lat, lng: coordinates.lng }
  }
}

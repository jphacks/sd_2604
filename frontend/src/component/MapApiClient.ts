import type { Destination, LocationSyncPayload, MapState } from './mapTypes'

export class MapApiClient {
  private readonly baseUrl: string
  private readonly request: typeof fetch

  constructor(baseUrl: string, request: typeof fetch = fetch) {
    this.baseUrl = baseUrl
    this.request = request.bind(globalThis)
  }

  async getMapState(): Promise<MapState> {
    const response = await this.request(`${this.baseUrl}/api/map-state`)
    if (!response.ok) throw new Error(`Map state request failed: ${response.status}`)

    const value = (await response.json()) as Partial<MapState>
    if (!Array.isArray(value.members)) throw new Error('Invalid map state response')

    return {
      destination: this.validateDestination(value.destination),
      meetingTime: typeof value.meetingTime === 'string' && Number.isFinite(Date.parse(value.meetingTime))
        ? value.meetingTime
        : null,
      members: value.members,
    }
  }

  async updateDestination(destination: Destination): Promise<Destination> {
    const response = await this.request(`${this.baseUrl}/api/destination`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(destination),
    })
    if (!response.ok) throw new Error(`Destination update failed: ${response.status}`)

    const value = (await response.json()) as { destination?: unknown }
    const updatedDestination = this.validateDestination(value.destination)
    if (!updatedDestination) throw new Error('Invalid destination response')

    return updatedDestination
  }

  async updateMeetingTime(meetingTime: string | null): Promise<string | null> {
    const response = await this.request(`${this.baseUrl}/api/meeting-time`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ meetingTime }),
    })
    if (!response.ok) throw new Error(`Meeting time update failed: ${response.status}`)

    const value = (await response.json()) as { meetingTime?: unknown }
    if (value.meetingTime === null) return null
    if (typeof value.meetingTime !== 'string' || !Number.isFinite(Date.parse(value.meetingTime))) {
      throw new Error('Invalid meeting time response')
    }
    return value.meetingTime
  }

  async syncLocation(payload: LocationSyncPayload): Promise<void> {
    const response = await this.request(`${this.baseUrl}/api/location/sync`, {
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
export interface RoomMember {
  id: string;
  name: string;
  delayMinutes: number;
  lat: number | null;
  lng: number | null;
  speed: number | null;
  etaMinutes?: number | null;
  paceIsEstimated?: boolean;
  bearingDegrees?: number | null;
  locationJammed?: boolean;
  isWithin500m: boolean;
  status: 'on_the_way' | 'arrived';
  updatedAt: string;
}

export interface RoomState {
  id: string;
  title: string;
  targetName: string;
  targetLat: number;
  targetLng: number;
  meetingTime: string | null;
  members: Record<string, RoomMember>;
}

export class RoomStateDurableObject extends DurableObject {
  async fetch(request: Request): Promise<Response> {
    const roomId = request.headers.get('x-room-id') ?? 'default';

    if (request.method === 'GET') {
      const room = await this.ctx.storage.get<RoomState>('room');
      return Response.json({ success: true, roomId, room });
    }

    if (request.method === 'PUT') {
      const payload = await request.json<{ room?: RoomState }>();
      if (payload.room) {
        await this.ctx.storage.put('room', payload.room);
      }
      return Response.json({ success: true, roomId, room: payload.room ?? null });
    }

    return Response.json({ success: false, message: 'Unsupported method' }, { status: 405 });
  }
}

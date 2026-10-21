import { Hono } from 'hono';
import { cors } from 'hono/cors';

interface CloudflareBindings {
  meetpoint_rooms?: KVNamespace;
}

const app = new Hono<{ Bindings: CloudflareBindings }>();
app.use('*', cors());

app.get('/', (c) => c.text('Backend API is running!'));

interface MemberStatus {
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

interface Room {
  id: string;
  ownerId: string | null;
  title: string;
  targetName: string;
  destinationName: string | null;
  destinationAddress: string | null;
  targetLat: number;
  targetLng: number;
  meetingTime: string | null;
  members: Record<string, MemberStatus>;
}

const roomsStore: Record<string, Room> = {};
const membersStore: Record<string, MemberStatus> = {};
let destination: { lat: number; lng: number } | null = null;
let meetingTime: string | null = null;

async function getRoomById(roomId: string, env?: CloudflareBindings): Promise<Room | undefined> {
  if (env?.meetpoint_rooms) {
    const stored = await env.meetpoint_rooms.get(`room:${roomId}`);
    if (stored) {
      return JSON.parse(stored) as Room;
    }
    return undefined;
  }

  return roomsStore[roomId];
}

async function saveRoom(room: Room, env?: CloudflareBindings): Promise<void> {
  roomsStore[room.id] = room;

  if (env?.meetpoint_rooms) {
    await env.meetpoint_rooms.put(`room:${room.id}`, JSON.stringify(room));
  }
}

function getDistanceMetres(lat1: number, lon1: number, lat2: number, lon2: number): number {
  const R = 6371e3;
  const φ1 = (lat1 * Math.PI) / 180;
  const φ2 = (lat2 * Math.PI) / 180;
  const Δφ = ((lat2 - lat1) * Math.PI) / 180;
  const Δλ = ((lon2 - lon1) * Math.PI) / 180;

  const a = Math.sin(Δφ / 2) * Math.sin(Δφ / 2) +
    Math.cos(φ1) * Math.cos(φ2) *
    Math.sin(Δλ / 2) * Math.sin(Δλ / 2);
  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
  return R * c;
}

app.post('/api/rooms', async (c) => {
  try {
    const body = await c.req.json<{
      title: string;
      targetName: string;
      targetLat: number;
      targetLng: number;
      meetingTime: string;
      destinationName?: string | null;
      destinationAddress?: string | null;
      ownerId?: string | null;
      ownerName?: string | null;
    }>();

    let roomId = '';
    do {
      roomId = crypto.randomUUID().split('-')[0];
    } while (await getRoomById(roomId, c.env));

    const ownerId = (body.ownerId && body.ownerId.trim()) || `owner_${crypto.randomUUID()}`;

    const ownerName = body.ownerName?.trim() || 'オーナー';
    const ownerMember: MemberStatus = {
      id: ownerId,
      name: ownerName,
      delayMinutes: 0,
      lat: null,
      lng: null,
      speed: null,
      etaMinutes: null,
      paceIsEstimated: false,
      bearingDegrees: null,
      locationJammed: false,
      isWithin500m: false,
      status: 'on_the_way',
      updatedAt: new Date().toISOString(),
    };

    const newRoom: Room = {
      id: roomId,
      ownerId,
      title: body.title || '待ち合わせ',
      targetName: body.targetName || '目的地',
      destinationName: body.destinationName?.trim() || body.targetName?.trim() || '目的地',
      destinationAddress: body.destinationAddress?.trim() || null,
      targetLat: body.targetLat,
      targetLng: body.targetLng,
      meetingTime: body.meetingTime,
      members: { [ownerId]: ownerMember },
    };

    roomsStore[roomId] = newRoom;
    await saveRoom(newRoom, c.env);
    return c.json({ success: true, roomId, room: newRoom });
  } catch {
    return c.json({ success: false, error: 'Invalid payload' }, 400);
  }
});

app.get('/api/rooms/:roomId', async (c) => {
  const roomId = c.req.param('roomId');
  const room = await getRoomById(roomId, c.env);

  if (!room) {
    return c.json({ success: false, message: 'Room not found' }, 404);
  }

  return c.json({
    ...room,
    ownerId: room.ownerId ?? null,
    targetName: room.targetName,
    members: Object.values(room.members),
  });
});

app.post('/api/rooms/:roomId/join', async (c) => {
  const roomId = c.req.param('roomId');
  const body = await c.req.json<{ userId?: string; userName?: string }>();

  const room = await getRoomById(roomId, c.env);
  if (!room) return c.json({ success: false, message: 'Room not found' }, 404);

  const userId = body.userId || 'user_' + Math.random().toString(36).substring(2, 9);
  const userName = body.userName || '参加者';
  const existingMember = room.members[userId];

  const newMember: MemberStatus = {
    id: userId,
    name: userName,
    delayMinutes: existingMember?.delayMinutes ?? 0,
    lat: existingMember?.lat ?? null,
    lng: existingMember?.lng ?? null,
    speed: existingMember?.speed ?? null,
    etaMinutes: existingMember?.etaMinutes ?? null,
    paceIsEstimated: existingMember?.paceIsEstimated ?? false,
    bearingDegrees: existingMember?.bearingDegrees ?? null,
    locationJammed: existingMember?.locationJammed ?? false,
    isWithin500m: existingMember?.isWithin500m ?? false,
    status: existingMember?.status ?? 'on_the_way',
    updatedAt: new Date().toISOString(),
  };

  room.members[userId] = newMember;
  await saveRoom(room, c.env);

  return c.json({
    success: true,
    userId,
    userName,
    room: {
      ...room,
      members: Object.values(room.members),
    },
  });
});

app.post('/api/rooms/:roomId/sync', async (c) => {
  const roomId = c.req.param('roomId');
  const body = await c.req.json<{
    userId: string;
    userName?: string;
    userLat: number;
    userLng: number;
    speed: number | null;
    etaMinutes?: number | null;
    paceIsEstimated?: boolean;
    bearingDegrees?: number | null;
    locationJammed?: boolean;
    targetLat?: number;
    targetLng?: number;
  }>();

  const room = await getRoomById(roomId, c.env);
  if (!room) return c.json({ success: false, message: 'Room not found' }, 404);

  const targetLat = body.targetLat ?? room.targetLat;
  const targetLng = body.targetLng ?? room.targetLng;
  const distance = getDistanceMetres(body.userLat, body.userLng, targetLat, targetLng);
  const isWithin500m = distance <= 500;
  const current = room.members[body.userId] ?? {
    id: body.userId,
    name: body.userName || '参加者',
    delayMinutes: 0,
    lat: null,
    lng: null,
    speed: null,
    etaMinutes: null,
    paceIsEstimated: false,
    bearingDegrees: null,
    locationJammed: false,
    isWithin500m: false,
    status: 'on_the_way',
    updatedAt: new Date().toISOString(),
  } as MemberStatus;

  room.members[body.userId] = {
    ...current,
    id: body.userId,
    name: body.userName || current.name || '参加者',
    lat: body.userLat,
    lng: body.userLng,
    speed: body.speed,
    etaMinutes: body.etaMinutes ?? current.etaMinutes ?? null,
    paceIsEstimated: body.paceIsEstimated ?? current.paceIsEstimated ?? false,
    bearingDegrees: body.bearingDegrees ?? current.bearingDegrees ?? null,
    locationJammed: body.locationJammed ?? current.locationJammed ?? false,
    isWithin500m,
    status: distance <= 10 ? 'arrived' : 'on_the_way',
    updatedAt: new Date().toISOString(),
  };
  await saveRoom(room, c.env);

  return c.json({
    success: true,
    distanceMetres: Math.round(distance),
    isWithin500m,
    members: Object.values(room.members),
    room: {
      ...room,
      members: Object.values(room.members),
    },
  });
});

app.post('/api/rooms/:roomId/delay', async (c) => {
  const roomId = c.req.param('roomId');
  const { userId, addMinutes } = await c.req.json<{ userId: string; addMinutes: number }>();

  const room = await getRoomById(roomId, c.env);
  if (!room) return c.json({ success: false, message: 'Room not found' }, 404);

  if (room.members[userId]) {
    room.members[userId].delayMinutes += addMinutes;
    await saveRoom(room, c.env);
  }

  return c.json({
    success: true,
    members: Object.values(room.members),
  });
});

app.put('/api/rooms/:roomId/destination', async (c) => {
  const roomId = c.req.param('roomId');
  const room = await getRoomById(roomId, c.env);
  if (!room) return c.json({ success: false, message: 'Room not found' }, 404);

  const body = await c.req.json<{ lat: unknown; lng: unknown; name?: unknown; address?: unknown; userId?: string | null }>();

  if (room.ownerId && body.userId !== room.ownerId) {
    return c.json({ success: false, error: 'Only room owner can update destination' }, 403);
  }

  if (
    typeof body.lat !== 'number' ||
    typeof body.lng !== 'number' ||
    !Number.isFinite(body.lat) ||
    !Number.isFinite(body.lng) ||
    body.lat < -90 ||
    body.lat > 90 ||
    body.lng < -180 ||
    body.lng > 180
  ) {
    return c.json({ success: false, error: 'Invalid destination coordinates' }, 400);
  }

  room.targetLat = body.lat;
  room.targetLng = body.lng;
  room.destinationName = typeof body.name === 'string' && body.name.trim() ? body.name.trim() : room.targetName || '目的地';
  room.destinationAddress = typeof body.address === 'string' ? body.address.trim() || null : room.destinationAddress ?? null;
  await saveRoom(room, c.env);

  return c.json({
    success: true,
    destination: { lat: room.targetLat, lng: room.targetLng },
    destinationName: room.destinationName,
    destinationAddress: room.destinationAddress,
    room: { ...room, members: Object.values(room.members) },
  });
});

app.put('/api/rooms/:roomId/meeting-time', async (c) => {
  const roomId = c.req.param('roomId');
  const room = await getRoomById(roomId, c.env);
  if (!room) return c.json({ success: false, message: 'Room not found' }, 404);

  const body = await c.req.json<{ meetingTime: unknown; userId?: string | null }>();

  if (room.ownerId && body.userId !== room.ownerId) {
    return c.json({ success: false, error: 'Only room owner can update meeting time' }, 403);
  }

  if (body.meetingTime === null) {
    room.meetingTime = null;
    await saveRoom(room, c.env);
    return c.json({ success: true, meetingTime: null, room: { ...room, members: Object.values(room.members) } });
  }

  if (typeof body.meetingTime !== 'string' || !Number.isFinite(Date.parse(body.meetingTime))) {
    return c.json({ success: false, error: 'Invalid meeting time' }, 400);
  }

  room.meetingTime = new Date(body.meetingTime).toISOString();
  await saveRoom(room, c.env);
  return c.json({ success: true, meetingTime: room.meetingTime, room: { ...room, members: Object.values(room.members) } });
});

app.get('/api/rooms/:roomId/map-state', async (c) => {
  const roomId = c.req.param('roomId');
  const room = await getRoomById(roomId, c.env);

  if (!room) return c.json({ success: false, message: 'Room not found' }, 404);

  return c.json({
    destination: { lat: room.targetLat, lng: room.targetLng },
    ownerId: room.ownerId ?? null,
    targetName: room.targetName,
    destinationName: room.destinationName ?? room.targetName ?? '目的地',
    destinationAddress: room.destinationAddress ?? null,
    meetingTime: room.meetingTime,
    members: Object.values(room.members),
  });
});

export default app;

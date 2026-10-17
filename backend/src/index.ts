import { Hono } from 'hono';
import { cors } from 'hono/cors';

const app = new Hono();
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
  title: string;
  targetName: string;
  targetLat: number;
  targetLng: number;
  meetingTime: string | null;
  members: Record<string, MemberStatus>;
}

const roomsStore: Record<string, Room> = {};
const membersStore: Record<string, MemberStatus> = {};
let destination: { lat: number; lng: number } | null = null;
let meetingTime: string | null = null;

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
    }>();

    let roomId = '';
    do {
      roomId = crypto.randomUUID().split('-')[0];
    } while (roomsStore[roomId]);

    const newRoom: Room = {
      id: roomId,
      title: body.title || '待ち合わせ',
      targetName: body.targetName || '目的地',
      targetLat: body.targetLat,
      targetLng: body.targetLng,
      meetingTime: body.meetingTime,
      members: {},
    };

    roomsStore[roomId] = newRoom;
    return c.json({ success: true, roomId, room: newRoom });
  } catch {
    return c.json({ success: false, error: 'Invalid payload' }, 400);
  }
});

app.get('/api/rooms/:roomId', (c) => {
  const roomId = c.req.param('roomId');
  const room = roomsStore[roomId];

  if (!room) {
    return c.json({ success: false, message: 'Room not found' }, 404);
  }

  return c.json({
    ...room,
    members: Object.values(room.members),
  });
});

app.post('/api/rooms/:roomId/join', async (c) => {
  const roomId = c.req.param('roomId');
  const body = await c.req.json<{ userId?: string; userName?: string }>();

  const room = roomsStore[roomId];
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

  const room = roomsStore[roomId];
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
    lat: isWithin500m ? body.userLat : null,
    lng: isWithin500m ? body.userLng : null,
    speed: body.speed,
    etaMinutes: body.etaMinutes ?? current.etaMinutes ?? null,
    paceIsEstimated: body.paceIsEstimated ?? current.paceIsEstimated ?? false,
    bearingDegrees: body.bearingDegrees ?? current.bearingDegrees ?? null,
    locationJammed: body.locationJammed ?? current.locationJammed ?? false,
    isWithin500m,
    status: distance <= 10 ? 'arrived' : 'on_the_way',
    updatedAt: new Date().toISOString(),
  };

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

  const room = roomsStore[roomId];
  if (!room) return c.json({ success: false, message: 'Room not found' }, 404);

  if (room.members[userId]) {
    room.members[userId].delayMinutes += addMinutes;
  }

  return c.json({
    success: true,
    members: Object.values(room.members),
  });
});

app.post('/api/location/sync', async (c) => {
  const body = await c.req.json<{
    userId: string;
    userName: string;
    userLat: number;
    userLng: number;
    speed: number | null;
    targetLat?: number;
    targetLng?: number;
    etaMinutes?: number | null;
    paceIsEstimated?: boolean;
    bearingDegrees?: number | null;
    locationJammed?: boolean;
  }>();

  const targetLat = body.targetLat ?? destination?.lat ?? 38.2606;
  const targetLng = body.targetLng ?? destination?.lng ?? 140.8824;
  const distance = getDistanceMetres(body.userLat, body.userLng, targetLat, targetLng);
  const isWithin500m = distance <= 500;
  const nextMember: MemberStatus = {
    id: body.userId,
    name: body.userName,
    delayMinutes: 0,
    lat: isWithin500m ? body.userLat : null,
    lng: isWithin500m ? body.userLng : null,
    speed: body.speed,
    etaMinutes: body.etaMinutes ?? null,
    paceIsEstimated: body.paceIsEstimated ?? false,
    bearingDegrees: body.bearingDegrees ?? null,
    locationJammed: body.locationJammed ?? false,
    isWithin500m,
    status: distance <= 10 ? 'arrived' : 'on_the_way',
    updatedAt: new Date().toISOString(),
  };

  membersStore[body.userId] = nextMember;

  return c.json({
    success: true,
    distanceMetres: Math.round(distance),
    isWithin500m,
    members: Object.values(membersStore),
  });
});

app.put('/api/rooms/:roomId/destination', async (c) => {
  const roomId = c.req.param('roomId');
  const room = roomsStore[roomId];
  if (!room) return c.json({ success: false, message: 'Room not found' }, 404);

  const body = await c.req.json<{ lat: unknown; lng: unknown }>();

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

  return c.json({
    success: true,
    destination: { lat: room.targetLat, lng: room.targetLng },
    room: { ...room, members: Object.values(room.members) },
  });
});

app.put('/api/rooms/:roomId/meeting-time', async (c) => {
  const roomId = c.req.param('roomId');
  const room = roomsStore[roomId];
  if (!room) return c.json({ success: false, message: 'Room not found' }, 404);

  const body = await c.req.json<{ meetingTime: unknown }>();

  if (body.meetingTime === null) {
    room.meetingTime = null;
    return c.json({ success: true, meetingTime: null, room: { ...room, members: Object.values(room.members) } });
  }

  if (typeof body.meetingTime !== 'string' || !Number.isFinite(Date.parse(body.meetingTime))) {
    return c.json({ success: false, error: 'Invalid meeting time' }, 400);
  }

  room.meetingTime = new Date(body.meetingTime).toISOString();
  return c.json({ success: true, meetingTime: room.meetingTime, room: { ...room, members: Object.values(room.members) } });
});

app.get('/api/rooms/:roomId/map-state', (c) => {
  const roomId = c.req.param('roomId');
  const room = roomsStore[roomId];

  if (!room) return c.json({ success: false, message: 'Room not found' }, 404);

  return c.json({
    destination: { lat: room.targetLat, lng: room.targetLng },
    meetingTime: room.meetingTime,
    members: Object.values(room.members),
  });
});

app.put('/api/destination', async (c) => {
  const body = await c.req.json<{ lat: unknown; lng: unknown }>();

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

  destination = { lat: body.lat, lng: body.lng };
  return c.json({ success: true, destination });
});

app.put('/api/meeting-time', async (c) => {
  const body = await c.req.json<{ meetingTime: unknown }>();

  if (body.meetingTime === null) {
    meetingTime = null;
    return c.json({ success: true, meetingTime });
  }

  if (typeof body.meetingTime !== 'string' || !Number.isFinite(Date.parse(body.meetingTime))) {
    return c.json({ success: false, error: 'Invalid meeting time' }, 400);
  }

  meetingTime = new Date(body.meetingTime).toISOString();
  return c.json({ success: true, meetingTime });
});

app.get('/api/map-state', (c) => {
  return c.json({
    destination,
    meetingTime,
    members: Object.values(membersStore),
  });
});

export default app;

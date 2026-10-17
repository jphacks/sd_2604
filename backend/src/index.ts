import { Hono } from 'hono';
import { cors } from 'hono/cors';

const app = new Hono();
app.use('*', cors());

app.get('/', (c) => c.text('Backend API is running!'));

// メンバーの状態
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

// ルーム構造
interface Room {
  id: string;
  title: string;        // 例: "JPHACKS打ち上げ"
  targetName: string;   // 例: "仙台駅 ペデストリアンデッキ"
  targetLat: number;    // 38.2601
  targetLng: number;    // 140.8824
  meetingTime: string;  // "2026-10-17T19:00:00"
  members: Record<string, MemberStatus>;
}

// ★ メモリ内ストア（欠けていた変数を追加）
const roomsStore: Record<string, Room> = {};
const membersStore: Record<string, MemberStatus> = {};
let destination: { lat: number; lng: number } | null = null;
let meetingTime: string | null = null;

// 距離計算 (Haversine)
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

// 1. 位置情報の同期 & 500m判定API
app.post('/api/location/sync', async (c) => {
  const body = await c.req.json<{
    userId: string;
    userName: string;
    userLat: number;
    userLng: number;
    speed: number | null;
    targetLat: number;
    targetLng: number;
    etaMinutes?: number | null;
    paceIsEstimated?: boolean;
    bearingDegrees?: number | null;
    locationJammed?: boolean;
  }>();
// --------------------------------------------------
// 1. 新規ルーム作成 API
// --------------------------------------------------
app.post('/api/rooms', async (c) => {
  try {
    const body = await c.req.json<{
      title: string;
      targetName: string;
      targetLat: number;
      targetLng: number;
      meetingTime: string;
    }>();

    // ★ 重複チェック付きのID生成（被ったら自動で作り直す）
    let roomId = '';
    do {
      roomId = crypto.randomUUID().split('-')[0]; // 8桁英数字
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
  } catch (err) {
    return c.json({ success: false, error: 'Invalid payload' }, 400);
  }
});

// --------------------------------------------------
// 2. ルーム情報取得 API
// --------------------------------------------------
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

// --------------------------------------------------
// 3. 参加（名前登録） API
// --------------------------------------------------
app.post('/api/rooms/:roomId/join', async (c) => {
  const roomId = c.req.param('roomId');
  const { userName } = await c.req.json<{ userName: string }>();

  const room = roomsStore[roomId];
  if (!room) return c.json({ success: false, message: 'Room not found' }, 404);

  const userId = 'user_' + Math.random().toString(36).substring(2, 9);

  const newMember: MemberStatus = {
    id: userId,
    name: userName,
    delayMinutes: 0,
    lat: null,
    lng: null,
    speed: null,
    isWithin500m: false,
    status: 'on_the_way',
  };

  // 端末が秘匿設定に応じて正確値または概算値を選択して送信する
  membersStore[body.userId] = {
    ...current,
    name: body.userName,
    lat: body.userLat,
    lng: body.userLng,
    speed,
    etaMinutes,
    paceIsEstimated: body.paceIsEstimated === true,
    bearingDegrees,
    locationJammed,
    isWithin500m,
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

// --------------------------------------------------
// 4. 位置情報同期 & 500m判定 API
// --------------------------------------------------
app.post('/api/rooms/:roomId/sync', async (c) => {
  const roomId = c.req.param('roomId');
  const body = await c.req.json<{
    userId: string;
    userLat: number;
    userLng: number;
    speed: number | null;
  }>();

  const room = roomsStore[roomId];
  if (!room) return c.json({ success: false, message: 'Room not found' }, 404);

  const distance = getDistanceMetres(body.userLat, body.userLng, room.targetLat, room.targetLng);
  const isWithin500m = distance <= 500;

  if (room.members[body.userId]) {
    room.members[body.userId] = {
      ...room.members[body.userId],
      lat: isWithin500m ? body.userLat : null,
      lng: isWithin500m ? body.userLng : null,
      speed: body.speed,
      isWithin500m,
      updatedAt: new Date().toISOString(),
    };
  }

  return c.json({
    success: true,
    distanceMetres: Math.round(distance),
    isWithin500m,
    members: Object.values(room.members),
  });
});

// --------------------------------------------------
// 5. ワンタップ遅延更新 API
// --------------------------------------------------
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

// --------------------------------------------------
// 旧互換用 / 汎用 API
// --------------------------------------------------
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

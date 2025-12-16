import { encode, decode } from '@msgpack/msgpack';
import WebSocket, { RawData } from 'ws';

const WS_URL = process.env.WS_URL ?? 'ws://localhost:3001/ws';

type Packet = { event: string; data?: unknown };

const socket = new WebSocket(WS_URL, { perMessageDeflate: false });
socket.binaryType = 'arraybuffer';

socket.on('open', () => {
  console.log(`Connected to ${WS_URL}`);
  sendPacket('ping', { text: 'hello from client' });
  sendPacket('broadcast', { text: 'broadcast from client' });

  setTimeout(() => socket.close(1000, 'client finished'), 1500);
});

socket.on('message', (data) => {
  console.log('<<', formatIncoming(data));
});

socket.on('close', (code, reason) => {
  const reasonText = reason.toString() || 'no reason given';
  console.log(`Socket closed (${code}): ${reasonText}`);
});

socket.on('error', (err) => {
  console.error('Socket error', err);
});

function sendPacket(event: string, data?: unknown) {
  if (socket.readyState !== WebSocket.OPEN) {
    console.log('Socket not open yet; try again once connected.');
    return;
  }

  const packet: Packet = { event, data };
  socket.send(encode(packet));
  console.log('>>', packet);
}

function formatIncoming(raw: RawData) {
  const asBuffer =
    typeof raw === 'string'
      ? Buffer.from(raw)
      : Array.isArray(raw)
        ? Buffer.concat(raw)
        : raw instanceof ArrayBuffer
          ? Buffer.from(raw)
          : raw;

  try {
    return decode(asBuffer);
  } catch {
    try {
      const text =
        typeof raw === 'string'
          ? raw
          : Buffer.isBuffer(asBuffer)
            ? asBuffer.toString('utf8')
            : raw instanceof ArrayBuffer
              ? Buffer.from(raw).toString('utf8')
              : '';
      return JSON.parse(text);
    } catch {
      return raw;
    }
  }
}

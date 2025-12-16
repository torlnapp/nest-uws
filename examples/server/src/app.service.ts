import { Injectable } from '@nestjs/common';

@Injectable()
export class AppService {
  getHello() {
    return {
      message: 'Nest + uWebSockets.js adapter is running',
      http: 'GET / returns this JSON',
      ws: 'Connect to ws://localhost:3000/ws and send a MsgPack packet { event: "ping", data: { text: "hi" } }',
    };
  }
}

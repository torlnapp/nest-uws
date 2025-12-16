import * as UWS from 'uWebSockets.js';
import { Observable } from 'rxjs';
import { DISCONNECT, HANDLERS, TRANSFORM } from './nest-uws.adapter';

export type UwsServer = UWS.TemplatedApp;
export type UwsClient = UWS.WebSocket<unknown>;
export type UwsAppOptions = UWS.AppOptions;

export type NestWsMessageHandler = {
  message: string;
  callback: (data: unknown) => unknown;
};

export type WebSocketPacket = {
  event: string;
  data: unknown;
};

export interface UwsClientWithMetadata extends UwsClient {
  [HANDLERS]: NestWsMessageHandler[];
  [TRANSFORM]: (data: unknown) => Observable<unknown>;
  [DISCONNECT]: (client: UwsClient) => void;
}

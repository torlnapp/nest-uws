import * as UWS from 'uWebSockets.js';
import { Logger, WebSocketAdapter } from '@nestjs/common';
import { decodeMsgPack, encodeMsgPack, toBinary } from '@torlnapp/crypto-utils';
import { from, isObservable, Observable } from 'rxjs';
import {
  NestWsMessageHandler,
  UwsAppOptions,
  UwsClient,
  UwsClientWithMetadata,
  UwsServer,
  WebSocketPacket,
} from './types';

export const HANDLERS = Symbol('NEST_WS_HANDLERS');
export const TRANSFORM = Symbol('NEST_WS_TRANSFORM');
export const DISCONNECT = Symbol('NEST_WS_DISCONNECT');

export interface NestUwsAdapterOptions {
  path?: string;
  maxPayloadLength?: number;
  idleTimeout?: number;
  compression?: number;
}

export class NestUwsAdapter implements WebSocketAdapter<UwsServer, UwsClient> {
  private listenSocket?: UWS.us_listen_socket;
  private readonly wsOptions: NestUwsAdapterOptions;
  private readonly appOptions: UwsAppOptions;
  private readonly logger = new Logger(NestUwsAdapter.name);

  constructor(
    wsOptions: NestUwsAdapterOptions = {},
    appOptions: UwsAppOptions = {},
  ) {
    this.wsOptions = wsOptions;
    this.appOptions = appOptions;
  }

  create(port: number): UwsServer {
    const base = this.appOptions;

    const app =
      base.key_file_name && base.cert_file_name
        ? UWS.SSLApp(base)
        : UWS.App(base);

    app.listen(port, (listenSocket) => {
      if (listenSocket === false) {
        this.logger.error(`Failed to listen on port ${port}`);
        return;
      }
      this.listenSocket = listenSocket;
      this.logger.log(`uWS listening on port ${port}`);
    });

    return app;
  }

  bindClientConnect(server: UwsServer, callback: (client: UwsClient) => void) {
    const opts = this.wsOptions;
    const path = opts.path ?? '/*';

    server.ws(path, {
      compression: opts.compression ?? UWS.DISABLED,
      maxPayloadLength: opts.maxPayloadLength ?? 16 * 1024 * 1024,
      idleTimeout: opts.idleTimeout ?? 60,

      open: (ws: UwsClient) => {
        callback(ws);
      },

      message: (ws: UwsClientWithMetadata, arrayBuffer: ArrayBuffer) => {
        const handlers = ws[HANDLERS];
        const transform = ws[TRANSFORM];

        if (!handlers || !transform) {
          return;
        }

        let packet: WebSocketPacket;
        try {
          packet = decodeMsgPack(toBinary(arrayBuffer)) as WebSocketPacket;
        } catch {
          return;
        }
        const { event, data } = packet;

        const handler = handlers.find((h) => h.message === event);
        if (!handler) return;

        const result = handler.callback(data);

        let result$: Observable<unknown>;

        if (isObservable(result)) {
          result$ = result;
        } else if (result instanceof Promise) {
          result$ = from(result);
        } else {
          result$ = transform(result);
        }

        if (!result$) return;

        result$.subscribe({
          next: (response) => {
            if (response === undefined) return;

            ws.send(
              encodeMsgPack({
                event,
                data: response,
              }),
              true,
            );
          },
          error: (err: unknown) => {
            const errorMessage =
              err instanceof Error ? err.message : 'Internal error';
            ws.send(
              encodeMsgPack({
                event: 'error',
                data: errorMessage,
              }),
              true,
            );
          },
        });
      },
      close: (ws: UwsClient) => {
        const disconnect = ws[DISCONNECT];
        if (disconnect) {
          disconnect(ws);
        }
      },
    });

    return server;
  }

  bindClientDisconnect(
    client: UwsClient,
    callback: (client: UwsClient) => void,
  ) {
    const wsWithMetadata = client as UwsClientWithMetadata;
    wsWithMetadata[DISCONNECT] = callback;
  }

  bindMessageHandlers(
    client: UwsClient,
    handlers: NestWsMessageHandler[],
    transform: (data: unknown) => Observable<unknown>,
  ) {
    const wsWithMetadata = client as UwsClientWithMetadata;
    wsWithMetadata[HANDLERS] = handlers;
    wsWithMetadata[TRANSFORM] = transform;
  }

  close() {
    if (this.listenSocket) {
      UWS.us_listen_socket_close(this.listenSocket);
      this.listenSocket = undefined;
    }
  }
}

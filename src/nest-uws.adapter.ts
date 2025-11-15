/* eslint-disable @typescript-eslint/no-unused-vars */
import { Logger, WebSocketAdapter, WsMessageHandler } from '@nestjs/common';
import { Observable, from, isObservable } from 'rxjs';
import * as UWS from 'uWebSockets.js';

type UwsServer = UWS.TemplatedApp;
type UwsClient = UWS.WebSocket<any>;
type UwsAppOptions = UWS.AppOptions;

type NestWsMessageHandler = {
  message: string;
  callback: (data: unknown) => unknown;
};

interface UwsClientWithMetadata extends UwsClient {
  [HANDLERS]?: NestWsMessageHandler[];
  [TRANSFORM]?: (data: any) => Observable<any>;
  [DISCONNECT]?: (client: UwsClient) => void;
}

const HANDLERS = Symbol('nestWsHandlers');
const TRANSFORM = Symbol('nestWsTransform');
const DISCONNECT = Symbol('nestWsDisconnect');

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
      console.log('listenSocket', listenSocket);
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
        this.logger.log('uWS open() called');
        callback(ws);
      },

      message: (ws: UwsClient, arrayBuffer: ArrayBuffer, isBinary: boolean) => {
        this.logger.log('uWS message() called');

        const wsWithMetadata = ws as UwsClientWithMetadata;
        const handlers = wsWithMetadata[HANDLERS];
        const transform = wsWithMetadata[TRANSFORM];

        if (!handlers || !transform) {
          return;
        }

        const raw = Buffer.from(arrayBuffer).toString('utf8');

        let packet: { event: string; data: unknown };
        try {
          packet = JSON.parse(raw) as { event: string; data: unknown };
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
              JSON.stringify({
                event,
                data: response,
              }),
              false,
            );
          },
          error: (err: unknown) => {
            const errorMessage =
              err instanceof Error ? err.message : 'Internal error';
            ws.send(
              JSON.stringify({
                event: 'error',
                data: errorMessage,
              }),
              false,
            );
          },
        });
      },
      close: (ws: UwsClient, code: number, message: ArrayBuffer) => {
        this.logger.log(`uWS close() called, code: ${code}`);
        const wsWithMetadata = ws as UwsClientWithMetadata;
        const disconnect = wsWithMetadata[DISCONNECT];
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
    transform: (data: any) => Observable<any>,
  ) {
    const wsWithMetadata = client as UwsClientWithMetadata;
    wsWithMetadata[HANDLERS] = handlers;
    wsWithMetadata[TRANSFORM] = transform;
  }
  close(server: UwsServer) {
    if (this.listenSocket) {
      UWS.us_listen_socket_close(this.listenSocket);
      this.listenSocket = undefined;
      this.logger.log('uWS listen socket closed');
    }
  }
}

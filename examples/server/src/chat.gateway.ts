import { Logger } from '@nestjs/common';
import {
  ConnectedSocket,
  MessageBody,
  OnGatewayConnection,
  OnGatewayDisconnect,
  SubscribeMessage,
  WebSocketGateway,
  WebSocketServer,
} from '@nestjs/websockets';
import { UwsClient, UwsServer } from '@torlnapp/nest-uws-adapter';

@WebSocketGateway(3001, { path: '/ws' })
export class ChatGateway
  implements OnGatewayConnection<UwsClient>, OnGatewayDisconnect<UwsClient>
{
  @WebSocketServer()
  server!: UwsServer;

  private readonly logger = new Logger(ChatGateway.name);

  handleConnection(client: UwsClient) {
    client.subscribe('broadcast');
    this.logger.debug('Client connected');
  }

  handleDisconnect() {
    this.logger.debug('Client disconnected');
  }

  @SubscribeMessage('ping')
  handlePing(@MessageBody() body: { text?: string }) {
    this.logger.debug('Ping received');
    const text = body?.text ?? 'pong';
    return { text, at: new Date().toISOString() };
  }

  @SubscribeMessage('broadcast')
  handleBroadcast(
    @ConnectedSocket() client: UwsClient,
    @MessageBody() body: { text?: string },
  ) {
    if (!body?.text) return;
    this.logger.debug('Broadcasting message');

    client.publish(
      'broadcast',
      JSON.stringify({
        event: 'broadcast',
        data: { text: body.text, at: new Date().toISOString() },
      }),
    );

    return { text: body.text, delivered: true };
  }
}

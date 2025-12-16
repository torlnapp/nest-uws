import {
  ConnectedSocket,
  MessageBody,
  SubscribeMessage,
  WebSocketGateway,
  WebSocketServer,
  OnGatewayConnection,
  OnGatewayDisconnect,
} from '@nestjs/websockets';
import { Logger } from '@nestjs/common';
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
    this.logger.log('Client connected');
  }

  handleDisconnect() {
    this.logger.log('Client disconnected');
  }

  @SubscribeMessage('ping')
  handlePing(@MessageBody() body: { text?: string }) {
    const text = body?.text ?? 'pong';
    return { text, at: new Date().toISOString() };
  }

  @SubscribeMessage('broadcast')
  handleBroadcast(
    @ConnectedSocket() client: UwsClient,
    @MessageBody() body: { text?: string },
  ) {
    if (!body?.text) return;

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

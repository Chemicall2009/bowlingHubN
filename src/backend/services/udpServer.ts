import dgram from 'dgram';
import { wsHub } from '../wsHub';

export class UdpServer {
  private server: dgram.Socket;
  private port: number;

  constructor(port: number) {
    this.port = port;
    this.server = dgram.createSocket('udp4');
    
    this.server.on('error', (err) => {
      console.error(`[UDP] Server error:\n${err.stack}`);
      this.server.close();
    });

    this.server.on('message', (msg, rinfo) => {
      this.handleMessage(msg.toString());
    });

    this.server.on('listening', () => {
      const address = this.server.address();
      console.log(`[UDP] Server listening ${address.address}:${address.port}`);
    });
  }

  public start() {
    this.server.bind(this.port);
  }

  private handleMessage(message: string) {
    console.log(`[UDP] Received: ${message}`);
    const [prefix, command] = message.split('|');
    if (!prefix || !command) return;
    
    const laneId = parseInt(prefix.replace('L:', ''));
    if (isNaN(laneId)) return;

    if (command === 'BALL_TRIP') {
      wsHub.broadcast({
        type: 'wait_for_shot',
        lane_id: laneId,
        ts: Date.now(),
      });
      // Logic for Watchdog-timer of 7.0 seconds should be handled in a separate service or here.
    } else if (command.startsWith('SPEED:')) {
      const value = command.split(':')[1];
      if (value === 'ERR') {
        wsHub.broadcast({
          type: 'anomaly',
          lane_id: laneId,
          ts: Date.now(),
          subtype: 'speed_error',
        });
      } else {
        wsHub.broadcast({
          type: 'ball_speed',
          lane_id: laneId,
          ts: Date.now(),
          ball_speed_kmh: parseFloat(value),
        });
      }
    } else if (command === 'FOUL_TRIP') {
      wsHub.broadcast({
        type: 'foul_detected',
        lane_id: laneId,
        ts: Date.now(),
        foul: true,
      });
    } else if (command === 'SHOT_NOW') {
      wsHub.broadcast({
        type: 'cv_trigger',
        lane_id: laneId,
        ts: Date.now(),
      });
    }
  }
}

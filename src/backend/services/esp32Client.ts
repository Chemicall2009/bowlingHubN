
export interface Esp32Command {
  action: 'LANE_START' | 'LANE_STOP' | 'RELEASE_STANDARD' | 'RELEASE_SHORT';
}

export class Esp32Client {
  private baseUrl: string;

  constructor(ipAddress: string) {
    this.baseUrl = `http://${ipAddress}/api/control`;
  }

  public async sendCommand(command: Esp32Command): Promise<void> {
    try {
      const response = await fetch(this.baseUrl, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(command),
      });

      if (!response.ok) {
        throw new Error(`HTTP error! status: ${response.status}`);
      }
      console.log(`[ESP32] Command ${command.action} sent successfully.`);
    } catch (error) {
      console.error(`[ESP32] Error sending command ${command.action}:`, error);
    }
  }
}

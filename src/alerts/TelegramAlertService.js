const TELEGRAM_API_BASE = 'https://api.telegram.org';

export class TelegramAlertService {
  constructor({ botToken = process.env.TELEGRAM_BOT_TOKEN, chatId = process.env.TELEGRAM_CHAT_ID } = {}) {
    this.botToken = botToken;
    this.chatId = chatId;
  }

  isConfigured() {
    return Boolean(this.botToken && this.chatId);
  }

  formatAlert({ symbol, setup, direction, timeframe, confidence, reason }) {
    return [
      '🚨 *Nueva alerta de trading*',
      `Símbolo: *${symbol}*`,
      `Setup: *${setup}*`,
      `Dirección: *${direction}*`,
      `Timeframe: *${timeframe}*`,
      `Confianza: *${confidence}*`,
      `Razón: ${reason}`,
    ].join('\n');
  }

  async sendAlert(alertPayload) {
    if (!this.isConfigured()) {
      return { sent: false, reason: 'telegram_no_configurado' };
    }

    const text = this.formatAlert(alertPayload);
    const response = await fetch(`${TELEGRAM_API_BASE}/bot${this.botToken}/sendMessage`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        chat_id: this.chatId,
        text,
        parse_mode: 'Markdown',
        disable_web_page_preview: true,
      }),
    });

    if (!response.ok) {
      const body = await response.text();
      throw new Error(`Telegram error: ${response.status} ${body}`);
    }

    const data = await response.json();
    return { sent: true, data };
  }
}

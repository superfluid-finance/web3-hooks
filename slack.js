const axios = require('axios');

class SlackWebhook {
  constructor(webhookUrl) {
    this.webhookUrl = webhookUrl;
  }

  async sendMessage(text) {
    try {
      const message = { text };
      await axios.post(this.webhookUrl, message);
      console.log('Message sent to Slack');
    } catch (error) {
      console.error('Error sending message to Slack:', error.message);
    }
  }
}

module.exports = SlackWebhook;

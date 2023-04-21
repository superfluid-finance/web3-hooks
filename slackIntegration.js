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

class SlackMessageBuilder {
  constructor() {
    this.blocks = [];
  }

  static createBlockSection(text) {
    return {
      type: "section",
      text: {
        type: "mrkdwn",
        text,
      },
    };
  }

  static createBlockFields(fields) {
    const formattedFields = fields.map((field) => ({
      type: "mrkdwn",
      text: field,
    }));

    return {
      type: "section",
      fields: formattedFields,
    };
  }

  formatTokenEvent(data, eventType) {
    const eventTitle = eventType === 'upgrade' ? 'Upgrade Token Event' : 'Downgrade Token Event';

    return {
      text: eventTitle,
      blocks: [
        SlackMessageBuilder.createBlockSection(`*Block Number:* \`${data.blockNumber}\`\n*Date:* ${data.date}`),
        SlackMessageBuilder.createBlockFields([
          `*Transaction Hash:*<${data.transactionHash}|${data.transactionHash.split('/').pop()}>`,
          `*Event Name:* ${data.eventName}`,
          `*Token Address:*<${data.tokenAddress}|${data.tokenAddress.split('/').pop()}>`,
          `*Token Name:* ${data.tokenName}`,
          `*Token Symbol:* ${data.tokenSymbol}`,
          `*Amount:* ${data.amount}`,
          `*Formatted Amount:* ${data.formattedAmount}`,
        ]),
      ],
    };
  }
}

module.exports = {
  SlackWebhook,
  SlackMessageBuilder
};

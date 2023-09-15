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

  formatTokenEvent(data, eventType) {
    const eventTitle = eventType === 'upgrade' ? 'Upgrade Token Event' : 'Downgrade Token Event';
    return `*Block Number: * \`${data.blockNumber}\` - *Event Name:* ${data.eventName} - *Date:* ${data.date}\n
*Transaction Hash: *<${data.transactionHash}|${data.transactionHash.split('/').pop()}>\n*Token Address: *<${data.tokenAddress}|${data.tokenAddress.split('/').pop()}>\n*Token Name:* ${data.tokenName}\n*Amount: * ${data.formattedAmount} (wei: ${data.amount})`;
  }

  // v2 event formatters

  // generic helpers

  getHeader(data) {
    return `*${data.networkName}* - Block \`${data.blockNumber}\` - Event *${data.eventName}* at ${data.date}\n`;
  }

  getTxString(txHash, explorerUrlBase) {
    return `<${explorerUrlBase}/tx/${txHash}|${txHash}>`;
  }

  getAddressString(address, explorerUrlBase) {
    return `<${explorerUrlBase}/address/${address}|${address}>`;
  }

  // event specific - naming convention: format<event name>

  formatAppRegistered(data, explorerUrlBase) {
    return `${this.getHeader(data)}
    App address: <${this.getAddressString(data.app, explorerUrlBase)}>\n
    Tx: ${this.getTxString(data.transactionHash, explorerUrlBase)}`;
  }

  formatJail(data, explorerUrlBase) {
    return `${this.getHeader(data)}
    App address: <${this.getAddressString(data.app, explorerUrlBase)}>\n
    Reason: ${data.reason}\n
    Tx: ${this.getTxString(data.transactionHash, explorerUrlBase)}`;
  }
}

module.exports = SlackWebhook;
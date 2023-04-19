require('dotenv').config();

const express = require('express');
const bodyParser = require('body-parser');
const ngrok = require('ngrok');
const SlackWebhook = require('./slack');

const app = express();

const SLACK_WEBHOOK_URL = process.env.SLACK_WEBHOOK_URL;
const slackWebhook = new SlackWebhook(SLACK_WEBHOOK_URL);

app.use(bodyParser.json());
app.get('/', (req, res) => {
    res.send('GM!');
});
app.post('/', async (req, res) => {
  try {

    const parsedData = req.body;
    const text = `Incoming webhook data:\n${JSON.stringify(parsedData, null, 2)}`;

    await slackWebhook.sendMessage(text);

    res.status(200).send('Webhook data sent to Slack');
  } catch (error) {
    console.error('Error processing webhook:', error.message);
    res.status(500).send('Error processing webhook');
  }
});

const PORT = process.env.PORT || 3000;
const NGROK_AUTH_TOKEN = process.env.NGROK_AUTH_TOKEN;

(async () => {
  app.listen(PORT, () => {
    console.log(`Server listening on port ${PORT}`);
  });

  const ngrokUrl = await ngrok.connect({port: PORT, authtoken: NGROK_AUTH_TOKEN});
  console.log(`ngrok tunnel created: ${ngrokUrl}`);
})();

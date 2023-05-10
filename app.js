require('dotenv').config();

const express = require('express');
const bodyParser = require('body-parser');
const ngrok = require('ngrok');
const GraphQLClient = require('./graphqlClient');
const EventFetcher = require('./eventFetcher');
const SlackWebhook = require('./slackWebhook');
const metrics = require('./metrics');


const app = express();

const SLACK_WEBHOOK_URL = process.env.SLACK_WEBHOOK_URL;
const slackWebhook = new SlackWebhook(SLACK_WEBHOOK_URL);

const GRAPHQL_API_URL = 'https://api.thegraph.com/subgraphs/name/superfluid-finance/protocol-v1-matic';
const graphqlClient = new GraphQLClient(GRAPHQL_API_URL);
const eventFetcher = new EventFetcher(graphqlClient);

const minAmount = process.env.MIN_AMOUNT || '100000000000000000000';


app.use(bodyParser.json());
app.get('/', async (req, res) => {
    res.status(200).send('GM');
});

app.post('/tokenupgrade', async (req, res) => {
    processWebhook(req, res, eventFetcher.tokenUpgradedEvents.bind(eventFetcher), 'upgrade');
});

app.post('/tokendowngrade', async (req, res) => {
    processWebhook(req, res, eventFetcher.tokenDowngradedEvents.bind(eventFetcher), 'downgrade');
});

app.get('/metrics', async (req, res) => {
    res.set('Content-Type', metrics.register.contentType);
    res.end(await metrics.getMetrics());
});

async function processWebhook(req, res, eventFunction, eventType) {
    try {
        const parsedData = req.body;
        const tokenAddress = parsedData?.event?.data?.block?.logs?.[0]?.transaction?.to?.address;
        const blockNumber = parsedData?.event?.data?.block?.number;
        if(tokenAddress) {
            const data = (await eventFunction(tokenAddress, minAmount, blockNumber)).map(
                (element) => { return slackWebhook.formatTokenEvent(element, eventType);
            });

            for(const msg of data) {
                await slackWebhook.sendMessage(msg);
                console.log(msg);
            }
        }
        metrics.handleSuccessfulWebhook(eventType);
        res.status(200).send();
    } catch (error) {
        console.error('Error processing webhook:', error);
        metrics.handleFailedWebhook();
        res.status(500).send('Error processing webhook');
    }
}

const PORT = process.env.PORT || 3000;
const NGROK_AUTH_TOKEN = process.env.NGROK_AUTH_TOKEN;

(async () => {
    app.listen(PORT, () => {
        console.log(`Server listening on port ${PORT}`);
    });
    if (process.env.NODE_ENV === 'local_development') {
        const ngrokUrl = await ngrok.connect({port: PORT, authtoken: NGROK_AUTH_TOKEN});
        console.log(`ngrok tunnel created: ${ngrokUrl}`);
    }
})();
require('dotenv').config();

const express = require('express');
const bodyParser = require('body-parser');
const ngrok = require('ngrok');
const GraphQLClient = require('./graphqlClient');
const EventFetcher = require('./eventFetcher');
const SlackWebhook = require('./slackWebhook');
const metrics = require('./metrics');
const sfMetadata = require('@superfluid-finance/metadata');

// When getting an event, delay before query subgraph to allow indexing
const queueDelay = (process.env.QUEUE_DELAY !== undefined ? parseInt(process.env.QUEUE_DELAY) : 60) * 1000; // 1 minute

const app = express();

const SLACK_WEBHOOK_URL = process.env.SLACK_WEBHOOK_URL;
const slackWebhook = new SlackWebhook(SLACK_WEBHOOK_URL);

// DEPRECATED: v2 is network agnostic
const networkNameV1 = process.env.NETWORK || "polygon-mainnet";
const networkV1 = sfMetadata.getNetworkByName(networkNameV1);
if (networkV1 === undefined) {
    throw("unknown network: ", networkNameV1);
}
const GRAPHQL_API_URL = process.env.GRAPHQL_API_URL || `https://${networkNameV1}.subgraph.x.superfluid.dev`;
console.log(`using graphql endpoint ${GRAPHQL_API_URL}}`);
const graphqlClient = new GraphQLClient(GRAPHQL_API_URL);
const eventFetcher = new EventFetcher(graphqlClient, networkV1.explorer);

const minAmount = process.env.MIN_AMOUNT || '100000000000000000000';


app.use(bodyParser.json());
app.get('/', async (req, res) => {
    res.status(200).send('GM');
});

// Event specific handlers

app.post('/tokenupgrade', async (req, res) => {
    processWebhook(req, res, eventFetcher.tokenUpgradedEvents.bind(eventFetcher), 'upgrade');
});

app.post('/tokendowngrade', async (req, res) => {
    processWebhook(req, res, eventFetcher.tokenDowngradedEvents.bind(eventFetcher), 'downgrade');
});
/*
app.post('/v2/appregistered', async (req, res) => {
    processWebhookV2(req.body, res);
});
*/

app.post('/v2/:eventType', async (req, res) => {
    const eventType = req.params.eventType;
    console.log(`Received webhook v2 ${eventType}`);
    processWebhookV2(req.body, res);
});

// Metrics handler

app.get('/metrics', async (req, res) => {
    res.set('Content-Type', metrics.register.contentType);
    res.end(await metrics.getMetrics());
});

let queueV2 = [];

async function processWebhookV2(data, res) {
    try {
        const event = data.event;
        const networkName = data.networkName;
        const chainId = data.chainId;
        console.log(`Received webhook v2 ${event.event} for ${networkName} (${chainId}), block ${event.blockNumber}`);
        //console.log(`event: ${JSON.stringify(event, null, 2)}`);
        data.receiveTimestamp = Date.now(); // add a timestamp to allow queue delaying
        queueV2.push(data);
        metrics.handleSuccessfulWebhook(event.event);
        res.status(200).send();
    } catch (error) {
        console.error('Error processing webhook v2:', error);
        metrics.handleFailedWebhook();
        res.status(500).send('Error processing webhook v2');
    }
}

// Process the events in the queueV2
(async function processQueueV2() {
    while (queueV2.length > 0) {
        const data = queueV2[0];
        if (data.receiveTimestamp + queueDelay > Date.now()) {
            //console.log(`event not old enough, requeueing`);
            break;
        }
        try {
            const getDatafnName = `getDataFor${data.event.event}`;
            if (typeof eventFetcher[getDatafnName] !== 'function') {
                console.error(`### no handler for event ${data.event.event}, skipping`);
            } else {
                // get data for notification
                const fn = eventFetcher[getDatafnName].bind(eventFetcher);
                console.log("invoking function", fn);
                const notifData = (await fn(data.networkName, data.event));
                console.log("data for notification: ", JSON.stringify(notifData, null, 2));

                // get formatted message string
                const network = sfMetadata.getNetworkByName(data.networkName);
                // put defunct placeholder links if we don't know an explorer for the network
                const explorerUrl = network?.explorer || "https://unknown-explorer-please-update-metadata";
                const formatFnName = `format${data.event.event}`;
                if (typeof slackWebhook[formatFnName] !== 'function') {
                    console.error(`### no msg formatter for event ${data.event.event}, skipping notification`);
                } else {
                    const msg = slackWebhook[`format${data.event.event}`](notifData, explorerUrl);

                    // send the notification
                    await slackWebhook.sendMessage(msg);
                }
            }
            queueV2.shift(); // successfully processed or no handler, remove from queue
        } catch (error) {
            console.error('Error processing event:', error);
        }
    }

    setTimeout(processQueueV2, 1000); // check queue every second
})();

let queue = [];

async function processWebhook(req, res, eventFunction, eventType) {
    try {
        console.log(`Received webhook ${eventType} for block ${req.body?.event?.data?.block?.number}`);
        const parsedData = req.body;
        const tokenAddress = parsedData?.event?.data?.block?.logs?.[0]?.transaction?.to?.address;
        const blockNumber = parsedData?.event?.data?.block?.number;
        if(tokenAddress) {
            console.log(`Processing event ${eventType} for token address ${tokenAddress} at block ${blockNumber}`)
            queue.push({
                tokenAddress: tokenAddress,
                eventType: eventType,
                blockNumber: blockNumber,
                eventFunction: eventFunction
            });
        }
        metrics.handleSuccessfulWebhook(eventType);
        res.status(200).send();
    } catch (error) {
        console.error('Error processing webhook:', error);
        metrics.handleFailedWebhook();
        res.status(500).send('Error processing webhook');
    }
}

// Process the events in the queue
setTimeout(async function processQueue() {
    if (queue.length > 0) {
        const job = queue.shift();
        try {
            const data = (await job.eventFunction(job.tokenAddress, minAmount, job.blockNumber)).map(
                (element) => { return slackWebhook.formatTokenEvent(element, job.eventType);
                });

            for(const msg of data) {
                await slackWebhook.sendMessage(msg);
                console.log(msg);
            }
        } catch (error) {
            console.error('Error processing job:', error);
        }
    }

    setTimeout(processQueue, queueDelay);
}, queueDelay);

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
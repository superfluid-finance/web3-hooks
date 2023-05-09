const client = require('prom-client');
const collectDefaultMetrics = client.collectDefaultMetrics;

const register = new client.Registry();
collectDefaultMetrics({ register });

const successfulWebhooksCounter = new client.Counter({
    name: 'successful_webhooks',
    help: 'Number of successful webhook calls',
    labelNames: ['eventType'],
    registers: [register],
});

const failedWebhooksCounter = new client.Counter({
    name: 'failed_webhooks',
    help: 'Number of failed webhook calls',
    registers: [register],
});

function handleSuccessfulWebhook(eventType) {
    successfulWebhooksCounter.inc({ eventType });
}

function handleFailedWebhook() {
    failedWebhooksCounter.inc();
}

async function getMetrics() {
    return await register.metrics();
}

module.exports = {
    handleSuccessfulWebhook,
    handleFailedWebhook,
    getMetrics,
    register,
};

# Web3 Hooks

Web3 Hooks is a Node.js server that listens for incoming webhooks, parses the request data, and forwards the result to various clients such as Slack.

The system is composed of 3 components:
1. trigger: listens for new events we're interested in and invokes a hook on new events.
2. hook processor: web server listening for new hook invocations, fetches data we specifically want for that event
3. notifier: takes the data fetched by the hook processor, formats it in a human readable way and creates a notification out of it, e.g. on Slack

Triggers:
* [Alchemy Custom Webhook](https://docs.alchemy.com/reference/custom-webhook)
* bundled script `rpcFetcher.js`, see source for usage instructions

## How to add an event

* Add an Alchemy item or a cronjob invoking rpcFetcher (see inline docs). One trigger per event type and network is needed.
* eventFetcher.js: add a method `getDataFor<event name>(networkName, event)` which returns an object with all the data wanted in the notification
* slackWebhook.js: add a method `format<event name>(data, explorerUrlBase)` which returns the string to be sent to Slack

## Features

- Listen for incoming webhook requests
- Parse POST request body data
- Send formatted messages to Slack using a webhook URL
- Easily extensible to support more clients in the future

## Installation

1. Clone the repository:
```git clone https://github.com/ngmachado/web3-hooks.git```
2. Navigate to the project directory:
```cd web3-hooks```
3. Install dependencies:
```yarn install``` or ```npm install```
4. Create a `.env` file in the project directory and add your configurations:
```cat env.example > .env```
5. Start the server:
```yarn start``` or ```npm start```

If you want to use ngrok to create a public URL for your local server, you can add `NODE_ENV=local_development` to your `.env`

The server will listen for incoming webhook requests on the specified port (default: 3000). If you are using ngrok, you can use the generated URL to send webhook requests to your local server.

## Endpoints

The server exposes the following endpoints:

GET `/`: This is a simple health check endpoint that returns a 200 OK status with the message "GM". Use this endpoint to verify that the server is running and accessible.

POST `/tokenupgrade`: This endpoint listens for incoming webhooks related to token upgrade events. When a webhook request is received, the server parses the request data, fetches the relevant token upgrade events, formats the data, and sends a message to the configured Slack channel. If the token address is not found, an error message will be logged.

POST `/tokendowngrade`: This endpoint listens for incoming webhooks related to token downgrade events. When a webhook request is received, the server parses the request data, fetches the relevant token downgrade events, formats the data, and sends a message to the configured Slack channel. If the token address is not found, an error message will be logged.

Both `/tokenupgrade` and `/tokendowngrade` endpoints expect incoming webhook data to be in JSON format and include the necessary information for processing the event (e.g., token address, block number). If there is an error processing the webhook, the server will respond with a 500 Internal Server Error status and log the error message.

## Alchemy GraphQL

The server uses Alchemy's GraphQL API to fetch token upgrade and downgrade events.

```
# Query Example:
# Polygon Mainnet
# Get TokenDowngrade from 0x3aD736904E9e65189c3000c7DD2c8AC8bB7cD4e3 USDCx 
{
  block {
    hash
    number
    logs(filter: {addresses: ["0x3aD736904E9e65189c3000c7DD2c8AC8bB7cD4e3"], topics: ["0x3bc27981aebbb57f9247dc00fde9d6cd91e4b230083fec3238fedbcba1f9ab3d"]}) {
      transaction {
        hash
        index
        from {
          address
        }
        to {
          address
        }
      }
    }
  }
}
```

## License
MIT License

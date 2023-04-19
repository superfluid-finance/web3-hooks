# Web3 Hooks

Web3 Hooks is a Node.js server that listens for incoming webhooks, parses the request data, and forwards the result to various clients such as Slack.

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

The server will listen for incoming webhook requests on the specified port (default: 3000). The ngrok tunnel will also be created, and its public URL will be logged in the console.

## License
MIT License
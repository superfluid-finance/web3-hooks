const { GET_DOWNGRADED_EVENTS, GET_UPGRADED_EVENTS, GET_TOKEN} = require('./queries/superTokenQueries');

const weiToEther = (wei) => {
    return BigInt(wei) / BigInt(1000000000000000000);
};

class EventFetcher {
    constructor(graphqlClient) {
        this.graphqlClient = graphqlClient;
    }

    async tokenUpgradedEvents(token, amount, blockNumber) {
        return this.fetchTokenEvents(token, amount, blockNumber, GET_UPGRADED_EVENTS, 'tokenUpgradedEvents');
    }

    async tokenDowngradedEvents(token, amount, blockNumber) {
        return this.fetchTokenEvents(token, amount, blockNumber, GET_DOWNGRADED_EVENTS, 'tokenDowngradedEvents');
    }

    async fetchTokenEvents(token, amount, blockNumber, eventQuery, eventName) {
        const queryVariables = {
            token,
            amount,
            blockNumber
        };
        const tokenData = await this.graphqlClient.query(GET_TOKEN, queryVariables);
        const eventsData = await this.graphqlClient.query(eventQuery, queryVariables);

        return eventsData[eventName].map((item) => {
            return {
                blockNumber: item.blockNumber,
                date: new Date(item.timestamp * 1000).toUTCString(),
                transactionHash: `https://polygonscan.com/tx/${item.transactionHash}`,
                eventName: item.name,
                tokenAddress: `https://polygonscan.com/address/${item.token}`,
                tokenName: tokenData.tokens[0].name,
                tokenSymbol: tokenData.tokens[0].symbol,
                amount: item.amount,
                formattedAmount: weiToEther(item.amount).toString()
            };
        });
    }
}

module.exports = EventFetcher;

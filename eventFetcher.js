const GraphQLClient = require('./graphqlClient');

const { GET_DOWNGRADED_EVENTS, GET_UPGRADED_EVENTS, GET_TOKEN} = require('./queries/superTokenQueries');

const weiToEther = (wei) => {
    return BigInt(wei) / BigInt(1000000000000000000);
};

class EventFetcher {
    // deprecated: bind to a specific network
    constructor(graphqlClient, explorerUrlBase) {
        this.graphqlClient = graphqlClient;
        this.explorerUrlBase = explorerUrlBase;
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
                transactionHash: `${this.explorerUrlBase}/tx/${item.transactionHash}`,
                eventName: item.name,
                tokenAddress: `${this.explorerUrlBase}/address/${item.token}`,
                tokenName: tokenData.tokens[0].name,
                tokenSymbol: tokenData.tokens[0].symbol,
                amount: item.amount,
                formattedAmount: weiToEther(item.amount).toString()
            };
        });
    }

    // V2

    // helpers

    async queryGraphQL(networkName, query) {
        const gclEndpointUrl = "https://{{NETWORK}}.subgraph.x.superfluid.dev".replace('{{NETWORK}}', networkName);
        const gclClient = new GraphQLClient(gclEndpointUrl);
        return await gclClient.query(query);
    }

    getGenericData(networkName, event) {
        return {
            networkName: networkName,
            eventName: event.event,
            blockNumber: event.blockNumber,
            transactionHash: event.transactionHash
        }
    }

    // event specific - add new events here. Method naming convention: getDataFor<event name>

    async getDataForAppRegistered(networkName, event) {
        console.log(`processAppRegistered: with event ${JSON.stringify(event)}`);
        const query = `{
            appRegisteredEvent(id: "AppRegistered-${event.transactionHash}-${event.logIndex}") {
                app timestamp
            }
        }`;
        const sgData = (await this.queryGraphQL(networkName, query)).appRegisteredEvent;
        return {
            ...this.getGenericData(networkName, event),
            app: sgData.app,
            date: new Date(sgData.timestamp * 1000).toUTCString()
        };
    }

    async getDataForJail(networkName, event) {
        console.log(`processJail: with event ${JSON.stringify(event)}`);
        const query = `{
            jailEvent(id: "Jail-${event.transactionHash}-${event.logIndex}") {
                app reason timestamp
            }
        }`;
        const sgData = (await this.queryGraphQL(networkName, query)).jailEvent;
        const reasonStrings = {
            1: "APP_RULE_REGISTRATION_ONLY_IN_CONSTRUCTOR",
            2: "APP_RULE_NO_REGISTRATION_FOR_EOA",
            10: "APP_RULE_NO_REVERT_ON_TERMINATION_CALLBACK",
            11: "APP_RULE_NO_CRITICAL_SENDER_ACCOUNT",
            12: "APP_RULE_NO_CRITICAL_RECEIVER_ACCOUNT",
            20: "APP_RULE_CTX_IS_READONLY",
            21: "APP_RULE_CTX_IS_NOT_CLEAN",
            22: "APP_RULE_CTX_IS_MALFORMATED",
            30: "APP_RULE_COMPOSITE_APP_IS_NOT_WHITELISTED",
            31: "APP_RULE_COMPOSITE_APP_IS_JAILED",
            40: "APP_RULE_MAX_APP_LEVEL_REACHED"
        };
        return {
            ...this.getGenericData(networkName, event),
            app: sgData.app,
            reason: reasonStrings[sgData.reason],
            date: new Date(sgData.timestamp * 1000).toUTCString(),
        };
    }

    async getDataForVestingScheduleCreated(networkName, event) {
        const tokenAddr = event.args[0];
        const query = `{
            token(id: "${tokenAddr.toLowerCase()}") {
              id name symbol
            }
          }`;
        const sgData = (await this.queryGraphQL(networkName, query)).token;
        return {
            ...this.getGenericData(networkName, event),
            tokenSymbol: sgData.symbol,
            tokenAddr: tokenAddr,
            sender: event.args[1],
            receiver: event.args[2],
        };
    }

    async getDataForFlowScheduleCreated(networkName, event) {
        // we want to exract the same data as for Vesting Schedules, thus just delegate
        return this.getDataForVestingScheduleCreated(networkName, event);
    }
}

module.exports = EventFetcher;

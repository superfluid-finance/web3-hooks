// get downgraded Event data
const GET_DOWNGRADED_EVENTS = `
  query DowngradedEvents($token: String! $amount: String! $blockNumber: Int!) {
  tokenDowngradedEvents(
    orderBy: timestamp
    orderDirection: asc
    where: {amount_gte: $amount, token_contains: $token blockNumber: $blockNumber}
  ) {
    blockNumber
    transactionHash
    name
    token
    amount
    timestamp 
  }
}
`;

const GET_UPGRADED_EVENTS = `
    query UpgradedEvents($token: String! $amount: String! $blockNumber: Int!) {
    tokenUpgradedEvents(
        orderBy: timestamp
        orderDirection: asc
        where: {amount_gte: $amount, token_contains: $token, blockNumber: $blockNumber}
    ) {
        blockNumber
        transactionHash
        name
        token
        amount
        timestamp
    }
}
`;

const GET_TOKEN = `
  query GetToken($token: String!) {
  tokens(where: {id: $token}
  ){
    name
    symbol
    isSuperToken
    isNativeAssetSuperToken
    isListed
  }
}
`;

module.exports = {
    GET_DOWNGRADED_EVENTS,
    GET_UPGRADED_EVENTS,
    GET_TOKEN
};
const { ApolloClient, InMemoryCache, HttpLink, gql } = require('@apollo/client/core');
const fetch = require('cross-fetch');

class GraphQLClient {
    constructor(apiUrl) {
        this.client = new ApolloClient({
            link: new HttpLink({ uri: apiUrl, fetch }),
            cache: new InMemoryCache(),
        });
    }

    async query(queryString, variables) {
        const query = gql`${queryString}`;
        const { data } = await this.client.query({ query, variables });
        return data;
    }
}

module.exports = GraphQLClient;
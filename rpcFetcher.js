#!/usr/bin/env node

/*
* usage: rpcFetcher.js <network name> <interface name> <contract name or address> <event name>
*   interface name is the name of the Solidity interface or contract
*   contract name or address: either a contract name to lookup in metadata network.contractsV1,
*                            or a direct contract address
*
* Intended usage:
* Periodically invoke via cronjob.
*
* ENV vars:
* - RPC: RPC URL to use. Defaults to canonical SF RPCs.
* - BLOCK_HEAD_OFFSET: distance from head block, intended to minimize the change of processing events undone by reorgs. Defaults to 12.
* - FROMBLOCK: block number to start from. Defaults to last checked block or HEAD minus maxQueryRange.
*   (the last checked block is persisted in a file in order to avoid redunant querying)
* - CONTRACT_ADDRESS: address of the contract to query in case <contract name> is not in network.contractsV1.
* - WEBHOOK_BASE_URL: base URL of the webhook to invoke. Defaults to http://localhost:3000.
*/

const fs = require('fs');
const { ethers } = require('ethers');
const axios = require("axios");
const sfAbis = require("@superfluid-finance/ethereum-contracts/build/bundled-abi");
const extraAbis = require("./extraAbis");
const allAbis = Object.assign({}, sfAbis, extraAbis);
const sfMetadata = require('@superfluid-finance/metadata');

const networkName = process.argv[2];
const ifaceName = process.argv[3];
const contractNameOrAddress = process.argv[4];
const eventName = process.argv[5];

const WEBHOOK_BASE_URL = process.env.WEBHOOK_BASE_URL || 'http://localhost:3000';
const BLOCK_HEAD_OFFSET = process.env.BLOCK_HEAD_OFFSET || 12;

if (networkName === undefined || ifaceName === undefined || contractNameOrAddress === undefined || eventName === undefined) {
    console.error(`usage: node ${process.argv[1]} <network name> <interface name> <contract name or address> <event name>`);
    process.exit(1);
}

const network = sfMetadata.getNetworkByName(networkName);
if (network === undefined) {
    throw("network not in metadata: ", networkName);
}

const abi = allAbis[ifaceName];
if (abi === undefined) {
    throw("interface not in known Abis: ", ifaceName);
}

const contractAddr = process.env.CONTRACT_ADDRESS || 
    (ethers.utils.isAddress(contractNameOrAddress) ? 
        contractNameOrAddress : 
        network.contractsV1[contractNameOrAddress]);

if (contractAddr === undefined) {
    throw("contract not found: neither a valid address nor in network.contractsV1: " + contractNameOrAddress);
}

const rpcUrl = process.env.RPC || `https://${networkName}.rpc.x.superfluid.dev`;
const maxQueryRange = network.logsQueryRange;
const lastCheckedFilename = `blocknr_${networkName}-${ifaceName}-${contractNameOrAddress}-${eventName}.txt`;
let lastCheckedBlock = fs.existsSync(lastCheckedFilename) ? parseInt(fs.readFileSync(lastCheckedFilename, 'utf8')) : 0;

console.log(`Using RPC ${rpcUrl}, ${ifaceName} contract at ${contractAddr}, event ${eventName}, max query range ${maxQueryRange}, last checked block ${lastCheckedBlock}`);

const provider = new ethers.providers.JsonRpcProvider(rpcUrl);
const contract = new ethers.Contract(contractAddr, abi, provider);

async function fetchEvents(fromBlockNr, toBlockNr) {
    console.log(`querying from ${fromBlockNr} to ${toBlockNr}`);

    const events = await contract.queryFilter(eventName, fromBlockNr, toBlockNr);
    console.log(`got ${events.length} events`);

    for (let event of events) {
        //console.log(JSON.stringify(event, null, 2));
        const blockNr = event.blockNumber;

        // We don't try to gracefully handle errors here, but let it crash.
        // That way the event isn't missed and may be picked up next time.
        await invokeWebhook(`${WEBHOOK_BASE_URL}/v2/${event.event.toLowerCase()}`, {
            networkName: network.name,
            chainId: network.chainId,
            event
        });
    }

    // persist last checked block in case we're interrupted
    fs.writeFileSync(lastCheckedFilename, toBlockNr.toString());
}

async function invokeWebhook(url, data) {
    console.log(`invoking webhook ${url}`);
    return response = await axios.post(url, data);
}

async function main() {
    const lastBlockNr = (await provider.getBlock('latest')).number - parseInt(BLOCK_HEAD_OFFSET);
    const firstBlockNr = process.env.FROMBLOCK ? parseInt(process.env.FROMBLOCK) : lastCheckedBlock || lastBlockNr - maxQueryRange;

    console.log(`Full query range: ${firstBlockNr} to ${lastBlockNr} (${lastBlockNr - firstBlockNr} blocks)`);

    if (firstBlockNr > lastBlockNr) {
        throw("FirstBlockNr > lastBlockNr");
    }

    // now invoke fetchEvents in a loop with batches of maxQueryRange blocks
    let batchStart = firstBlockNr;
    while (batchStart < lastBlockNr) {
        const batchEnd = Math.min(batchStart + maxQueryRange, lastBlockNr);
        await fetchEvents(batchStart, batchEnd);
        batchStart = batchEnd + 1;
    }
}

main().catch(console.error);

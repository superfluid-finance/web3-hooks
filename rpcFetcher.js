/*
* usage: node rpcFetcher.js <network name> <interface name> <contract name> <event name>
*   interface name is the name of the Solidity interface or contract
*   contract name is the key for contract address lookup in metadata network.contractsV1
*
* Intended usage:
* Periodically invoke via cronjob.
*/

const fs = require('fs');
const { ethers } = require('ethers');
const sfAbis = require("@superfluid-finance/ethereum-contracts/build/bundled-abi");
const sfMetadata = require('@superfluid-finance/metadata');

const networkName = process.argv[2];
const ifaceName = process.argv[3];
const contractName = process.argv[4];
const eventName = process.argv[5];

if (networkName === undefined || ifaceName === undefined || contractName === undefined || eventName === undefined) {
    console.error(`usage: node ${process.argv[1]} <network name> <interface name> <contract name> <event name>`);
    process.exit(1);
}

const network = sfMetadata.getNetworkByName(networkName);
if (network === undefined) {
    throw("network not in metadata: ", networkName);
}

const abi = sfAbis[ifaceName];
if (abi === undefined) {
    throw("interface not in sfAbis: ", ifaceName);
}

const contractAddr = network.contractsV1[contractName];
if (contractAddr === undefined) {
    throw("contract not in network.contractsV1: ", contractName);
}

const rpcUrl = process.env.RPC || `https://${networkName}.rpc.x.superfluid.dev`;
//const hostAddr = network.contractsV1.host;
const maxQueryRange = network.logsQueryRange;
const lastCheckedFilename = `blocknr_${networkName}-${ifaceName}-${contractName}-${eventName}.txt`;
let lastCheckedBlock = fs.existsSync(lastCheckedFilename) ? parseInt(fs.readFileSync(lastCheckedFilename, 'utf8')) : 0;

console.log(`Using RPC ${rpcUrl}, ${ifaceName} contract at ${contractAddr}, event ${eventName}, max query range ${maxQueryRange}, last checked block ${lastCheckedBlock}`);

const provider = new ethers.providers.JsonRpcProvider(rpcUrl);
const contract = new ethers.Contract(contractAddr, abi, provider);

async function fetchEvents(fromBlockNr, toBlockNr) {
    console.log(`querying from ${fromBlockNr} to ${toBlockNr}`);

    const events = await contract.queryFilter(eventName, fromBlockNr, toBlockNr);
    console.log(`got ${events.length} events`);

    for (let event of events) {
        console.log(event.args);
        // TODO: invoke backend
    }

    // persist last checked block in case we're interrupted
    fs.writeFileSync(lastCheckedFilename, toBlockNr.toString());
}

async function main() {
    const lastBlockNr = (await provider.getBlock('latest')).number;
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

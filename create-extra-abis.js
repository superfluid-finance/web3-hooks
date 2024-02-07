// compiles a list of bundled abis not contained in the one provided by the ethereum-contracts package
// usage: <exe> <path-to-scheduler-contracts-directory>
// example: node create-extra-abis.js ~/src/sf/protocol-monorepo/packages/automation-contracts/scheduler/

fs = require("fs");

dir = process.argv[2]

vestingSchedulerAbi = (require(`${dir}/artifacts/contracts/interface/IVestingScheduler.sol/IVestingScheduler`)).abi
flowSchedulerAbi= (require(`${dir}/artifacts/contracts/interface/IFlowScheduler.sol/IFlowScheduler`)).abi

extraAbis = {
    IFlowScheduler: flowSchedulerAbi,
    IVestingScheduler: vestingSchedulerAbi
}

fs.writeFileSync("extraAbis.json", JSON.stringify(extraAbis))

console.log("created extraAbis.json !");

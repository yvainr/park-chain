import { network } from "hardhat";
import { parseEther } from "viem";

const { viem, networkName } = await network.create();
const client = await viem.getPublicClient();

console.log(`Deploying ParkChain contracts to ${networkName}...`);

const registry = await viem.deployContract("OperatorRegistry");
console.log("OperatorRegistry:", registry.address);

const treasury = await viem.deployContract("OperatorTreasury", [registry.address, parseEther("0.001")]);
console.log("OperatorTreasury:", treasury.address);

const blockNumber = await client.getBlockNumber();
console.log("Deployment complete at block:", blockNumber.toString());

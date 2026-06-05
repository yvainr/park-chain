import { network } from "hardhat";
import { parseEther } from "viem";

const { viem, networkName } = await network.create();
const client = await viem.getPublicClient();

console.log(`Deploying ParkChain contracts to ${networkName}...`);

const credit = await viem.deployContract("ParkCredit");
console.log("ParkCredit:", credit.address);

const membership = await viem.deployContract("MembershipManager", [credit.address]);
console.log("MembershipManager:", membership.address);

await credit.write.setMinter([membership.address, true]);
console.log("Granted MembershipManager ParkCredit minter role");

await membership.write.setTier([1n, "Urban", 80n, parseEther("0.01"), 20n, true]);
await membership.write.setTier([2n, "Commuter", 200n, parseEther("0.02"), 60n, true]);
await membership.write.setTier([3n, "Unlimited", 400n, parseEther("0.03"), 120n, true]);
console.log("Configured default membership tiers");

const registry = await viem.deployContract("OperatorRegistry");
console.log("OperatorRegistry:", registry.address);

const treasury = await viem.deployContract("OperatorTreasury", [registry.address, parseEther("0.001")]);
console.log("OperatorTreasury:", treasury.address);

const ledger = await viem.deployContract("ParkingLedger", [
  membership.address,
  registry.address,
  credit.address,
  treasury.address,
]);
console.log("ParkingLedger:", ledger.address);

await credit.write.setBurner([ledger.address, true]);
console.log("Granted ParkingLedger ParkCredit burner role");

await treasury.write.setAllocator([ledger.address]);
console.log("Set ParkingLedger as treasury allocator");

await ledger.write.setGracePeriodMinutes([15n]);
console.log("Configured default 15-minute grace period");

const blockNumber = await client.getBlockNumber();
console.log("Deployment complete at block:", blockNumber.toString());

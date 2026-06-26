import fs from "node:fs";
import { network } from "hardhat";
import { keccak256, parseEther, stringToBytes } from "viem";

const { viem, networkHelpers } = await network.create();
const publicClient = await viem.getPublicClient();

const HOUR = 3600n;
const OPERATOR_ID = 77n;
const URBAN = 1n;
const STANDARD = keccak256(stringToBytes("standard"));

type GasRow = {
  contractName: string;
  action: string;
  gasUsed: bigint;
};

async function deployGasFixture() {
  const [deployer, operator, member] = await viem.getWalletClients();
  const credit = await viem.deployContract("ParkCredit");
  const membership = await viem.deployContract("MembershipManager", [credit.address]);
  const registry = await viem.deployContract("OperatorRegistry");
  const treasury = await viem.deployContract("OperatorTreasury", [registry.address, parseEther("0.001")]);
  const ledger = await viem.deployContract("ParkingLedger", [
    membership.address,
    registry.address,
    credit.address,
    treasury.address,
  ]);

  await credit.write.setMinter([membership.address, true]);
  await credit.write.setBurner([ledger.address, true]);
  await treasury.write.setAllocator([ledger.address]);
  await ledger.write.setGracePeriodMinutes([15n]);
  await membership.write.setTier([URBAN, "Urban", 100n, parseEther("0.01"), 20n, true]);
  await registry.write.registerOperator([OPERATOR_ID, operator.account.address, "Central Garage", [STANDARD]]);
  await registry.write.setPricePerHour([OPERATOR_ID, STANDARD, 10n], { account: operator.account });
  await registry.write.setNoShowFee([OPERATOR_ID, 4n], { account: operator.account });
  await registry.write.setCategoryCapacity([OPERATOR_ID, STANDARD, 100n], { account: operator.account });

  return { deployer, operator, member, credit, membership, treasury, ledger };
}

async function gasUsed(hash: `0x${string}`) {
  const receipt = await publicClient.waitForTransactionReceipt({ hash });
  return receipt.gasUsed;
}

function cost(gasUsed: bigint, gwei: bigint) {
  return gasUsed * gwei * 1_000_000_000n;
}

function render(rows: GasRow[]) {
  const lines = [
    "# Gas Usage Table",
    "",
    "| Contract | Action | Gas Used | Cost @ 1 gwei | Cost @ 10 gwei | Cost @ 30 gwei |",
    "|---|---:|---:|---:|---:|---:|",
  ];

  for (const row of rows) {
    lines.push(
      `| ${row.contractName} | ${row.action} | ${row.gasUsed} | ${cost(row.gasUsed, 1n)} | ${cost(
        row.gasUsed,
        10n,
      )} | ${cost(row.gasUsed, 30n)} |`,
    );
  }

  lines.push("");
  return lines.join("\n");
}

const rows: GasRow[] = [];

{
  const { membership, member } = await networkHelpers.loadFixture(deployGasFixture);
  rows.push({
    contractName: "MembershipManager",
    action: "purchaseMembership",
    gasUsed: await gasUsed(
      await membership.write.purchaseMembership([URBAN], { account: member.account, value: parseEther("0.01") }),
    ),
  });
}

{
  const { membership, ledger, member } = await networkHelpers.loadFixture(deployGasFixture);
  await membership.write.purchaseMembership([URBAN], { account: member.account, value: parseEther("0.01") });
  const startTime = BigInt(await networkHelpers.time.latest()) + HOUR;

  rows.push({
    contractName: "ParkingLedger",
    action: "reserve",
    gasUsed: await gasUsed(
      await ledger.write.reserve([OPERATOR_ID, STANDARD, startTime, 2n], { account: member.account }),
    ),
  });
}

{
  const { membership, ledger, member } = await networkHelpers.loadFixture(deployGasFixture);
  await membership.write.purchaseMembership([URBAN], { account: member.account, value: parseEther("0.01") });
  const startTime = BigInt(await networkHelpers.time.latest()) + HOUR;
  await ledger.write.reserve([OPERATOR_ID, STANDARD, startTime, 2n], { account: member.account });
  await networkHelpers.time.increaseTo(startTime);

  rows.push({
    contractName: "ParkingLedger",
    action: "checkIn",
    gasUsed: await gasUsed(await ledger.write.checkIn([0n], { account: member.account })),
  });
}

{
  const { treasury, deployer } = await networkHelpers.loadFixture(deployGasFixture);
  await treasury.write.setAllocator([deployer.account.address]);

  rows.push({
    contractName: "OperatorTreasury",
    action: "allocateEarnings",
    gasUsed: await gasUsed(await treasury.write.allocateEarnings([OPERATOR_ID, 20n])),
  });
}

{
  const { treasury, operator, member, deployer } = await networkHelpers.loadFixture(deployGasFixture);
  await treasury.write.setAllocator([deployer.account.address]);
  await treasury.write.allocateEarnings([OPERATOR_ID, 20n]);
  await member.sendTransaction({ to: treasury.address, value: parseEther("1") });

  rows.push({
    contractName: "OperatorTreasury",
    action: "withdraw",
    gasUsed: await gasUsed(await treasury.write.withdraw([OPERATOR_ID], { account: operator.account })),
  });
}

const markdown = render(rows);
fs.writeFileSync("gas-usage-table.md", markdown);
console.log(markdown);

import { network } from "hardhat";
import { keccak256, parseEther, stringToBytes, zeroAddress } from "viem";

export const { viem, networkHelpers } = await network.create();

export const HOUR = 3600n;
export const DAY = 24n * HOUR;
export const MONTH = 30n * DAY;

export const URBAN = 1n;
export const COMMUTER = 2n;
export const UNLIMITED = 3n;
export const OPERATOR_ID = 1n;

export const STANDARD = keccak256(stringToBytes("standard"));
export const DISABLED = keccak256(stringToBytes("disabled"));
export const EV_CHARGING = keccak256(stringToBytes("ev-charging"));
export const MOTORBIKE = keccak256(stringToBytes("motorbike"));
export const FAMILY_SLOT = keccak256(stringToBytes("family"));
export const WOMEN_SLOT = keccak256(stringToBytes("women"));
export const UNKNOWN_CATEGORY = keccak256(stringToBytes("unknown"));

export async function deploySystemFixture(options: { credits?: bigint; cap?: bigint; rate?: bigint } = {}) {
  const [deployer, operator, member, stranger, secondMember, allocator] = await viem.getWalletClients();
  const credits = options.credits ?? 80n;
  const cap = options.cap ?? 20n;
  const rate = options.rate ?? parseEther("0.01");

  const credit = await viem.deployContract("ParkCredit");
  const membership = await viem.deployContract("MembershipManager", [credit.address]);
  const registry = await viem.deployContract("OperatorRegistry");
  const treasury = await viem.deployContract("OperatorTreasury", [registry.address, rate]);
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

  await membership.write.setTier([URBAN, "Urban", credits, parseEther("0.01"), cap, true]);
  await membership.write.setTier([COMMUTER, "Commuter", 200n, parseEther("0.02"), 60n, true]);
  await membership.write.setTier([UNLIMITED, "Unlimited", 400n, parseEther("0.03"), 120n, true]);

  const categories = [STANDARD, EV_CHARGING, FAMILY_SLOT, WOMEN_SLOT];
  await registry.write.registerOperator([OPERATOR_ID, operator.account.address, "Central Garage", categories]);
  await registry.write.setPricePerHour([OPERATOR_ID, STANDARD, 10n], { account: operator.account });
  await registry.write.setPricePerHour([OPERATOR_ID, EV_CHARGING, 12n], { account: operator.account });
  await registry.write.setPricePerHour([OPERATOR_ID, FAMILY_SLOT, 11n], { account: operator.account });
  await registry.write.setPricePerHour([OPERATOR_ID, WOMEN_SLOT, 9n], { account: operator.account });
  await registry.write.setNoShowFee([OPERATOR_ID, 5n], { account: operator.account });

  for (const category of categories) {
    await registry.write.setCategoryCapacity([OPERATOR_ID, category, 100n], { account: operator.account });
  }

  return { deployer, operator, member, stranger, secondMember, allocator, credit, membership, registry, treasury, ledger };
}

export async function deployHundredCreditSystemFixture() {
  return deploySystemFixture({ credits: 100n, rate: parseEther("0.001") });
}

export async function deployLargeSystemFixture() {
  return deploySystemFixture({ credits: 400n, cap: 120n });
}

export async function deployStressSystemFixture() {
  return deploySystemFixture({ credits: 100n, cap: 120n });
}

export async function purchaseMembership(membership: any, member: any, tierId = URBAN, value = parseEther("0.01")) {
  await membership.write.purchaseMembership([tierId], {
    account: member.account,
    value,
  });
}

export async function renewMembership(membership: any, member: any, tierId = URBAN, value = parseEther("0.01")) {
  await membership.write.renewMembership([tierId], {
    account: member.account,
    value,
  });
}

export async function reserve(
  ledger: any,
  member: any,
  operatorId: bigint,
  category: `0x${string}`,
  startTime: bigint,
  duration: bigint,
) {
  const reservationId = await ledger.read.nextReservationID();
  await ledger.write.reserve([operatorId, category, startTime, duration], { account: member.account });
  return reservationId;
}

export async function reserveSlot(
  ledger: any,
  member: any,
  operatorId: bigint,
  category: `0x${string}`,
  slotId: bigint,
  startTime: bigint,
  duration: bigint,
) {
  const reservationId = await ledger.read.nextReservationID();
  await ledger.write.reserveSlot([operatorId, category, slotId, startTime, duration], { account: member.account });
  return reservationId;
}

export async function expectOwnableUnauthorized(promise: Promise<unknown>, account: `0x${string}`) {
  await viem.assertions.revertWith(promise, `OwnableUnauthorizedAccount("${account}")`);
}

export { parseEther, zeroAddress };

import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { network } from "hardhat";
import { keccak256, parseEther, stringToBytes } from "viem";

const { viem, networkHelpers } = await network.create();

const STANDARD = keccak256(stringToBytes("standard"));
const EV_CHARGING = keccak256(stringToBytes("ev-charging"));
const FAMILY_SLOT = keccak256(stringToBytes("family"));
const WOMEN_SLOT = keccak256(stringToBytes("women"));

async function deployLedgerFixture() {
  const [deployer, operator, member, stranger] = await viem.getWalletClients();

  const credit = await viem.deployContract("ParkCredit");
  const membership = await viem.deployContract("MembershipManager", [credit.address]);
  const registry = await viem.deployContract("OperatorRegistry");
  const treasury = await viem.deployContract("OperatorTreasury", [registry.address, parseEther("0.01")]);
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
  await membership.write.setTier([1n, "Urban", 80n, parseEther("0.01"), 20n, true]);

  await registry.write.registerOperator([
    1n,
    operator.account.address,
    "Central Garage",
    [STANDARD, EV_CHARGING, FAMILY_SLOT, WOMEN_SLOT],
  ]);

  await registry.write.setPricePerHour([1n, STANDARD, 10n], { account: operator.account });
  await registry.write.setPricePerHour([1n, EV_CHARGING, 12n], { account: operator.account });
  await registry.write.setPricePerHour([1n, FAMILY_SLOT, 11n], { account: operator.account });
  await registry.write.setPricePerHour([1n, WOMEN_SLOT, 9n], { account: operator.account });
  await registry.write.setNoShowFee([1n, 5n], { account: operator.account });

  return { deployer, operator, member, stranger, credit, membership, registry, treasury, ledger };
}

async function purchaseUrban(membership: any, member: any) {
  await membership.write.purchaseMembership([1n], {
    account: member.account,
    value: parseEther("0.01"),
  });
}

describe("ParkingLedger", function () {
  it("stores family and women slot reservation categories", async function () {
    const { ledger, membership, member } = await networkHelpers.loadFixture(deployLedgerFixture);
    const now = BigInt(await networkHelpers.time.latest());

    await purchaseUrban(membership, member);

    assert.equal(await ledger.read.FAMILY_SLOT_CATEGORY(), FAMILY_SLOT);
    assert.equal(await ledger.read.WOMEN_SLOT_CATEGORY(), WOMEN_SLOT);

    await ledger.write.reserve([1n, FAMILY_SLOT, now + 3600n, 2n], { account: member.account });
    await ledger.write.reserve([1n, WOMEN_SLOT, now + 7200n, 1n], { account: member.account });

    const familyReservation = await ledger.read.getReservation([0n]);
    const womenReservation = await ledger.read.getReservation([1n]);

    assert.equal(familyReservation.category, FAMILY_SLOT);
    assert.equal(womenReservation.category, WOMEN_SLOT);
  });

  it("rejects inactive members, unsupported categories, overlaps, and cap excess", async function () {
    const { ledger, membership, member } = await networkHelpers.loadFixture(deployLedgerFixture);
    const now = BigInt(await networkHelpers.time.latest());
    const month = 30n * 24n * 3600n;
    const startTime = ((now / month) + 1n) * month + 24n * 3600n;

    await viem.assertions.revertWith(
      ledger.write.reserve([1n, STANDARD, startTime, 1n], { account: member.account }),
      "ParkingLedger: inactive member",
    );

    await purchaseUrban(membership, member);

    await viem.assertions.revertWith(
      ledger.write.reserve([1n, keccak256(stringToBytes("unknown")), startTime, 1n], { account: member.account }),
      "ParkingLedger: unsupported category",
    );

    await ledger.write.reserve([1n, STANDARD, startTime, 3n], { account: member.account });

    await viem.assertions.revertWith(
      ledger.write.reserve([1n, STANDARD, startTime + 3600n, 2n], { account: member.account }),
      "ParkingLedger: overlap",
    );

    await viem.assertions.revertWith(
      ledger.write.reserve([1n, STANDARD, startTime + 5n * 3600n, 18n], { account: member.account }),
      "ParkingLedger: category cap exceeded",
    );
  });

  it("charges check-in and rounded overstay fees into treasury earnings", async function () {
    const { ledger, membership, credit, treasury, member } = await networkHelpers.loadFixture(deployLedgerFixture);
    const now = BigInt(await networkHelpers.time.latest());
    const startTime = now + 3600n;

    await purchaseUrban(membership, member);
    await ledger.write.reserve([1n, STANDARD, startTime, 2n], { account: member.account });

    await networkHelpers.time.increaseTo(startTime);
    await ledger.write.checkIn([0n], { account: member.account });

    assert.equal(await credit.read.balanceOf([member.account.address, 1n]), 60n);
    assert.equal(await treasury.read.getAccumulatedEarnings([1n]), 20n);

    await networkHelpers.time.increaseTo(startTime + 3n * 3600n);
    await ledger.write.checkOut([0n], { account: member.account });

    assert.equal(await credit.read.balanceOf([member.account.address, 1n]), 50n);
    assert.equal(await treasury.read.getAccumulatedEarnings([1n]), 30n);
  });

  it("settles no-shows and releases reserved usage", async function () {
    const { ledger, membership, credit, treasury, member, stranger } = await networkHelpers.loadFixture(deployLedgerFixture);
    const now = BigInt(await networkHelpers.time.latest());
    const startTime = now + 3600n;

    await purchaseUrban(membership, member);
    await ledger.write.reserve([1n, STANDARD, startTime, 2n], { account: member.account });

    const monthKey = await ledger.read.getMonthKey([startTime]);
    assert.equal(await ledger.read.getUsedHoursByOperator([member.account.address, 1n, monthKey]), 2n);

    await networkHelpers.time.increaseTo(startTime);
    await ledger.write.markNoShow([0n], { account: stranger.account });

    const reservation = await ledger.read.getReservation([0n]);

    assert.equal(reservation.status, 4);
    assert.equal(await credit.read.balanceOf([member.account.address, 1n]), 75n);
    assert.equal(await treasury.read.getAccumulatedEarnings([1n]), 5n);
    assert.equal(await ledger.read.getUsedHoursByOperator([member.account.address, 1n, monthKey]), 0n);
  });
});

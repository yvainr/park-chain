import assert from "node:assert/strict";
import { describe, it } from "node:test";
import {
  COMMUTER,
  DAY,
  UNLIMITED,
  URBAN,
  networkHelpers,
  parseEther,
  purchaseMembership,
  renewMembership,
  viem,
} from "./helpers.js";

async function deployMembershipFixture() {
  const [owner, member, stranger] = await viem.getWalletClients();
  const credit = await viem.deployContract("ParkCredit");
  const membership = await viem.deployContract("MembershipManager", [credit.address]);

  await credit.write.setMinter([membership.address, true]);
  await membership.write.setTier([URBAN, "Urban", 80n, parseEther("0.01"), 20n, true]);
  await membership.write.setTier([COMMUTER, "Commuter", 200n, parseEther("0.02"), 60n, true]);
  await membership.write.setTier([UNLIMITED, "Unlimited", 400n, parseEther("0.03"), 120n, true]);

  return { owner, member, stranger, credit, membership };
}

describe("MembershipManager", function () {
  it("stores owner and ParkCredit dependency", async function () {
    const { owner, credit, membership } = await networkHelpers.loadFixture(deployMembershipFixture);

    assert.equal((await membership.read.owner()).toLowerCase(), owner.account.address);
    assert.equal((await membership.read.parkCredit()).toLowerCase(), credit.address);
  });

  it("rejects a zero ParkCredit address", async function () {
    await viem.assertions.revertWith(
      viem.deployContract("MembershipManager", ["0x0000000000000000000000000000000000000000"]),
      "MembershipManager: zero credit",
    );
  });

  it("lets admin create and update tiers", async function () {
    const { membership } = await networkHelpers.loadFixture(deployMembershipFixture);

    await membership.write.setTier([URBAN, "Urban Plus", 90n, parseEther("0.011"), 25n, true]);

    const tier = await membership.read.tiers([URBAN]);
    assert.equal(tier[0], "Urban Plus");
    assert.equal(tier[1], 90n);
    assert.equal(tier[2], parseEther("0.011"));
    assert.equal(tier[3], 25n);
    assert.equal(tier[4], true);
  });

  it("rejects non-admin tier updates and empty names", async function () {
    const { membership, stranger } = await networkHelpers.loadFixture(deployMembershipFixture);

    await viem.assertions.revertWith(
      membership.write.setTier([4n, "Student", 50n, parseEther("0.005"), 15n, true], {
        account: stranger.account,
      }),
      "MembershipManager: not owner",
    );

    await viem.assertions.revertWith(
      membership.write.setTier([4n, "", 50n, parseEther("0.005"), 15n, true]),
      "MembershipManager: empty name",
    );
  });

  it("lets members purchase Urban, Commuter, and Unlimited tiers", async function () {
    const { credit, membership, member } = await networkHelpers.loadFixture(deployMembershipFixture);

    await purchaseMembership(membership, member, URBAN, parseEther("0.01"));
    assert.equal(await credit.read.balanceOf([member.account.address, 1n]), 80n);
    assert.equal(await membership.read.getMemberTier([member.account.address]), URBAN);

    await purchaseMembership(membership, member, COMMUTER, parseEther("0.02"));
    assert.equal(await credit.read.balanceOf([member.account.address, 1n]), 280n);
    assert.equal(await membership.read.getMemberTier([member.account.address]), COMMUTER);

    await purchaseMembership(membership, member, UNLIMITED, parseEther("0.03"));
    assert.equal(await credit.read.balanceOf([member.account.address, 1n]), 680n);
    assert.equal(await membership.read.getMemberTier([member.account.address]), UNLIMITED);
  });

  it("rejects wrong ETH amounts and inactive tiers", async function () {
    const { membership, member } = await networkHelpers.loadFixture(deployMembershipFixture);

    await viem.assertions.revertWith(
      membership.write.purchaseMembership([URBAN], { account: member.account, value: parseEther("0.02") }),
      "MembershipManager: wrong ETH amount",
    );

    await viem.assertions.revertWith(
      membership.write.renewMembership([URBAN], { account: member.account, value: parseEther("0.02") }),
      "MembershipManager: wrong ETH amount",
    );

    await membership.write.setTier([URBAN, "Urban", 80n, parseEther("0.01"), 20n, false]);

    await viem.assertions.revertWith(
      membership.write.purchaseMembership([URBAN], { account: member.account, value: parseEther("0.01") }),
      "MembershipManager: inactive tier",
    );

    await viem.assertions.revertWith(
      membership.write.renewMembership([URBAN], { account: member.account, value: parseEther("0.01") }),
      "MembershipManager: inactive tier",
    );
  });

  it("mints credits, stores expiry, and exposes active cap reads", async function () {
    const { credit, membership, member } = await networkHelpers.loadFixture(deployMembershipFixture);
    await purchaseMembership(membership, member, URBAN, parseEther("0.01"));
    const purchaseTime = BigInt(await networkHelpers.time.latest());

    assert.equal(await credit.read.balanceOf([member.account.address, 1n]), 80n);
    assert.equal(await membership.read.getMembershipExpiry([member.account.address]), purchaseTime + 30n * DAY);
    assert.equal(await membership.read.isMemberActive([member.account.address]), true);
    assert.equal(await membership.read.getMemberMonthlyHourCap([member.account.address]), 20n);
  });

  it("extends renewal before expiry from the old expiry", async function () {
    const { credit, membership, member } = await networkHelpers.loadFixture(deployMembershipFixture);
    await purchaseMembership(membership, member, URBAN, parseEther("0.01"));
    const firstExpiry = await membership.read.getMembershipExpiry([member.account.address]);
    await networkHelpers.time.increaseTo(BigInt(await networkHelpers.time.latest()) + 10n * DAY);
    await renewMembership(membership, member, URBAN, parseEther("0.01"));

    assert.equal(await membership.read.getMembershipExpiry([member.account.address]), firstExpiry + 30n * DAY);
    assert.equal(await credit.read.balanceOf([member.account.address, 1n]), 160n);
  });

  it("extends renewal after expiry from the current timestamp", async function () {
    const { credit, membership, member } = await networkHelpers.loadFixture(deployMembershipFixture);

    await purchaseMembership(membership, member, URBAN, parseEther("0.01"));
    const expiredAt = (await membership.read.getMembershipExpiry([member.account.address])) + 10n * DAY;
    await networkHelpers.time.increaseTo(expiredAt);
    await renewMembership(membership, member, COMMUTER, parseEther("0.02"));
    const renewalTime = BigInt(await networkHelpers.time.latest());

    assert.equal(await membership.read.getMembershipExpiry([member.account.address]), renewalTime + 30n * DAY);
    assert.equal(await membership.read.getMemberTier([member.account.address]), COMMUTER);
    assert.equal(await credit.read.balanceOf([member.account.address, 1n]), 280n);
  });

  it("reports expired or inactive memberships as inactive with zero cap", async function () {
    const { membership, member } = await networkHelpers.loadFixture(deployMembershipFixture);

    await purchaseMembership(membership, member, URBAN, parseEther("0.01"));
    await networkHelpers.time.increaseTo(await membership.read.getMembershipExpiry([member.account.address]));

    assert.equal(await membership.read.isMemberActive([member.account.address]), false);
    assert.equal(await membership.read.getMemberMonthlyHourCap([member.account.address]), 0n);

    await renewMembership(membership, member, URBAN, parseEther("0.01"));
    await membership.write.setTier([URBAN, "Urban", 80n, parseEther("0.01"), 20n, false]);

    assert.equal(await membership.read.isMemberActive([member.account.address]), false);
    assert.equal(await membership.read.getMemberMonthlyHourCap([member.account.address]), 0n);
  });

  it("reverts purchase if MembershipManager is not a ParkCredit minter", async function () {
    const { credit, membership, member } = await networkHelpers.loadFixture(deployMembershipFixture);

    await credit.write.setMinter([membership.address, false]);

    await viem.assertions.revertWith(
      membership.write.purchaseMembership([URBAN], { account: member.account, value: parseEther("0.01") }),
      "Not authorized to mint",
    );
  });
});

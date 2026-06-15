import assert from "node:assert/strict";
import { describe, it } from "node:test";
import {
  DAY,
  HOUR,
  OPERATOR_ID,
  STANDARD,
  deployLargeSystemFixture,
  deployStressSystemFixture,
  deploySystemFixture,
  networkHelpers,
  parseEther,
  purchaseMembership,
  renewMembership,
  reserve,
  viem,
} from "./helpers.js";

describe("ParkChain deterministic fuzz and invariant coverage", function () {
  it("checks reservation fee arithmetic over bounded duration and price cases", async function () {
    const cases = [
      [1n, 1n],
      [2n, 10n],
      [5n, 7n],
      [10n, 3n],
      [20n, 5n],
    ] as const;

    for (const [duration, price] of cases) {
      const { ledger, membership, registry, credit, treasury, operator, member } =
        await networkHelpers.loadFixture(deployStressSystemFixture);
      const now = BigInt(await networkHelpers.time.latest());
      const startTime = now + HOUR;

      await registry.write.setPricePerHour([OPERATOR_ID, STANDARD, price], { account: operator.account });
      await purchaseMembership(membership, member);
      await reserve(ledger, member, OPERATOR_ID, STANDARD, startTime, duration);

      await networkHelpers.time.increaseTo(startTime);
      await ledger.write.checkIn([0n], { account: member.account });

      const expectedFee = price * duration;
      assert.equal((await credit.read.balanceOf([member.account.address, 1n])) + expectedFee, 100n);
      assert.equal(await treasury.read.getAccumulatedEarnings([OPERATOR_ID]), expectedFee);
    }
  });

  it("checks renewal extension across bounded elapsed times", async function () {
    const elapsedCases = [0n, 1n, HOUR, 10n * DAY, 29n * DAY - 1n];

    for (const elapsed of elapsedCases) {
      const { membership, credit, member } = await networkHelpers.loadFixture(deploySystemFixture);

      await purchaseMembership(membership, member);
      const firstExpiry = await membership.read.getMembershipExpiry([member.account.address]);
      await networkHelpers.time.increaseTo(BigInt(await networkHelpers.time.latest()) + elapsed + 1n);
      await renewMembership(membership, member);

      assert.equal(await membership.read.getMembershipExpiry([member.account.address]), firstExpiry + 30n * DAY);
      assert.equal(await credit.read.balanceOf([member.account.address, 1n]), 160n);
    }
  });

  it("checks zero-duration rejection across bounded operator and start inputs", async function () {
    const { ledger, member } = await networkHelpers.loadFixture(deploySystemFixture);
    const now = BigInt(await networkHelpers.time.latest());

    for (const operatorId of [0n, 1n, 77n]) {
      for (const offset of [1n, HOUR, 30n * DAY]) {
        await viem.assertions.revertWith(
          ledger.write.reserve([operatorId, STANDARD, now + offset, 0n], { account: member.account }),
          "ParkingLedger: invalid duration",
        );
      }
    }
  });

  it("checks non-bookers cannot mutate active reservations", async function () {
    const { ledger, membership, member, stranger, secondMember } = await networkHelpers.loadFixture(deploySystemFixture);
    const now = BigInt(await networkHelpers.time.latest());
    const startTime = now + HOUR;

    await purchaseMembership(membership, member);
    await reserve(ledger, member, OPERATOR_ID, STANDARD, startTime, 1n);

    for (const nonBooker of [stranger, secondMember]) {
      await viem.assertions.revertWith(
        ledger.write.cancelReservation([0n], { account: nonBooker.account }),
        "ParkingLedger: not member",
      );
    }

    await networkHelpers.time.increaseTo(startTime);

    for (const nonBooker of [stranger, secondMember]) {
      await viem.assertions.revertWith(
        ledger.write.checkIn([0n], { account: nonBooker.account }),
        "ParkingLedger: not member",
      );
    }
  });

  it("keeps reservation IDs sequential through stateful flows", async function () {
    const { ledger, membership, member } = await networkHelpers.loadFixture(deployLargeSystemFixture);
    const now = BigInt(await networkHelpers.time.latest());

    await purchaseMembership(membership, member);

    const ids = [
      await reserve(ledger, member, OPERATOR_ID, STANDARD, now + HOUR, 1n),
      await reserve(ledger, member, OPERATOR_ID, STANDARD, now + 3n * HOUR, 1n),
      await reserve(ledger, member, OPERATOR_ID, STANDARD, now + 5n * HOUR, 1n),
      await reserve(ledger, member, OPERATOR_ID, STANDARD, now + 7n * HOUR, 1n),
    ];

    await ledger.write.cancelReservation([ids[0]], { account: member.account });
    await networkHelpers.time.increaseTo(now + 3n * HOUR);
    await ledger.write.checkIn([ids[1]], { account: member.account });
    await ledger.write.checkOut([ids[1]], { account: member.account });
    await networkHelpers.time.increaseTo(now + 5n * HOUR);
    await ledger.write.markNoShow([ids[2]]);

    assert.deepEqual(ids, [0n, 1n, 2n, 3n]);
    assert.equal(await ledger.read.nextReservationID(), 4n);

    const memberReservations = await ledger.read.getActiveReservation([member.account.address]);
    assert.deepEqual(memberReservations, ids);

    for (const id of ids) {
      const reservation = await ledger.read.getReservation([id]);
      assert.equal(reservation.reservationID, id);
      assert.equal(reservation.member.toLowerCase(), member.account.address);
      assert.equal(reservation.duration > 0n, true);
    }
  });

  it("keeps treasury accounting equal to allocated credits in stateful flows", async function () {
    const { treasury, deployer } = await networkHelpers.loadFixture(deploySystemFixture);
    let expected = 0n;

    await treasury.write.setAllocator([deployer.account.address]);

    for (const amount of [1n, 7n, 42n, 100n, 999n]) {
      await treasury.write.allocateEarnings([OPERATOR_ID, amount]);
      expected += amount;
      assert.equal(await treasury.read.getAccumulatedEarnings([OPERATOR_ID]), expected);
    }
  });
});

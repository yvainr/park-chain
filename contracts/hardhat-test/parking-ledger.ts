import assert from "node:assert/strict";
import { describe, it } from "node:test";
import {
  DISABLED,
  EV_CHARGING,
  FAMILY_SLOT,
  HOUR,
  OPERATOR_ID,
  STANDARD,
  UNKNOWN_CATEGORY,
  WOMEN_SLOT,
  deployLargeSystemFixture,
  deploySystemFixture,
  networkHelpers,
  parseEther,
  purchaseMembership,
  reserve,
  reserveSlot,
  viem,
} from "./helpers.js";

describe("ParkingLedger", function () {
  it("creates a valid reservation and tracks monthly usage", async function () {
    const { ledger, membership, member } = await networkHelpers.loadFixture(deploySystemFixture);
    const now = BigInt(await networkHelpers.time.latest());
    const startTime = now + HOUR;

    await purchaseMembership(membership, member);
    const reservationId = await reserve(ledger, member, OPERATOR_ID, FAMILY_SLOT, startTime, 2n);
    const reservation = await ledger.read.getReservation([reservationId]);
    const monthKey = await ledger.read.getMonthKey([startTime]);

    assert.equal(reservation.member.toLowerCase(), member.account.address);
    assert.equal(reservation.operatorID, OPERATOR_ID);
    assert.equal(reservation.category, FAMILY_SLOT);
    assert.equal(reservation.status, 0);
    assert.equal(await ledger.read.getUsedHoursByCategory([member.account.address, FAMILY_SLOT, monthKey]), 2n);
    assert.equal(await ledger.read.getUsedHoursByOperator([member.account.address, OPERATOR_ID, monthKey]), 2n);
  });

  it("enforces zero, available, and full category capacity", async function () {
    const { ledger, membership, registry, operator, member, secondMember } =
      await networkHelpers.loadFixture(deploySystemFixture);
    const now = BigInt(await networkHelpers.time.latest());
    const startTime = now + HOUR;

    await registry.write.setSupportedCategory([OPERATOR_ID, DISABLED, true]);
    await purchaseMembership(membership, member);
    await purchaseMembership(membership, secondMember);

    await viem.assertions.revertWith(
      ledger.write.reserve([OPERATOR_ID, DISABLED, startTime, 2n], { account: member.account }),
      "ParkingLedger: category slot-capacity full",
    );

    await registry.write.setCategoryCapacity([OPERATOR_ID, DISABLED, 1n], { account: operator.account });
    await reserve(ledger, member, OPERATOR_ID, DISABLED, startTime, 2n);

    await viem.assertions.revertWith(
      ledger.write.reserve([OPERATOR_ID, DISABLED, startTime, 2n], { account: secondMember.account }),
      "ParkingLedger: category slot-capacity full",
    );
  });

  it("stores specific slot reservations and indexes them by operator, category, and slot", async function () {
    const { ledger, membership, member } = await networkHelpers.loadFixture(deploySystemFixture);
    const now = BigInt(await networkHelpers.time.latest());
    const startTime = now + HOUR;

    await purchaseMembership(membership, member);
    const reservationId = await reserveSlot(ledger, member, OPERATOR_ID, STANDARD, 7n, startTime, 2n);

    const reservation = await ledger.read.getReservation([reservationId]);
    const slotReservations = await ledger.read.getSlotReservations([OPERATOR_ID, STANDARD, 7n]);

    assert.equal(reservation.slotID, 7n);
    assert.deepEqual(slotReservations, [reservationId]);
  });

  it("blocks overlapping reservations for the same slot and allows overlapping reservations for different slots", async function () {
    const { ledger, membership, member, secondMember } = await networkHelpers.loadFixture(deploySystemFixture);
    const now = BigInt(await networkHelpers.time.latest());
    const startTime = now + HOUR;

    await purchaseMembership(membership, member);
    await purchaseMembership(membership, secondMember);
    await reserveSlot(ledger, member, OPERATOR_ID, STANDARD, 1n, startTime, 2n);

    await viem.assertions.revertWith(
      ledger.write.reserveSlot([OPERATOR_ID, STANDARD, 1n, startTime + HOUR, 1n], {
        account: secondMember.account,
      }),
      "ParkingLedger: slot unavailable",
    );

    const secondReservationId = await reserveSlot(
      ledger,
      secondMember,
      OPERATOR_ID,
      STANDARD,
      2n,
      startTime + HOUR,
      1n,
    );
    const secondReservation = await ledger.read.getReservation([secondReservationId]);

    assert.equal(secondReservation.slotID, 2n);
  });

  it("allows adjacent reservations on the same slot", async function () {
    const { ledger, membership, member } = await networkHelpers.loadFixture(deploySystemFixture);
    const now = BigInt(await networkHelpers.time.latest());
    const startTime = now + HOUR;

    await purchaseMembership(membership, member);
    await reserveSlot(ledger, member, OPERATOR_ID, STANDARD, 1n, startTime, 2n);

    assert.equal(await ledger.read.isSlotAvailable([OPERATOR_ID, STANDARD, 1n, startTime + 2n * HOUR, 1n]), true);

    const adjacentReservationId = await reserveSlot(
      ledger,
      member,
      OPERATOR_ID,
      STANDARD,
      1n,
      startTime + 2n * HOUR,
      1n,
    );
    const adjacentReservation = await ledger.read.getReservation([adjacentReservationId]);

    assert.equal(adjacentReservation.slotID, 1n);
  });

  it("rejects invalid slot identifiers outside configured capacity", async function () {
    const { ledger, membership, registry, operator, member } = await networkHelpers.loadFixture(deploySystemFixture);
    const now = BigInt(await networkHelpers.time.latest());
    const startTime = now + HOUR;

    await registry.write.setCategoryCapacity([OPERATOR_ID, STANDARD, 2n], { account: operator.account });
    await purchaseMembership(membership, member);

    await viem.assertions.revertWith(
      ledger.write.reserveSlot([OPERATOR_ID, STANDARD, 0n, startTime, 1n], { account: member.account }),
      "ParkingLedger: invalid slot",
    );
    await viem.assertions.revertWith(
      ledger.write.reserveSlot([OPERATOR_ID, STANDARD, 3n, startTime, 1n], { account: member.account }),
      "ParkingLedger: slot out of range",
    );

    assert.equal(await ledger.read.isSlotAvailable([OPERATOR_ID, STANDARD, 0n, startTime, 1n]), false);
    assert.equal(await ledger.read.isSlotAvailable([OPERATOR_ID, STANDARD, 3n, startTime, 1n]), false);
  });

  it("reports slot availability as active reservations move through terminal states", async function () {
    const { ledger, membership, member } = await networkHelpers.loadFixture(deploySystemFixture);
    const now = BigInt(await networkHelpers.time.latest());
    const cancelledStart = now + HOUR;
    const checkedOutStart = now + 4n * HOUR;
    const noShowStart = now + 8n * HOUR;

    await purchaseMembership(membership, member);

    assert.equal(await ledger.read.isSlotAvailable([OPERATOR_ID, STANDARD, 1n, cancelledStart, 1n]), true);

    const cancelledId = await reserveSlot(ledger, member, OPERATOR_ID, STANDARD, 1n, cancelledStart, 1n);
    assert.equal(await ledger.read.isSlotAvailable([OPERATOR_ID, STANDARD, 1n, cancelledStart, 1n]), false);
    await ledger.write.cancelReservation([cancelledId], { account: member.account });
    assert.equal(await ledger.read.isSlotAvailable([OPERATOR_ID, STANDARD, 1n, cancelledStart, 1n]), true);

    const checkedOutId = await reserveSlot(ledger, member, OPERATOR_ID, STANDARD, 1n, checkedOutStart, 1n);
    await networkHelpers.time.increaseTo(checkedOutStart);
    await ledger.write.checkIn([checkedOutId], { account: member.account });
    assert.equal(await ledger.read.isSlotAvailable([OPERATOR_ID, STANDARD, 1n, checkedOutStart, 1n]), false);
    await networkHelpers.time.increaseTo(checkedOutStart + HOUR);
    await ledger.write.checkOut([checkedOutId], { account: member.account });
    assert.equal(await ledger.read.isSlotAvailable([OPERATOR_ID, STANDARD, 1n, checkedOutStart, 1n]), true);

    const noShowId = await reserveSlot(ledger, member, OPERATOR_ID, STANDARD, 1n, noShowStart, 1n);
    await networkHelpers.time.increaseTo(noShowStart);
    assert.equal(await ledger.read.isSlotAvailable([OPERATOR_ID, STANDARD, 1n, noShowStart, 1n]), false);
    await ledger.write.markNoShow([noShowId]);
    assert.equal(await ledger.read.isSlotAvailable([OPERATOR_ID, STANDARD, 1n, noShowStart, 1n]), true);
  });

  it("auto-assigns the first available slot for legacy reservations", async function () {
    const { ledger, membership, registry, operator, member, secondMember } =
      await networkHelpers.loadFixture(deploySystemFixture);
    const now = BigInt(await networkHelpers.time.latest());
    const startTime = now + HOUR;

    await registry.write.setCategoryCapacity([OPERATOR_ID, STANDARD, 2n], { account: operator.account });
    await purchaseMembership(membership, member);
    await purchaseMembership(membership, secondMember);

    assert.equal(await ledger.read.getFirstAvailableSlot([OPERATOR_ID, STANDARD, startTime, 2n]), 1n);

    const firstReservationId = await reserve(ledger, member, OPERATOR_ID, STANDARD, startTime, 2n);
    const secondReservationId = await reserve(ledger, secondMember, OPERATOR_ID, STANDARD, startTime, 2n);
    const firstReservation = await ledger.read.getReservation([firstReservationId]);
    const secondReservation = await ledger.read.getReservation([secondReservationId]);

    assert.equal(firstReservation.slotID, 1n);
    assert.equal(secondReservation.slotID, 2n);
    assert.equal(await ledger.read.getFirstAvailableSlot([OPERATOR_ID, STANDARD, startTime, 2n]), 0n);
  });

  it("rejects inactive members, unsupported categories, removed operators, and expired memberships", async function () {
    const { ledger, membership, registry, member } = await networkHelpers.loadFixture(deploySystemFixture);
    const now = BigInt(await networkHelpers.time.latest());
    const startTime = now + HOUR;

    await viem.assertions.revertWith(
      ledger.write.reserve([OPERATOR_ID, STANDARD, startTime, 1n], { account: member.account }),
      "ParkingLedger: inactive member",
    );

    await purchaseMembership(membership, member);

    await viem.assertions.revertWith(
      ledger.write.reserve([OPERATOR_ID, UNKNOWN_CATEGORY, startTime, 1n], { account: member.account }),
      "ParkingLedger: unsupported category",
    );

    await registry.write.removeOperator([OPERATOR_ID]);

    await viem.assertions.revertWith(
      ledger.write.reserve([OPERATOR_ID, STANDARD, startTime, 1n], { account: member.account }),
      "ParkingLedger: operator not whitelisted",
    );

    const fresh = await deploySystemFixture();
    await purchaseMembership(fresh.membership, fresh.member);
    await networkHelpers.time.increaseTo(await fresh.membership.read.getMembershipExpiry([fresh.member.account.address]));

    await viem.assertions.revertWith(
      fresh.ledger.write.reserve([OPERATOR_ID, STANDARD, BigInt(await networkHelpers.time.latest()) + HOUR, 1n], {
        account: fresh.member.account,
      }),
      "ParkingLedger: inactive member",
    );
  });

  it("rejects invalid reservation inputs, overlaps, category capacity, and monthly cap excess", async function () {
    const { ledger, membership, registry, operator, member, secondMember } =
      await networkHelpers.loadFixture(deploySystemFixture);
    const now = BigInt(await networkHelpers.time.latest());
    const startTime = now + HOUR;

    await purchaseMembership(membership, member);

    await viem.assertions.revertWith(
      ledger.write.reserve([OPERATOR_ID, STANDARD, startTime, 0n], { account: member.account }),
      "ParkingLedger: invalid duration",
    );

    await reserve(ledger, member, OPERATOR_ID, STANDARD, startTime, 3n);

    await viem.assertions.revertWith(
      ledger.write.reserve([OPERATOR_ID, STANDARD, startTime + HOUR, 2n], { account: member.account }),
      "ParkingLedger: overlap",
    );

    await registry.write.setCategoryCapacity([OPERATOR_ID, EV_CHARGING, 1n], { account: operator.account });
    await purchaseMembership(membership, secondMember);
    await reserve(ledger, member, OPERATOR_ID, EV_CHARGING, startTime + 10n * HOUR, 2n);

    await viem.assertions.revertWith(
      ledger.write.reserve([OPERATOR_ID, EV_CHARGING, startTime + 10n * HOUR, 1n], { account: secondMember.account }),
      "ParkingLedger: category slot-capacity full",
    );

    await viem.assertions.revertWith(
      ledger.write.reserve([OPERATOR_ID, STANDARD, startTime + 4n * HOUR, 18n], { account: member.account }),
      "ParkingLedger: category cap exceeded",
    );

    await reserve(ledger, secondMember, OPERATOR_ID, STANDARD, startTime + 20n * HOUR, 12n);

    await viem.assertions.revertWith(
      ledger.write.reserve([OPERATOR_ID, FAMILY_SLOT, startTime + 33n * HOUR, 9n], { account: secondMember.account }),
      "ParkingLedger: operator cap exceeded",
    );
  });

  it("cancels before start for free and releases reserved usage", async function () {
    const { ledger, membership, credit, treasury, member } = await networkHelpers.loadFixture(deploySystemFixture);
    const now = BigInt(await networkHelpers.time.latest());
    const startTime = now + HOUR;

    await purchaseMembership(membership, member);
    const reservationId = await reserve(ledger, member, OPERATOR_ID, STANDARD, startTime, 3n);
    const monthKey = await ledger.read.getMonthKey([startTime]);

    await ledger.write.cancelReservation([reservationId], { account: member.account });

    const reservation = await ledger.read.getReservation([reservationId]);

    assert.equal(reservation.status, 3);
    assert.equal(await credit.read.balanceOf([member.account.address, 1n]), 80n);
    assert.equal(await treasury.read.getAccumulatedEarnings([OPERATOR_ID]), 0n);
    assert.equal(await ledger.read.getUsedHoursByCategory([member.account.address, STANDARD, monthKey]), 0n);
    assert.equal(await ledger.read.getUsedHoursByOperator([member.account.address, OPERATOR_ID, monthKey]), 0n);
  });

  it("rejects early check-in, then charges credits and allocates earnings at check-in", async function () {
    const { ledger, membership, credit, treasury, member } = await networkHelpers.loadFixture(deploySystemFixture);
    const now = BigInt(await networkHelpers.time.latest());
    const startTime = now + HOUR;

    await purchaseMembership(membership, member);
    const reservationId = await reserve(ledger, member, OPERATOR_ID, STANDARD, startTime, 2n);

    await viem.assertions.revertWith(
      ledger.write.checkIn([reservationId], { account: member.account }),
      "ParkingLedger: too early",
    );

    await networkHelpers.time.increaseTo(startTime);
    await ledger.write.checkIn([reservationId], { account: member.account });

    const reservation = await ledger.read.getReservation([reservationId]);

    assert.equal(reservation.status, 1);
    assert.equal(reservation.checkInTime >= startTime, true);
    assert.equal(await credit.read.balanceOf([member.account.address, 1n]), 60n);
    assert.equal(await treasury.read.getAccumulatedEarnings([OPERATOR_ID]), 20n);
  });

  it("checks out without overstay and charges no extra fee", async function () {
    const { ledger, membership, credit, treasury, member } = await networkHelpers.loadFixture(deploySystemFixture);
    const now = BigInt(await networkHelpers.time.latest());
    const startTime = now + HOUR;

    await purchaseMembership(membership, member);
    const reservationId = await reserve(ledger, member, OPERATOR_ID, STANDARD, startTime, 2n);

    await networkHelpers.time.increaseTo(startTime);
    await ledger.write.checkIn([reservationId], { account: member.account });
    await networkHelpers.time.increaseTo(startTime + 2n * HOUR + 10n * 60n);
    await ledger.write.checkOut([reservationId], { account: member.account });

    const reservation = await ledger.read.getReservation([reservationId]);

    assert.equal(reservation.status, 2);
    assert.equal(await credit.read.balanceOf([member.account.address, 1n]), 60n);
    assert.equal(await treasury.read.getAccumulatedEarnings([OPERATOR_ID]), 20n);
  });

  it("charges rounded overstay fees after grace period", async function () {
    const { ledger, membership, credit, treasury, member } = await networkHelpers.loadFixture(deploySystemFixture);
    const now = BigInt(await networkHelpers.time.latest());
    const startTime = now + HOUR;

    await purchaseMembership(membership, member);
    const reservationId = await reserve(ledger, member, OPERATOR_ID, STANDARD, startTime, 2n);

    await networkHelpers.time.increaseTo(startTime);
    await ledger.write.checkIn([reservationId], { account: member.account });
    await networkHelpers.time.increaseTo(startTime + 3n * HOUR);
    await ledger.write.checkOut([reservationId], { account: member.account });

    assert.equal(await credit.read.balanceOf([member.account.address, 1n]), 50n);
    assert.equal(await treasury.read.getAccumulatedEarnings([OPERATOR_ID]), 30n);
  });

  it("settles no-shows and releases reserved usage", async function () {
    const { ledger, membership, credit, treasury, member, stranger } =
      await networkHelpers.loadFixture(deploySystemFixture);
    const now = BigInt(await networkHelpers.time.latest());
    const startTime = now + HOUR;

    await purchaseMembership(membership, member);
    const reservationId = await reserve(ledger, member, OPERATOR_ID, STANDARD, startTime, 2n);
    const monthKey = await ledger.read.getMonthKey([startTime]);

    await networkHelpers.time.increaseTo(startTime);
    await ledger.write.markNoShow([reservationId], { account: stranger.account });

    const reservation = await ledger.read.getReservation([reservationId]);

    assert.equal(reservation.status, 4);
    assert.equal(await credit.read.balanceOf([member.account.address, 1n]), 75n);
    assert.equal(await treasury.read.getAccumulatedEarnings([OPERATOR_ID]), 5n);
    assert.equal(await ledger.read.getUsedHoursByCategory([member.account.address, STANDARD, monthKey]), 0n);
    assert.equal(await ledger.read.getUsedHoursByOperator([member.account.address, OPERATOR_ID, monthKey]), 0n);
  });

  it("cancellation after start settles as no-show", async function () {
    const { ledger, membership, credit, treasury, member } = await networkHelpers.loadFixture(deploySystemFixture);
    const now = BigInt(await networkHelpers.time.latest());
    const startTime = now + HOUR;

    await purchaseMembership(membership, member);
    const reservationId = await reserve(ledger, member, OPERATOR_ID, STANDARD, startTime, 2n);

    await networkHelpers.time.increaseTo(startTime);
    await ledger.write.cancelReservation([reservationId], { account: member.account });

    const reservation = await ledger.read.getReservation([reservationId]);

    assert.equal(reservation.status, 4);
    assert.equal(await credit.read.balanceOf([member.account.address, 1n]), 75n);
    assert.equal(await treasury.read.getAccumulatedEarnings([OPERATOR_ID]), 5n);
  });

  it("rejects invalid lifecycle transitions and non-member mutations", async function () {
    const { ledger, membership, member, stranger } = await networkHelpers.loadFixture(deploySystemFixture);
    const now = BigInt(await networkHelpers.time.latest());
    const startTime = now + HOUR;

    await purchaseMembership(membership, member);
    const reservationId = await reserve(ledger, member, OPERATOR_ID, STANDARD, startTime, 1n);

    await viem.assertions.revertWith(
      ledger.write.cancelReservation([reservationId], { account: stranger.account }),
      "ParkingLedger: not member",
    );

    await ledger.write.cancelReservation([reservationId], { account: member.account });

    await viem.assertions.revertWith(
      ledger.write.checkIn([reservationId], { account: member.account }),
      "ParkingLedger: invalid status",
    );

    await viem.assertions.revertWith(
      ledger.write.checkOut([reservationId], { account: member.account }),
      "ParkingLedger: invalid status",
    );

    await viem.assertions.revertWith(ledger.write.markNoShow([reservationId]), "ParkingLedger: invalid status");

    const noShowId = await reserve(ledger, member, OPERATOR_ID, STANDARD, startTime + HOUR, 1n);
    await networkHelpers.time.increaseTo(startTime + HOUR);
    await ledger.write.markNoShow([noShowId]);

    await viem.assertions.revertWith(
      ledger.write.checkIn([noShowId], { account: member.account }),
      "ParkingLedger: invalid status",
    );

    await viem.assertions.revertWith(
      ledger.write.cancelReservation([noShowId], { account: member.account }),
      "ParkingLedger: invalid status",
    );
  });

  it("stores family and women slot reservation categories", async function () {
    const { ledger, membership, member } = await networkHelpers.loadFixture(deploySystemFixture);
    const now = BigInt(await networkHelpers.time.latest());

    await purchaseMembership(membership, member);

    assert.equal(await ledger.read.FAMILY_SLOT_CATEGORY(), FAMILY_SLOT);
    assert.equal(await ledger.read.WOMEN_SLOT_CATEGORY(), WOMEN_SLOT);

    await reserve(ledger, member, OPERATOR_ID, FAMILY_SLOT, now + HOUR, 2n);
    await reserve(ledger, member, OPERATOR_ID, WOMEN_SLOT, now + 4n * HOUR, 1n);

    const familyReservation = await ledger.read.getReservation([0n]);
    const womenReservation = await ledger.read.getReservation([1n]);

    assert.equal(familyReservation.category, FAMILY_SLOT);
    assert.equal(womenReservation.category, WOMEN_SLOT);
  });

  it("honors custom grace period setter alias", async function () {
    const { ledger } = await networkHelpers.loadFixture(deploySystemFixture);

    await ledger.write.setGracePeriod([20n]);

    assert.equal(await ledger.read.gracePeriodMinutes(), 20n);
  });

  it("can reserve when configured with a larger tier allowance", async function () {
    const { ledger, membership, member } = await networkHelpers.loadFixture(deployLargeSystemFixture);
    const now = BigInt(await networkHelpers.time.latest());

    await purchaseMembership(membership, member);
    const reservationId = await reserve(ledger, member, OPERATOR_ID, STANDARD, now + HOUR, 24n);

    const reservation = await ledger.read.getReservation([reservationId]);
    assert.equal(reservation.duration, 24n);
  });
});

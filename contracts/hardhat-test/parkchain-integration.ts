import assert from "node:assert/strict";
import { describe, it } from "node:test";
import {
  EV_CHARGING,
  HOUR,
  OPERATOR_ID,
  STANDARD,
  URBAN,
  deployHundredCreditSystemFixture,
  deploySystemFixture,
  networkHelpers,
  parseEther,
  purchaseMembership,
  reserve,
  viem,
} from "./helpers.js";

describe("ParkChain integration", function () {
  it("runs the member reservation and operator payout flow across all contracts", async function () {
    const { ledger, membership, registry, credit, treasury, operator, member } =
      await networkHelpers.loadFixture(deployHundredCreditSystemFixture);
    const publicClient = await viem.getPublicClient();
    const now = BigInt(await networkHelpers.time.latest());
    const startTime = now + HOUR;

    await purchaseMembership(membership, member);

    assert.equal(await membership.read.isMemberActive([member.account.address]), true);
    assert.equal(await membership.read.getMemberTier([member.account.address]), URBAN);
    assert.equal(await membership.read.getMemberMonthlyHourCap([member.account.address]), 20n);
    assert.equal(await credit.read.balanceOf([member.account.address, 1n]), 100n);
    assert.equal(await registry.read.isWhitelisted([OPERATOR_ID]), true);
    assert.equal(await registry.read.supportsCategory([OPERATOR_ID, STANDARD]), true);
    assert.equal(await registry.read.getPricePerHour([OPERATOR_ID, STANDARD]), 10n);
    assert.equal(await registry.read.getNoShowFee([OPERATOR_ID]), 5n);

    await reserve(ledger, member, OPERATOR_ID, STANDARD, startTime, 2n);

    const reservations = await ledger.read.getActiveReservation([member.account.address]);
    assert.equal(reservations.length, 1);
    assert.equal(reservations[0], 0n);

    const reserved = await ledger.read.getReservation([0n]);
    assert.equal(reserved.member.toLowerCase(), member.account.address);
    assert.equal(reserved.operatorID, OPERATOR_ID);
    assert.equal(reserved.category, STANDARD);
    assert.equal(reserved.status, 0);

    await networkHelpers.time.increaseTo(startTime);
    await ledger.write.checkIn([0n], { account: member.account });

    const checkedIn = await ledger.read.getReservation([0n]);
    assert.equal(checkedIn.checkInTime >= startTime, true);
    assert.equal(checkedIn.status, 1);
    assert.equal(await credit.read.balanceOf([member.account.address, 1n]), 80n);
    assert.equal(await treasury.read.getAccumulatedEarnings([OPERATOR_ID]), 20n);

    await networkHelpers.time.increaseTo(startTime + 2n * HOUR + 10n * 60n);
    await ledger.write.checkOut([0n], { account: member.account });

    const checkedOut = await ledger.read.getReservation([0n]);
    assert.equal(checkedOut.status, 2);

    await member.sendTransaction({ to: treasury.address, value: parseEther("1") });
    const balanceBefore = await publicClient.getBalance({ address: operator.account.address });
    const hash = await treasury.write.withdraw([OPERATOR_ID], { account: operator.account });
    const receipt = await publicClient.waitForTransactionReceipt({ hash });
    const balanceAfter = await publicClient.getBalance({ address: operator.account.address });
    const gasCost = receipt.gasUsed * receipt.effectiveGasPrice;

    assert.equal(balanceAfter + gasCost - balanceBefore, parseEther("0.02"));
    assert.equal(await treasury.read.getAccumulatedEarnings([OPERATOR_ID]), 0n);
  });

  it("runs cancellation, no-show settlement, and cross-contract guard paths", async function () {
    const { ledger, membership, registry, credit, treasury, operator, member, stranger } =
      await networkHelpers.loadFixture(deployHundredCreditSystemFixture);
    const now = BigInt(await networkHelpers.time.latest());

    await purchaseMembership(membership, member);
    await reserve(ledger, member, OPERATOR_ID, EV_CHARGING, now + HOUR, 1n);
    await ledger.write.cancelReservation([0n], { account: member.account });

    let reservation = await ledger.read.getReservation([0n]);
    assert.equal(reservation.status, 3);
    assert.equal(await credit.read.balanceOf([member.account.address, 1n]), 100n);

    const noShowStart = now + 2n * HOUR;
    await reserve(ledger, member, OPERATOR_ID, STANDARD, noShowStart, 1n);
    await networkHelpers.time.increaseTo(noShowStart);
    await ledger.write.markNoShow([1n]);

    reservation = await ledger.read.getReservation([1n]);
    assert.equal(reservation.status, 4);
    assert.equal(await credit.read.balanceOf([member.account.address, 1n]), 95n);
    assert.equal(await treasury.read.getAccumulatedEarnings([OPERATOR_ID]), 5n);

    await viem.assertions.revertWith(
      membership.write.setTier([2n, "Commuter", 200n, parseEther("0.02"), 60n, true], {
        account: stranger.account,
      }),
      "MembershipManager: not owner",
    );

    await viem.assertions.revertWith(
      registry.write.removeOperator([OPERATOR_ID], { account: stranger.account }),
      "OperatorRegistry: not owner",
    );

    await viem.assertions.revertWith(
      registry.write.setPricePerHour([OPERATOR_ID, STANDARD, 99n], { account: stranger.account }),
      "OperatorRegistry: not operator wallet",
    );

    await viem.assertions.revertWith(
      treasury.write.setCreditToEthRate([parseEther("0.002")], { account: stranger.account }),
      "OperatorTreasury: not owner",
    );

    await viem.assertions.revertWith(
      treasury.write.allocateEarnings([OPERATOR_ID, 1n], { account: stranger.account }),
      "OperatorTreasury: not allocator",
    );

    await viem.assertions.revertWith(
      credit.write.burn([member.account.address, 1n], { account: stranger.account }),
      "Not authorized to burn",
    );

    await registry.write.removeOperator([OPERATOR_ID]);
    assert.equal(await registry.read.isWhitelisted([OPERATOR_ID]), false);

    await viem.assertions.revertWith(
      registry.write.setPricePerHour([OPERATOR_ID, STANDARD, 12n], { account: operator.account }),
      "OperatorRegistry: not whitelisted",
    );
  });
});

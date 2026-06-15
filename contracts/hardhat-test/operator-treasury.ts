import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { OPERATOR_ID, STANDARD, networkHelpers, parseEther, viem } from "./helpers.js";

async function deployTreasuryFixture() {
  const [deployer, operator, allocator, stranger] = await viem.getWalletClients();
  const registry = await viem.deployContract("OperatorRegistry");

  await registry.write.registerOperator([OPERATOR_ID, operator.account.address, "Central Garage", [STANDARD]]);

  const treasury = await viem.deployContract("OperatorTreasury", [registry.address, parseEther("0.01")]);

  return { deployer, operator, allocator, stranger, registry, treasury };
}

describe("OperatorTreasury", function () {
  it("lets the owner update exchange rate and allocator", async function () {
    const { treasury, allocator } = await networkHelpers.loadFixture(deployTreasuryFixture);

    await treasury.write.setCreditToEthRate([parseEther("0.02")]);
    await treasury.write.setAllocator([allocator.account.address]);

    assert.equal(await treasury.read.getCreditToEthRate(), parseEther("0.02"));
    assert.equal((await treasury.read.allocator()).toLowerCase(), allocator.account.address);
  });

  it("rejects non-owner admin updates and zero allocator", async function () {
    const { treasury, allocator, stranger } = await networkHelpers.loadFixture(deployTreasuryFixture);

    await viem.assertions.revertWith(
      treasury.write.setCreditToEthRate([parseEther("0.02")], { account: stranger.account }),
      "OperatorTreasury: not owner",
    );

    await viem.assertions.revertWith(
      treasury.write.setAllocator([allocator.account.address], { account: stranger.account }),
      "OperatorTreasury: not owner",
    );

    await viem.assertions.revertWith(
      treasury.write.setAllocator(["0x0000000000000000000000000000000000000000"]),
      "OperatorTreasury: zero allocator",
    );
  });

  it("rejects a zero registry constructor argument", async function () {
    await viem.assertions.revertWith(
      viem.deployContract("OperatorTreasury", [
        "0x0000000000000000000000000000000000000000",
        parseEther("0.01"),
      ]),
      "OperatorTreasury: zero registry",
    );
  });

  it("lets the allocator allocate earnings", async function () {
    const { treasury, allocator } = await networkHelpers.loadFixture(deployTreasuryFixture);

    await treasury.write.setAllocator([allocator.account.address]);
    await treasury.write.allocateEarnings([OPERATOR_ID, 42n], { account: allocator.account });

    assert.equal(await treasury.read.getAccumulatedEarnings([OPERATOR_ID]), 42n);
  });

  it("rejects invalid allocation attempts", async function () {
    const { treasury, allocator, stranger } = await networkHelpers.loadFixture(deployTreasuryFixture);

    await treasury.write.setAllocator([allocator.account.address]);

    await viem.assertions.revertWith(
      treasury.write.allocateEarnings([OPERATOR_ID, 42n], { account: stranger.account }),
      "OperatorTreasury: not allocator",
    );

    await viem.assertions.revertWith(
      treasury.write.allocateEarnings([OPERATOR_ID, 0n], { account: allocator.account }),
      "OperatorTreasury: zero amount",
    );

    await viem.assertions.revertWith(
      treasury.write.allocateEarnings([404n, 42n], { account: allocator.account }),
      "OperatorTreasury: unknown operator",
    );
  });

  it("lets the operator withdraw and applies the exchange rate", async function () {
    const { treasury, operator, allocator } = await networkHelpers.loadFixture(deployTreasuryFixture);
    const publicClient = await viem.getPublicClient();

    await treasury.write.setAllocator([allocator.account.address]);
    await treasury.write.allocateEarnings([OPERATOR_ID, 50n], { account: allocator.account });
    await allocator.sendTransaction({ to: treasury.address, value: parseEther("1") });

    const balanceBefore = await publicClient.getBalance({ address: operator.account.address });
    const hash = await treasury.write.withdraw([OPERATOR_ID], { account: operator.account });
    const receipt = await publicClient.waitForTransactionReceipt({ hash });
    const balanceAfter = await publicClient.getBalance({ address: operator.account.address });

    const gasCost = receipt.gasUsed * receipt.effectiveGasPrice;

    assert.equal(balanceAfter + gasCost - balanceBefore, parseEther("0.5"));
    assert.equal(await treasury.read.getAccumulatedEarnings([OPERATOR_ID]), 0n);
  });

  it("rejects invalid withdrawals", async function () {
    const { treasury, operator, stranger } = await networkHelpers.loadFixture(deployTreasuryFixture);

    await treasury.write.allocateEarnings([OPERATOR_ID, 50n]);

    await viem.assertions.revertWith(
      treasury.write.withdraw([404n], { account: stranger.account }),
      "OperatorTreasury: unknown operator",
    );

    await viem.assertions.revertWith(
      treasury.write.withdraw([OPERATOR_ID], { account: stranger.account }),
      "OperatorTreasury: not operator wallet",
    );

    await viem.assertions.revertWith(
      treasury.write.withdraw([OPERATOR_ID], { account: operator.account }),
      "OperatorTreasury: insufficient liquidity",
    );

    assert.equal(await treasury.read.getAccumulatedEarnings([OPERATOR_ID]), 50n);
  });

  it("rejects withdrawals with no earnings or a zero exchange rate", async function () {
    const { treasury, operator } = await networkHelpers.loadFixture(deployTreasuryFixture);

    await viem.assertions.revertWith(
      treasury.write.withdraw([OPERATOR_ID], { account: operator.account }),
      "OperatorTreasury: no earnings",
    );

    await treasury.write.allocateEarnings([OPERATOR_ID, 50n]);
    await treasury.write.setCreditToEthRate([0n]);

    await viem.assertions.revertWith(
      treasury.write.withdraw([OPERATOR_ID], { account: operator.account }),
      "OperatorTreasury: zero exchange rate",
    );
  });

  it("can receive ETH liquidity", async function () {
    const { treasury, deployer } = await networkHelpers.loadFixture(deployTreasuryFixture);
    const publicClient = await viem.getPublicClient();
    const balanceBefore = await publicClient.getBalance({ address: treasury.address });

    await deployer.sendTransaction({ to: treasury.address, value: parseEther("0.25") });

    assert.equal(await publicClient.getBalance({ address: treasury.address }), balanceBefore + parseEther("0.25"));
  });
});

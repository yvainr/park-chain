import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { network } from "hardhat";
import { keccak256, parseEther, stringToBytes } from "viem";

const { viem, networkHelpers } = await network.create();

const STANDARD = keccak256(stringToBytes("standard"));
const INITIAL_RATE = parseEther("0.01");

async function deployTreasuryFixture() {
  const [deployer, operator, allocator, stranger] = await viem.getWalletClients();
  const registry = await viem.deployContract("OperatorRegistry");

  await registry.write.registerOperator([1n, operator.account.address, "Central Garage", [STANDARD]]);

  const treasury = await viem.deployContract("OperatorTreasury", [registry.address, INITIAL_RATE]);

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

  it("rejects non-owner admin updates", async function () {
    const { treasury, allocator, stranger } = await networkHelpers.loadFixture(deployTreasuryFixture);

    await viem.assertions.revertWith(
      treasury.write.setCreditToEthRate([parseEther("0.02")], { account: stranger.account }),
      "OperatorTreasury: not owner",
    );

    await viem.assertions.revertWith(
      treasury.write.setAllocator([allocator.account.address], { account: stranger.account }),
      "OperatorTreasury: not owner",
    );
  });

  it("lets the allocator allocate earnings", async function () {
    const { treasury, allocator } = await networkHelpers.loadFixture(deployTreasuryFixture);

    await treasury.write.setAllocator([allocator.account.address]);
    await treasury.write.allocateEarnings([1n, 42n], { account: allocator.account });

    assert.equal(await treasury.read.getAccumulatedEarnings([1n]), 42n);
  });

  it("rejects allocation from non-allocator accounts", async function () {
    const { treasury, allocator, stranger } = await networkHelpers.loadFixture(deployTreasuryFixture);

    await treasury.write.setAllocator([allocator.account.address]);

    await viem.assertions.revertWith(
      treasury.write.allocateEarnings([1n, 42n], { account: stranger.account }),
      "OperatorTreasury: not allocator",
    );
  });

  it("lets the operator withdraw and applies the exchange rate", async function () {
    const { treasury, operator, allocator } = await networkHelpers.loadFixture(deployTreasuryFixture);
    const publicClient = await viem.getPublicClient();

    await treasury.write.setAllocator([allocator.account.address]);
    await treasury.write.allocateEarnings([1n, 50n], { account: allocator.account });
    await allocator.sendTransaction({ to: treasury.address, value: parseEther("1") });

    const balanceBefore = await publicClient.getBalance({ address: operator.account.address });
    const hash = await treasury.write.withdraw([1n], { account: operator.account });
    const receipt = await publicClient.waitForTransactionReceipt({ hash });
    const balanceAfter = await publicClient.getBalance({ address: operator.account.address });

    const gasCost = receipt.gasUsed * receipt.effectiveGasPrice;

    assert.equal(balanceAfter + gasCost - balanceBefore, parseEther("0.5"));
    assert.equal(await treasury.read.getAccumulatedEarnings([1n]), 0n);
  });

  it("rejects withdrawals from non-operator accounts", async function () {
    const { treasury, stranger } = await networkHelpers.loadFixture(deployTreasuryFixture);

    await treasury.write.allocateEarnings([1n, 50n]);

    await viem.assertions.revertWith(
      treasury.write.withdraw([1n], { account: stranger.account }),
      "OperatorTreasury: not operator wallet",
    );
  });

  it("reverts withdrawals when treasury liquidity is insufficient", async function () {
    const { treasury, operator } = await networkHelpers.loadFixture(deployTreasuryFixture);

    await treasury.write.allocateEarnings([1n, 50n]);

    await viem.assertions.revertWith(
      treasury.write.withdraw([1n], { account: operator.account }),
      "OperatorTreasury: insufficient liquidity",
    );

    assert.equal(await treasury.read.getAccumulatedEarnings([1n]), 50n);
  });
});

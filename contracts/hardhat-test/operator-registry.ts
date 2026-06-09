import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { network } from "hardhat";
import { keccak256, stringToBytes } from "viem";

const { viem, networkHelpers } = await network.create();

const STANDARD = keccak256(stringToBytes("standard"));
const EV_CHARGING = keccak256(stringToBytes("ev-charging"));
const FAMILY_SLOT = keccak256(stringToBytes("family"));
const WOMEN_SLOT = keccak256(stringToBytes("women"));

async function deployRegistryFixture() {
  const [, operator, stranger] = await viem.getWalletClients();
  const registry = await viem.deployContract("OperatorRegistry");

  return { registry, operator, stranger };
}

describe("OperatorRegistry", function () {
  it("lets the admin register and remove an operator", async function () {
    const { registry, operator } = await networkHelpers.loadFixture(deployRegistryFixture);

    await registry.write.registerOperator([
      1n,
      operator.account.address,
      "Central Garage",
      [STANDARD, EV_CHARGING, FAMILY_SLOT, WOMEN_SLOT],
    ]);

    assert.equal(await registry.read.isWhitelisted([1n]), true);
    assert.equal(await registry.read.supportsCategory([1n, STANDARD]), true);
    assert.equal(await registry.read.supportsCategory([1n, EV_CHARGING]), true);
    assert.equal(await registry.read.supportsCategory([1n, FAMILY_SLOT]), true);
    assert.equal(await registry.read.supportsCategory([1n, WOMEN_SLOT]), true);
    assert.equal((await registry.read.getOperatorWallet([1n])).toLowerCase(), operator.account.address);

    await registry.write.removeOperator([1n]);

    assert.equal(await registry.read.isWhitelisted([1n]), false);
  });

  it("rejects non-admin registration and removal", async function () {
    const { registry, operator, stranger } = await networkHelpers.loadFixture(deployRegistryFixture);

    await viem.assertions.revertWith(
      registry.write.registerOperator([1n, operator.account.address, "Central Garage", [STANDARD]], {
        account: stranger.account,
      }),
      "OperatorRegistry: not owner",
    );

    await registry.write.registerOperator([1n, operator.account.address, "Central Garage", [STANDARD]]);

    await viem.assertions.revertWith(
      registry.write.removeOperator([1n], { account: stranger.account }),
      "OperatorRegistry: not owner",
    );
  });

  it("only lets the operator wallet set price and no-show fee", async function () {
    const { registry, operator, stranger } = await networkHelpers.loadFixture(deployRegistryFixture);

    await registry.write.registerOperator([1n, operator.account.address, "Central Garage", [STANDARD]]);

    await viem.assertions.revertWith(
      registry.write.setPricePerHour([1n, STANDARD, 10n], { account: stranger.account }),
      "OperatorRegistry: not operator wallet",
    );

    await viem.assertions.revertWith(
      registry.write.setNoShowFee([1n, 3n], { account: stranger.account }),
      "OperatorRegistry: not operator wallet",
    );

    await registry.write.setPricePerHour([1n, STANDARD, 10n], { account: operator.account });
    await registry.write.setNoShowFee([1n, 3n], { account: operator.account });

    assert.equal(await registry.read.getPricePerHour([1n, STANDARD]), 10n);
    assert.equal(await registry.read.getNoShowFee([1n]), 3n);
  });

  it("lets the admin update category support", async function () {
    const { registry, operator } = await networkHelpers.loadFixture(deployRegistryFixture);

    await registry.write.registerOperator([1n, operator.account.address, "Central Garage", [STANDARD]]);

    assert.equal(await registry.read.supportsCategory([1n, EV_CHARGING]), false);

    await registry.write.setSupportedCategory([1n, EV_CHARGING, true]);
    assert.equal(await registry.read.supportsCategory([1n, EV_CHARGING]), true);

    await registry.write.setSupportedCategory([1n, STANDARD, false]);
    assert.equal(await registry.read.supportsCategory([1n, STANDARD]), false);
  });

  it("supports family and women slot categories", async function () {
    const { registry, operator } = await networkHelpers.loadFixture(deployRegistryFixture);

    assert.equal(await registry.read.FAMILY_SLOT_CATEGORY(), FAMILY_SLOT);
    assert.equal(await registry.read.WOMEN_SLOT_CATEGORY(), WOMEN_SLOT);

    await registry.write.registerOperator([1n, operator.account.address, "Central Garage", [FAMILY_SLOT, WOMEN_SLOT]]);

    await registry.write.setPricePerHour([1n, FAMILY_SLOT, 12n], { account: operator.account });
    await registry.write.setPricePerHour([1n, WOMEN_SLOT, 9n], { account: operator.account });

    assert.equal(await registry.read.supportsCategory([1n, FAMILY_SLOT]), true);
    assert.equal(await registry.read.supportsCategory([1n, WOMEN_SLOT]), true);
    assert.equal(await registry.read.getPricePerHour([1n, FAMILY_SLOT]), 12n);
    assert.equal(await registry.read.getPricePerHour([1n, WOMEN_SLOT]), 9n);
  });
});

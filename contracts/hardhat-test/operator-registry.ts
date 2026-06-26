import assert from "node:assert/strict";
import { describe, it } from "node:test";
import {
  EV_CHARGING,
  FAMILY_SLOT,
  STANDARD,
  WOMEN_SLOT,
  networkHelpers,
  viem,
} from "./helpers.js";

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
    assert.equal(await registry.read.operatorIdByWallet([operator.account.address]), 1n);

    await registry.write.removeOperator([1n]);

    assert.equal(await registry.read.isWhitelisted([1n]), false);
    assert.equal(await registry.read.operatorIdByWallet([operator.account.address]), 0n);
  });

  it("keeps wallet-to-operator IDs unique and updates reassigned IDs", async function () {
    const { registry, operator, stranger } = await networkHelpers.loadFixture(deployRegistryFixture);

    await registry.write.registerOperator([1n, operator.account.address, "Central Garage", [STANDARD]]);

    await viem.assertions.revertWith(
      registry.write.registerOperator([2n, operator.account.address, "Second Garage", [STANDARD]]),
      "OperatorRegistry: wallet already registered",
    );

    await registry.write.registerOperator([1n, stranger.account.address, "New Central Garage", [STANDARD]]);

    assert.equal(await registry.read.operatorIdByWallet([operator.account.address]), 0n);
    assert.equal(await registry.read.operatorIdByWallet([stranger.account.address]), 1n);
    assert.equal((await registry.read.getOperatorWallet([1n])).toLowerCase(), stranger.account.address);
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

  it("rejects invalid registration and unknown operator admin actions", async function () {
    const { registry, operator } = await networkHelpers.loadFixture(deployRegistryFixture);

    await viem.assertions.revertWith(
      registry.write.registerOperator([1n, "0x0000000000000000000000000000000000000000", "Central Garage", [STANDARD]]),
      "OperatorRegistry: zero wallet",
    );

    await viem.assertions.revertWith(
      registry.write.registerOperator([1n, operator.account.address, "", [STANDARD]]),
      "OperatorRegistry: empty name",
    );

    await viem.assertions.revertWith(registry.write.removeOperator([404n]), "OperatorRegistry: unknown operator");
    await viem.assertions.revertWith(
      registry.write.setSupportedCategory([404n, STANDARD, true]),
      "OperatorRegistry: unknown operator",
    );
  });

  it("only lets the operator wallet set price, no-show fee, and capacity", async function () {
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

    await viem.assertions.revertWith(
      registry.write.setCategoryCapacity([1n, STANDARD, 10n], { account: stranger.account }),
      "OperatorRegistry: not operator",
    );

    await registry.write.setPricePerHour([1n, STANDARD, 10n], { account: operator.account });
    await registry.write.setNoShowFee([1n, 3n], { account: operator.account });
    await registry.write.setCategoryCapacity([1n, STANDARD, 10n], { account: operator.account });

    assert.equal(await registry.read.getPricePerHour([1n, STANDARD]), 10n);
    assert.equal(await registry.read.getNoShowFee([1n]), 3n);
    assert.equal(await registry.read.getCategoryCapacity([1n, STANDARD]), 10n);
  });

  it("rejects pricing unsupported categories and removed operators", async function () {
    const { registry, operator } = await networkHelpers.loadFixture(deployRegistryFixture);

    await registry.write.registerOperator([1n, operator.account.address, "Central Garage", [STANDARD]]);

    await viem.assertions.revertWith(
      registry.write.setPricePerHour([1n, EV_CHARGING, 10n], { account: operator.account }),
      "OperatorRegistry: unsupported category",
    );

    await registry.write.removeOperator([1n]);

    await viem.assertions.revertWith(
      registry.write.setPricePerHour([1n, STANDARD, 10n], { account: operator.account }),
      "OperatorRegistry: not whitelisted",
    );

    await viem.assertions.revertWith(
      registry.write.setNoShowFee([1n, 3n], { account: operator.account }),
      "OperatorRegistry: not whitelisted",
    );
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

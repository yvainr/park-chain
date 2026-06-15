import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { networkHelpers, viem } from "./helpers.js";

async function deployCreditFixture() {
  const [owner, minter, burner, member, stranger] = await viem.getWalletClients();
  const credit = await viem.deployContract("ParkCredit");

  return { owner, minter, burner, member, stranger, credit };
}

describe("ParkCredit", function () {
  it("sets owner, token id, and ERC-1155 metadata", async function () {
    const { owner, credit } = await networkHelpers.loadFixture(deployCreditFixture);

    assert.equal((await credit.read.owner()).toLowerCase(), owner.account.address);
    assert.equal(await credit.read.PARK_CREDIT(), 1n);
    assert.equal(await credit.read.uri([1n]), "");
    assert.equal(await credit.read.supportsInterface(["0xd9b67a26"]), true);
    assert.equal(await credit.read.supportsInterface(["0x01ffc9a7"]), true);
  });

  it("lets the owner grant and revoke minter and burner roles", async function () {
    const { credit, minter, burner } = await networkHelpers.loadFixture(deployCreditFixture);

    await credit.write.setMinter([minter.account.address, true]);
    assert.equal(await credit.read.minters([minter.account.address]), true);

    await credit.write.setMinter([minter.account.address, false]);
    assert.equal(await credit.read.minters([minter.account.address]), false);

    await credit.write.setBurner([burner.account.address, true]);
    assert.equal(await credit.read.burners([burner.account.address]), true);

    await credit.write.setBurner([burner.account.address, false]);
    assert.equal(await credit.read.burners([burner.account.address]), false);
  });

  it("rejects non-owner role updates", async function () {
    const { credit, stranger } = await networkHelpers.loadFixture(deployCreditFixture);

    await viem.assertions.revertWithCustomError(
      credit.write.setMinter([stranger.account.address, true], { account: stranger.account }),
      credit,
      "OwnableUnauthorizedAccount",
    );

    await viem.assertions.revertWithCustomError(
      credit.write.setBurner([stranger.account.address, true], { account: stranger.account }),
      credit,
      "OwnableUnauthorizedAccount",
    );
  });

  it("allows only configured minters and burners to mint and burn credits", async function () {
    const { credit, minter, burner, member, stranger } = await networkHelpers.loadFixture(deployCreditFixture);

    await viem.assertions.revertWith(
      credit.write.mint([member.account.address, 100n], { account: stranger.account }),
      "Not authorized to mint",
    );

    await credit.write.setMinter([minter.account.address, true]);
    await credit.write.setBurner([burner.account.address, true]);

    await credit.write.mint([member.account.address, 100n], { account: minter.account });
    assert.equal(await credit.read.balanceOf([member.account.address, 1n]), 100n);

    await viem.assertions.revertWith(
      credit.write.burn([member.account.address, 1n], { account: stranger.account }),
      "Not authorized to burn",
    );

    await credit.write.burn([member.account.address, 40n], { account: burner.account });
    assert.equal(await credit.read.balanceOf([member.account.address, 1n]), 60n);
  });
});

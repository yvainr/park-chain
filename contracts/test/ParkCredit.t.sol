// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

import {ParkCredit} from "../src/ParkCredit.sol";

interface ParkCreditVm {
    function prank(address msgSender) external;
    function expectRevert(bytes calldata revertData) external;
}

contract ParkCreditHarness is ParkCredit {
    function onlyMinterProbe() external view onlyMinter returns (bool) {
        return true;
    }

    function onlyBurnerProbe() external view onlyBurner returns (bool) {
        return true;
    }

    function mintForTest(address to, uint256 amount) external onlyMinter {
        _mint(to, PARK_CREDIT, amount, "");
    }

    function burnForTest(address from, uint256 amount) external onlyBurner {
        _burn(from, PARK_CREDIT, amount);
    }
}

contract ParkCreditTest {
    ParkCreditVm private constant vm = ParkCreditVm(address(uint160(uint256(keccak256("hevm cheat code")))));

    ParkCreditHarness private credit;

    address private owner = address(this);
    address private minter = address(0x1001);
    address private burner = address(0x2002);
    address private member = address(0x3003);
    address private stranger = address(0x4004);

    function setUp() public {
        credit = new ParkCreditHarness();
    }

    function testConstructorSetsOwnerAndErc1155Uri() public view {
        require(credit.owner() == owner, "owner mismatch");
        require(keccak256(bytes(credit.uri(credit.PARK_CREDIT()))) == keccak256(bytes("")), "uri mismatch");
    }

    function testOwnerCanGrantAndRevokeMinterRole() public {
        credit.setMinter(minter, true);
        require(credit.minters(minter), "minter should be enabled");

        credit.setMinter(minter, false);
        require(!credit.minters(minter), "minter should be disabled");
    }

    function testOwnerCanGrantAndRevokeBurnerRole() public {
        credit.setBurner(burner, true);
        require(credit.burners(burner), "burner should be enabled");

        credit.setBurner(burner, false);
        require(!credit.burners(burner), "burner should be disabled");
    }

    function testNonOwnerCannotUpdateRoles() public {
        vm.prank(stranger);
        vm.expectRevert(abi.encodeWithSignature("OwnableUnauthorizedAccount(address)", stranger));
        credit.setMinter(stranger, true);

        vm.prank(stranger);
        vm.expectRevert(abi.encodeWithSignature("OwnableUnauthorizedAccount(address)", stranger));
        credit.setBurner(stranger, true);
    }

    function testMinterModifierAllowsOnlyConfiguredMinter() public {
        credit.setMinter(minter, true);

        vm.prank(minter);
        require(credit.onlyMinterProbe(), "minter probe should pass");

        vm.prank(stranger);
        vm.expectRevert(bytes("Not authorized to mint"));
        credit.onlyMinterProbe();
    }

    function testBurnerModifierAllowsOnlyConfiguredBurner() public {
        credit.setBurner(burner, true);

        vm.prank(burner);
        require(credit.onlyBurnerProbe(), "burner probe should pass");

        vm.prank(stranger);
        vm.expectRevert(bytes("Not authorized to burn"));
        credit.onlyBurnerProbe();
    }

    function testHarnessCanMintAndBurnParkCreditsThroughConfiguredRoles() public {
        credit.setMinter(minter, true);
        credit.setBurner(burner, true);

        vm.prank(minter);
        credit.mintForTest(member, 100);

        require(credit.balanceOf(member, credit.PARK_CREDIT()) == 100, "minted balance mismatch");

        vm.prank(burner);
        credit.burnForTest(member, 40);

        require(credit.balanceOf(member, credit.PARK_CREDIT()) == 60, "burned balance mismatch");
    }

    function testUnconfiguredRolesCannotMintOrBurnInHarness() public {
        vm.prank(stranger);
        vm.expectRevert(bytes("Not authorized to mint"));
        credit.mintForTest(member, 100);

        credit.setMinter(minter, true);
        vm.prank(minter);
        credit.mintForTest(member, 100);

        vm.prank(stranger);
        vm.expectRevert(bytes("Not authorized to burn"));
        credit.burnForTest(member, 1);
    }

    function testErc1155SupportsInterface() public view {
        require(credit.supportsInterface(0xd9b67a26), "ERC1155 interface unsupported");
        require(credit.supportsInterface(0x01ffc9a7), "ERC165 interface unsupported");
    }
}

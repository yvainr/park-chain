// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

import {OperatorRegistry} from "../src/OperatorRegistry.sol";

interface RegistryVm {
    function prank(address msgSender) external;
    function expectRevert(bytes calldata revertData) external;
}

contract OperatorRegistryTest {
    RegistryVm private constant vm = RegistryVm(address(uint160(uint256(keccak256("hevm cheat code")))));

    OperatorRegistry private registry;

    address private operatorWallet = address(0x1001);
    address private stranger = address(0x2002);
    bytes32 private constant STANDARD = keccak256("standard");
    bytes32 private constant EV_CHARGING = keccak256("ev-charging");
    bytes32 private constant FAMILY_SLOT = keccak256("family");
    bytes32 private constant WOMEN_SLOT = keccak256("women");

    function setUp() public {
        registry = new OperatorRegistry();
    }

    function testAdminCanRegisterAndRemoveOperator() public {
        bytes32[] memory categories = new bytes32[](4);
        categories[0] = STANDARD;
        categories[1] = EV_CHARGING;
        categories[2] = FAMILY_SLOT;
        categories[3] = WOMEN_SLOT;

        registry.registerOperator(1, operatorWallet, "Central Garage", categories);

        require(registry.isWhitelisted(1), "operator should be whitelisted");
        require(registry.supportsCategory(1, STANDARD), "standard should be supported");
        require(registry.supportsCategory(1, EV_CHARGING), "ev should be supported");
        require(registry.supportsCategory(1, FAMILY_SLOT), "family slot should be supported");
        require(registry.supportsCategory(1, WOMEN_SLOT), "women slot should be supported");
        require(registry.getOperatorWallet(1) == operatorWallet, "wallet mismatch");

        registry.removeOperator(1);

        require(!registry.isWhitelisted(1), "operator should be removed");
    }

    function testNonAdminCannotRegisterOrRemoveOperator() public {
        bytes32[] memory categories = new bytes32[](1);
        categories[0] = STANDARD;

        vm.prank(stranger);
        vm.expectRevert(bytes("OperatorRegistry: not owner"));
        registry.registerOperator(1, operatorWallet, "Central Garage", categories);

        registry.registerOperator(1, operatorWallet, "Central Garage", categories);

        vm.prank(stranger);
        vm.expectRevert(bytes("OperatorRegistry: not owner"));
        registry.removeOperator(1);
    }

    function testRegisterRejectsZeroWalletAndEmptyName() public {
        bytes32[] memory categories = new bytes32[](1);
        categories[0] = STANDARD;

        vm.expectRevert(bytes("OperatorRegistry: zero wallet"));
        registry.registerOperator(1, address(0), "Central Garage", categories);

        vm.expectRevert(bytes("OperatorRegistry: empty name"));
        registry.registerOperator(1, operatorWallet, "", categories);
    }

    function testRemoveAndCategoryUpdateRejectUnknownOperator() public {
        vm.expectRevert(bytes("OperatorRegistry: unknown operator"));
        registry.removeOperator(404);

        vm.expectRevert(bytes("OperatorRegistry: unknown operator"));
        registry.setSupportedCategory(404, STANDARD, true);
    }

    function testOnlyOperatorWalletCanSetPriceAndNoShowFee() public {
        bytes32[] memory categories = new bytes32[](1);
        categories[0] = STANDARD;
        registry.registerOperator(1, operatorWallet, "Central Garage", categories);

        vm.prank(stranger);
        vm.expectRevert(bytes("OperatorRegistry: not operator wallet"));
        registry.setPricePerHour(1, STANDARD, 10);

        vm.prank(stranger);
        vm.expectRevert(bytes("OperatorRegistry: not operator wallet"));
        registry.setNoShowFee(1, 3);

        vm.prank(operatorWallet);
        registry.setPricePerHour(1, STANDARD, 10);

        vm.prank(operatorWallet);
        registry.setNoShowFee(1, 3);

        require(registry.getPricePerHour(1, STANDARD) == 10, "price mismatch");
        require(registry.getNoShowFee(1) == 3, "no-show fee mismatch");
    }

    function testOperatorCannotSetPriceForUnsupportedCategory() public {
        bytes32[] memory categories = new bytes32[](1);
        categories[0] = STANDARD;
        registry.registerOperator(1, operatorWallet, "Central Garage", categories);

        vm.prank(operatorWallet);
        vm.expectRevert(bytes("OperatorRegistry: unsupported category"));
        registry.setPricePerHour(1, EV_CHARGING, 10);
    }

    function testRemovedOperatorCannotSetPriceOrNoShowFee() public {
        bytes32[] memory categories = new bytes32[](1);
        categories[0] = STANDARD;
        registry.registerOperator(1, operatorWallet, "Central Garage", categories);
        registry.removeOperator(1);

        vm.prank(operatorWallet);
        vm.expectRevert(bytes("OperatorRegistry: not whitelisted"));
        registry.setPricePerHour(1, STANDARD, 10);

        vm.prank(operatorWallet);
        vm.expectRevert(bytes("OperatorRegistry: not whitelisted"));
        registry.setNoShowFee(1, 3);
    }

    function testAdminCanUpdateSupportedCategory() public {
        bytes32[] memory categories = new bytes32[](1);
        categories[0] = STANDARD;
        registry.registerOperator(1, operatorWallet, "Central Garage", categories);

        require(!registry.supportsCategory(1, EV_CHARGING), "ev should start unsupported");

        registry.setSupportedCategory(1, EV_CHARGING, true);
        require(registry.supportsCategory(1, EV_CHARGING), "ev should be enabled");

        registry.setSupportedCategory(1, STANDARD, false);
        require(!registry.supportsCategory(1, STANDARD), "standard should be disabled");
    }

    function testFamilyAndWomenSlotCategoriesCanBePriced() public {
        require(registry.FAMILY_SLOT_CATEGORY() == FAMILY_SLOT, "family constant mismatch");
        require(registry.WOMEN_SLOT_CATEGORY() == WOMEN_SLOT, "women constant mismatch");

        bytes32[] memory categories = new bytes32[](2);
        categories[0] = FAMILY_SLOT;
        categories[1] = WOMEN_SLOT;

        registry.registerOperator(1, operatorWallet, "Central Garage", categories);

        vm.prank(operatorWallet);
        registry.setPricePerHour(1, FAMILY_SLOT, 12);

        vm.prank(operatorWallet);
        registry.setPricePerHour(1, WOMEN_SLOT, 9);

        require(registry.supportsCategory(1, FAMILY_SLOT), "family slot should be supported");
        require(registry.supportsCategory(1, WOMEN_SLOT), "women slot should be supported");
        require(registry.getPricePerHour(1, FAMILY_SLOT) == 12, "family slot price mismatch");
        require(registry.getPricePerHour(1, WOMEN_SLOT) == 9, "women slot price mismatch");
    }
}

// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

import {OperatorRegistry} from "../src/OperatorRegistry.sol";

interface RegistryVm {
    function prank(address msgSender) external;
}

contract OperatorRegistryTest {
    RegistryVm private constant vm = RegistryVm(address(uint160(uint256(keccak256("hevm cheat code")))));

    OperatorRegistry private registry;

    address private operatorWallet = address(0x1001);
    address private stranger = address(0x2002);
    bytes32 private constant STANDARD = keccak256("standard");
    bytes32 private constant EV_CHARGING = keccak256("ev-charging");

    function setUp() public {
        registry = new OperatorRegistry();
    }

    function testAdminCanRegisterAndRemoveOperator() public {
        bytes32[] memory categories = new bytes32[](2);
        categories[0] = STANDARD;
        categories[1] = EV_CHARGING;

        registry.registerOperator(1, operatorWallet, "Central Garage", categories);

        require(registry.isWhitelisted(1), "operator should be whitelisted");
        require(registry.supportsCategory(1, STANDARD), "standard should be supported");
        require(registry.supportsCategory(1, EV_CHARGING), "ev should be supported");
        require(registry.getOperatorWallet(1) == operatorWallet, "wallet mismatch");

        registry.removeOperator(1);

        require(!registry.isWhitelisted(1), "operator should be removed");
    }

    function testNonAdminCannotRegisterOrRemoveOperator() public {
        bytes32[] memory categories = new bytes32[](1);
        categories[0] = STANDARD;

        vm.prank(stranger);
        try registry.registerOperator(1, operatorWallet, "Central Garage", categories) {
            revert("non-admin register should revert");
        } catch {}

        registry.registerOperator(1, operatorWallet, "Central Garage", categories);

        vm.prank(stranger);
        try registry.removeOperator(1) {
            revert("non-admin remove should revert");
        } catch {}
    }

    function testOnlyOperatorWalletCanSetPriceAndNoShowFee() public {
        bytes32[] memory categories = new bytes32[](1);
        categories[0] = STANDARD;
        registry.registerOperator(1, operatorWallet, "Central Garage", categories);

        vm.prank(stranger);
        try registry.setPricePerHour(1, STANDARD, 10) {
            revert("stranger price update should revert");
        } catch {}

        vm.prank(stranger);
        try registry.setNoShowFee(1, 3) {
            revert("stranger no-show update should revert");
        } catch {}

        vm.prank(operatorWallet);
        registry.setPricePerHour(1, STANDARD, 10);

        vm.prank(operatorWallet);
        registry.setNoShowFee(1, 3);

        require(registry.getPricePerHour(1, STANDARD) == 10, "price mismatch");
        require(registry.getNoShowFee(1) == 3, "no-show fee mismatch");
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
}

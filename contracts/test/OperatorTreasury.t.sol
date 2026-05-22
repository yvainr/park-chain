// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

import {OperatorRegistry} from "../src/OperatorRegistry.sol";
import {IOperatorRegistry, OperatorTreasury} from "../src/OperatorTreasury.sol";

interface TreasuryVm {
    function deal(address account, uint256 newBalance) external;
    function prank(address msgSender) external;
}

contract OperatorTreasuryTest {
    TreasuryVm private constant vm = TreasuryVm(address(uint160(uint256(keccak256("hevm cheat code")))));

    OperatorRegistry private registry;
    OperatorTreasury private treasury;

    address private operatorWallet = address(0x1001);
    address private allocator = address(0x2002);
    address private stranger = address(0x3003);
    bytes32 private constant STANDARD = keccak256("standard");

    receive() external payable {}

    function setUp() public {
        registry = new OperatorRegistry();
        treasury = new OperatorTreasury(IOperatorRegistry(address(registry)), 0.01 ether);

        bytes32[] memory categories = new bytes32[](1);
        categories[0] = STANDARD;
        registry.registerOperator(1, operatorWallet, "Central Garage", categories);
    }

    function testOwnerUpdatesRateAndAllocator() public {
        treasury.setCreditToEthRate(0.02 ether);
        treasury.setAllocator(allocator);

        require(treasury.getCreditToEthRate() == 0.02 ether, "rate mismatch");
        require(treasury.allocator() == allocator, "allocator mismatch");
    }

    function testNonOwnerCannotUpdateAdminSettings() public {
        vm.prank(stranger);
        try treasury.setCreditToEthRate(0.02 ether) {
            revert("non-owner rate update should revert");
        } catch {}

        vm.prank(stranger);
        try treasury.setAllocator(allocator) {
            revert("non-owner allocator update should revert");
        } catch {}
    }

    function testAllocatorCanAllocateEarnings() public {
        treasury.setAllocator(allocator);

        vm.prank(allocator);
        treasury.allocateEarnings(1, 42);

        require(treasury.getAccumulatedEarnings(1) == 42, "earnings mismatch");
    }

    function testNonAllocatorCannotAllocateEarnings() public {
        treasury.setAllocator(allocator);

        vm.prank(stranger);
        try treasury.allocateEarnings(1, 42) {
            revert("non-allocator allocation should revert");
        } catch {}
    }

    function testOperatorCanWithdrawAndExchangeRateIsApplied() public {
        treasury.setAllocator(allocator);
        vm.prank(allocator);
        treasury.allocateEarnings(1, 50);

        vm.deal(address(treasury), 1 ether);
        uint256 balanceBefore = operatorWallet.balance;

        vm.prank(operatorWallet);
        treasury.withdraw(1);

        require(operatorWallet.balance == balanceBefore + 0.5 ether, "withdraw amount mismatch");
        require(treasury.getAccumulatedEarnings(1) == 0, "earnings should clear");
    }

    function testNonOperatorCannotWithdrawOperatorEarnings() public {
        treasury.allocateEarnings(1, 50);
        vm.deal(address(treasury), 1 ether);

        vm.prank(stranger);
        try treasury.withdraw(1) {
            revert("non-operator withdraw should revert");
        } catch {}
    }

    function testWithdrawRevertsWhenLiquidityIsInsufficient() public {
        treasury.allocateEarnings(1, 50);

        vm.prank(operatorWallet);
        try treasury.withdraw(1) {
            revert("illiquid withdraw should revert");
        } catch {}

        require(treasury.getAccumulatedEarnings(1) == 50, "earnings should remain");
    }
}

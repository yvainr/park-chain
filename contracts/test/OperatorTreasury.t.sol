// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

import {OperatorRegistry} from "../src/OperatorRegistry.sol";
import {IOperatorRegistry, OperatorTreasury} from "../src/OperatorTreasury.sol";

interface TreasuryVm {
    function deal(address account, uint256 newBalance) external;
    function prank(address msgSender) external;
    function expectRevert(bytes calldata revertData) external;
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
        vm.expectRevert(bytes("OperatorTreasury: not owner"));
        treasury.setCreditToEthRate(0.02 ether);

        vm.prank(stranger);
        vm.expectRevert(bytes("OperatorTreasury: not owner"));
        treasury.setAllocator(allocator);
    }

    function testConstructorAndAllocatorRejectZeroAddresses() public {
        vm.expectRevert(bytes("OperatorTreasury: zero registry"));
        new OperatorTreasury(IOperatorRegistry(address(0)), 0.01 ether);

        vm.expectRevert(bytes("OperatorTreasury: zero allocator"));
        treasury.setAllocator(address(0));
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
        vm.expectRevert(bytes("OperatorTreasury: not allocator"));
        treasury.allocateEarnings(1, 42);
    }

    function testAllocateRejectsZeroAmountAndUnknownOperator() public {
        vm.expectRevert(bytes("OperatorTreasury: zero amount"));
        treasury.allocateEarnings(1, 0);

        vm.expectRevert(bytes("OperatorTreasury: unknown operator"));
        treasury.allocateEarnings(404, 42);
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
        vm.expectRevert(bytes("OperatorTreasury: not operator wallet"));
        treasury.withdraw(1);
    }

    function testWithdrawRevertsWhenOperatorUnknownOrNoEarningsOrRateZero() public {
        vm.prank(stranger);
        vm.expectRevert(bytes("OperatorTreasury: unknown operator"));
        treasury.withdraw(404);

        vm.prank(operatorWallet);
        vm.expectRevert(bytes("OperatorTreasury: no earnings"));
        treasury.withdraw(1);

        treasury.allocateEarnings(1, 50);
        treasury.setCreditToEthRate(0);

        vm.prank(operatorWallet);
        vm.expectRevert(bytes("OperatorTreasury: zero exchange rate"));
        treasury.withdraw(1);
    }

    function testWithdrawRevertsWhenLiquidityIsInsufficient() public {
        treasury.allocateEarnings(1, 50);

        vm.prank(operatorWallet);
        vm.expectRevert(bytes("OperatorTreasury: insufficient liquidity"));
        treasury.withdraw(1);

        require(treasury.getAccumulatedEarnings(1) == 50, "earnings should remain");
    }

    function testTreasuryCanReceiveEth() public {
        uint256 balanceBefore = address(treasury).balance;
        vm.deal(address(this), 1 ether);

        (bool sent, ) = address(treasury).call{value: 0.25 ether}("");

        require(sent, "funding should succeed");
        require(address(treasury).balance == balanceBefore + 0.25 ether, "treasury balance mismatch");
    }
}

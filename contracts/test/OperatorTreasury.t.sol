// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

import {OperatorTreasury} from "../src/OperatorTreasury.sol";

interface Vm {
    function prank(address msgSender) external;

    function deal(address account, uint256 newBalance) external;

    function expectRevert(bytes4 revertData) external;
}

contract MockOperatorRegistry {
    mapping(uint256 => address) private operatorWallets;

    function setOperatorWallet(uint256 operatorId, address wallet) external {
        operatorWallets[operatorId] = wallet;
    }

    function getOperatorWallet(uint256 operatorId) external view returns (address) {
        return operatorWallets[operatorId];
    }
}

contract OperatorTreasuryTest {
    address private constant HEVM_ADDRESS = address(uint160(uint256(keccak256("hevm cheat code"))));
    Vm private constant vm = Vm(HEVM_ADDRESS);

    function testOwnerCanConfigureTreasury() public {
        OperatorTreasury treasury = new OperatorTreasury(address(this));
        MockOperatorRegistry registry = new MockOperatorRegistry();

        treasury.setParkingLedger(address(0xBEEF));
        treasury.setOperatorRegistry(address(registry));
        treasury.setCreditToEthRate(2 ether);

        require(treasury.parkingLedger() == address(0xBEEF), "parking ledger not set");
        require(treasury.operatorRegistry() == address(registry), "registry not set");
        require(treasury.getCreditToEthRate() == 2 ether, "rate not set");
    }

    function testNonOwnerCannotConfigureTreasury() public {
        OperatorTreasury treasury = new OperatorTreasury(address(this));

        vm.expectRevert(OperatorTreasury.OwnableUnauthorizedAccount.selector);
        vm.prank(address(0xCAFE));
        treasury.setCreditToEthRate(1 ether);
    }

    function testOnlyParkingLedgerCanAllocateEarnings() public {
        OperatorTreasury treasury = new OperatorTreasury(address(this));

        treasury.setParkingLedger(address(0xBEEF));

        vm.expectRevert(OperatorTreasury.NotParkingLedger.selector);
        treasury.allocateEarnings(1, 10);

        vm.prank(address(0xBEEF));
        treasury.allocateEarnings(1, 10);

        require(treasury.getAccumulatedEarnings(1) == 10, "earnings not allocated");
    }

    function testOperatorCanWithdrawAccumulatedEarnings() public {
        OperatorTreasury treasury = new OperatorTreasury(address(this));
        MockOperatorRegistry registry = new MockOperatorRegistry();
        address operatorWallet = address(0xB0B);

        treasury.setParkingLedger(address(0xBEEF));
        treasury.setOperatorRegistry(address(registry));
        treasury.setCreditToEthRate(2 ether);
        registry.setOperatorWallet(1, operatorWallet);

        vm.prank(address(0xBEEF));
        treasury.allocateEarnings(1, 3);

        vm.deal(address(treasury), 6 ether);

        uint256 balanceBefore = operatorWallet.balance;
        vm.prank(operatorWallet);
        treasury.withdraw(1);

        require(operatorWallet.balance == balanceBefore + 6 ether, "withdrawal amount mismatch");
        require(treasury.getAccumulatedEarnings(1) == 0, "earnings not cleared");
    }

    function testNonOperatorCannotWithdraw() public {
        OperatorTreasury treasury = new OperatorTreasury(address(this));
        MockOperatorRegistry registry = new MockOperatorRegistry();

        treasury.setOperatorRegistry(address(registry));
        treasury.setCreditToEthRate(1 ether);
        registry.setOperatorWallet(1, address(0xB0B));

        vm.expectRevert(OperatorTreasury.NotOperatorWallet.selector);
        vm.prank(address(0xCAFE));
        treasury.withdraw(1);
    }

    function testWithdrawalFailsWhenTreasuryIsIlliquid() public {
        OperatorTreasury treasury = new OperatorTreasury(address(this));
        MockOperatorRegistry registry = new MockOperatorRegistry();
        address operatorWallet = address(0xB0B);

        treasury.setOperatorRegistry(address(registry));
        treasury.setParkingLedger(address(0xBEEF));
        treasury.setCreditToEthRate(1 ether);
        registry.setOperatorWallet(1, operatorWallet);

        vm.prank(address(0xBEEF));
        treasury.allocateEarnings(1, 2);

        vm.expectRevert(OperatorTreasury.InsufficientLiquidity.selector);
        vm.prank(operatorWallet);
        treasury.withdraw(1);
    }
}


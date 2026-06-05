// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

import {MembershipManager, IMembershipParkCredit} from "../src/MembershipManager.sol";
import {OperatorRegistry} from "../src/OperatorRegistry.sol";
import {IOperatorRegistry, OperatorTreasury} from "../src/OperatorTreasury.sol";
import {ParkCredit} from "../src/ParkCredit.sol";
import {
    IParkingMembershipManager,
    IParkingOperatorRegistry,
    IParkingOperatorTreasury,
    IParkingParkCredit,
    ParkingLedger
} from "../src/ParkingLedger.sol";

interface GasUsageVm {
    function deal(address account, uint256 newBalance) external;
    function prank(address msgSender) external;
    function warp(uint256 newTimestamp) external;
}

contract GasUsageTableTest {
    GasUsageVm private constant vm = GasUsageVm(address(uint160(uint256(keccak256("hevm cheat code")))));

    ParkCredit private credit;
    MembershipManager private membership;
    OperatorRegistry private registry;
    OperatorTreasury private treasury;
    ParkingLedger private ledger;

    address private member = address(0xA11CE);
    address private operatorWallet = address(0xB0B);

    uint256 private constant URBAN = 1;
    uint256 private constant OPERATOR_ID = 77;
    bytes32 private constant STANDARD = keccak256("standard");

    event GasTableRow(
        string contractName,
        string action,
        uint256 gasUsed,
        uint256 costWeiAtOneGwei,
        uint256 costWeiAtTenGwei,
        uint256 costWeiAtThirtyGwei,
        uint256 deployCostWei
    );

    function setUp() public {
        vm.warp(1_700_000_000);
        vm.deal(member, 10 ether);
        vm.deal(operatorWallet, 1 ether);

        credit = new ParkCredit();
        membership = new MembershipManager(IMembershipParkCredit(address(credit)));
        registry = new OperatorRegistry();
        treasury = new OperatorTreasury(IOperatorRegistry(address(registry)), 0.001 ether);
        ledger = new ParkingLedger(
            IParkingMembershipManager(address(membership)),
            IParkingOperatorRegistry(address(registry)),
            IParkingParkCredit(address(credit)),
            IParkingOperatorTreasury(address(treasury))
        );

        credit.setMinter(address(membership), true);
        credit.setBurner(address(ledger), true);

        membership.setTier(URBAN, "Urban", 100, 0.01 ether, 20, true);
        ledger.setGracePeriod(15);
        treasury.setAllocator(address(ledger));

        bytes32[] memory categories = new bytes32[](1);
        categories[0] = STANDARD;
        registry.registerOperator(OPERATOR_ID, operatorWallet, "Central Garage", categories);

        vm.prank(operatorWallet);
        registry.setPricePerHour(OPERATOR_ID, STANDARD, 10);
    }

    function testGasUsageTableForCoreActions() public {
        uint256 purchaseGas = _measurePurchaseMembership();
        _emitGasRow("MembershipManager", "purchaseMembership", purchaseGas, 0);
        require(purchaseGas < 125_000, "purchaseMembership gas regression");

        uint256 reserveGas = _measureReserve();
        _emitGasRow("ParkingLedger", "reserve", reserveGas, 0);
        require(reserveGas < 370_000, "reserve gas regression");

        uint256 checkInGas = _measureCheckIn();
        _emitGasRow("ParkingLedger", "checkIn", checkInGas, 0);
        require(checkInGas < 100_000, "checkIn gas regression");

        uint256 allocateGas = _measureAllocateEarnings();
        _emitGasRow("OperatorTreasury", "allocateEarnings", allocateGas, 0);
        require(allocateGas < 60_000, "allocateEarnings gas regression");

        uint256 withdrawGas = _measureWithdraw();
        _emitGasRow("OperatorTreasury", "withdraw", withdrawGas, 0);
        
        // Measure deploy gas for core contracts and emit rows with deploy cost at 30 gwei
        uint256 d1 = _measureDeployParkCredit();
        _emitGasRow("ParkCredit", "deploy", d1, d1 * 30 gwei);

        uint256 d2 = _measureDeployMembership();
        _emitGasRow("MembershipManager", "deploy", d2, d2 * 30 gwei);

        uint256 d3 = _measureDeployOperatorRegistry();
        _emitGasRow("OperatorRegistry", "deploy", d3, d3 * 30 gwei);

        uint256 d4 = _measureDeployOperatorTreasury();
        _emitGasRow("OperatorTreasury", "deploy", d4, d4 * 30 gwei);

        uint256 d5 = _measureDeployParkingLedger();
        _emitGasRow("ParkingLedger", "deploy", d5, d5 * 30 gwei);
        require(withdrawGas < 65_000, "withdraw gas regression");
    }

    function _measurePurchaseMembership() private returns (uint256 gasUsed) {
        uint256 gasBefore = gasleft();

        vm.prank(member);
        membership.purchaseMembership{value: 0.01 ether}(URBAN);

        gasUsed = gasBefore - gasleft();
    }

    function _measureReserve() private returns (uint256 gasUsed) {
        uint256 startTime = block.timestamp + 1 hours;
        uint256 gasBefore = gasleft();

        vm.prank(member);
        ledger.reserve(OPERATOR_ID, STANDARD, startTime, 2);

        gasUsed = gasBefore - gasleft();
    }

    function _measureCheckIn() private returns (uint256 gasUsed) {
        uint256 reservationId = ledger.nextReservationID();
        uint256 startTime = block.timestamp + 4 hours;

        vm.prank(member);
        ledger.reserve(OPERATOR_ID, STANDARD, startTime, 2);

        vm.warp(startTime);
        uint256 gasBefore = gasleft();

        vm.prank(member);
        ledger.checkIn(reservationId);

        gasUsed = gasBefore - gasleft();
    }

    function _measureAllocateEarnings() private returns (uint256 gasUsed) {
        uint256 gasBefore = gasleft();

        vm.prank(address(ledger));
        treasury.allocateEarnings(OPERATOR_ID, 20);

        gasUsed = gasBefore - gasleft();
    }

    function _measureWithdraw() private returns (uint256 gasUsed) {
        vm.prank(address(ledger));
        treasury.allocateEarnings(OPERATOR_ID, 20);
        vm.deal(address(treasury), 1 ether);

        uint256 gasBefore = gasleft();

        vm.prank(operatorWallet);
        treasury.withdraw(OPERATOR_ID);

        gasUsed = gasBefore - gasleft();
    }

    function _emitGasRow(string memory contractName, string memory action, uint256 gasUsed, uint256 deployCostWei) private {
        emit GasTableRow(
            contractName,
            action,
            gasUsed,
            gasUsed * 1 gwei,
            gasUsed * 10 gwei,
            gasUsed * 30 gwei,
            deployCostWei
        );
    }

    function _measureDeployParkCredit() private returns (uint256 gasUsed) {
        uint256 gasBefore = gasleft();
        ParkCredit tmp = new ParkCredit();
        gasUsed = gasBefore - gasleft();
    }

    function _measureDeployMembership() private returns (uint256 gasUsed) {
        uint256 gasBefore = gasleft();
        MembershipManager tmp = new MembershipManager(IMembershipParkCredit(address(credit)));
        gasUsed = gasBefore - gasleft();
    }

    function _measureDeployOperatorRegistry() private returns (uint256 gasUsed) {
        uint256 gasBefore = gasleft();
        OperatorRegistry tmp = new OperatorRegistry();
        gasUsed = gasBefore - gasleft();
    }

    function _measureDeployOperatorTreasury() private returns (uint256 gasUsed) {
        uint256 gasBefore = gasleft();
        OperatorTreasury tmp = new OperatorTreasury(IOperatorRegistry(address(registry)), 0.001 ether);
        gasUsed = gasBefore - gasleft();
    }

    function _measureDeployParkingLedger() private returns (uint256 gasUsed) {
        uint256 gasBefore = gasleft();
        ParkingLedger tmp = new ParkingLedger(
            IParkingMembershipManager(address(membership)),
            IParkingOperatorRegistry(address(registry)),
            IParkingParkCredit(address(credit)),
            IParkingOperatorTreasury(address(treasury))
        );
        gasUsed = gasBefore - gasleft();
    }
}

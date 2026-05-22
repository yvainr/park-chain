// SPDX-License-Identifier: MIT
pragma solidity ^0.8.28;

import {Test, console} from "forge-std/Test.sol";
import {ParkCredit} from "../contracts/ParkCredit.sol";

contract ParkCreditTest is Test {
    ParkCredit public parkCredit;

    address public owner;
    address public member = makeAddr("member");
    address public manager = makeAddr("manager");
    address public attacker = makeAddr("attacker");

    uint256 constant TOKEN_ID = 1; 

    function setUp() external {
        owner = msg.sender;
        vm.prank(owner);
        parkCredit = new ParkCredit();
    }

    // SUCCESS CASES (Erfolgsfälle)

    function testShouldSetOwnerCorrectly() external view {
        assertEq(parkCredit.owner(), owner);
    }

    function testShouldAllowOwnerToSetMinter() external {
        vm.prank(owner);
        parkCredit.setMinter(manager, true);
        assertEq(parkCredit.minters(manager), true);
    }

    function testShouldAllowOwnerToSetBurner() external {
        vm.prank(owner);
        parkCredit.setBurner(manager, true);
        assertEq(parkCredit.burners(manager), true);
    }


    // ERROR CASES (Fehlerschlag-Tests)

    function testShouldRevertIfNonOwnerSetsMinter() external {
        vm.prank(attacker);
        vm.expectRevert();
        parkCredit.setMinter(attacker, true);
    }

    function testShouldRevertIfNonOwnerSetsBurner() external {
        vm.prank(attacker);
        vm.expectRevert();
        parkCredit.setBurner(attacker, true);
    }
}
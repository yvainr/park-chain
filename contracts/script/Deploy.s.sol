// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

import {OperatorRegistry} from "../src/OperatorRegistry.sol";
import {IOperatorRegistry, OperatorTreasury} from "../src/OperatorTreasury.sol";

interface DeployVm {
    function startBroadcast() external;
    function stopBroadcast() external;
}

contract Deploy {
    DeployVm private constant vm = DeployVm(address(uint160(uint256(keccak256("hevm cheat code")))));

    function run() external returns (OperatorRegistry registry, OperatorTreasury treasury) {
        vm.startBroadcast();
        registry = new OperatorRegistry();
        treasury = new OperatorTreasury(IOperatorRegistry(address(registry)), 0.001 ether);
        vm.stopBroadcast();
    }
}

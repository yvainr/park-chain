// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

import "@openzeppelin/contracts/access/Ownable.sol";

contract ParkChainRouter is Ownable {
    bytes32 public constant PARK_CREDIT = keccak256("ParkCredit");
    bytes32 public constant MEMBERSHIP_MANAGER = keccak256("MembershipManager");
    bytes32 public constant OPERATOR_REGISTRY = keccak256("OperatorRegistry");
    bytes32 public constant OPERATOR_TREASURY = keccak256("OperatorTreasury");
    bytes32 public constant PARKING_LEDGER = keccak256("ParkingLedger");

    mapping(bytes32 => address) private contractAddresses;

    event ContractAddressUpdated(bytes32 indexed key, address indexed contractAddress);

    constructor() Ownable(msg.sender) {}

    function setContract(bytes32 key, address contractAddress) external onlyOwner {
        _setContract(key, contractAddress);
    }

    function setContracts(bytes32[] calldata keys, address[] calldata addresses_) external onlyOwner {
        require(keys.length == addresses_.length, "ParkChainRouter: length mismatch");

        for (uint256 i = 0; i < keys.length; i++) {
            _setContract(keys[i], addresses_[i]);
        }
    }

    function getContract(bytes32 key) external view returns (address) {
        return contractAddresses[key];
    }

    function requireContract(bytes32 key) external view returns (address) {
        address contractAddress = contractAddresses[key];
        require(contractAddress != address(0), "ParkChainRouter: contract not set");
        return contractAddress;
    }

    function _setContract(bytes32 key, address contractAddress) private {
        require(key != bytes32(0), "ParkChainRouter: zero key");
        require(contractAddress != address(0), "ParkChainRouter: zero address");

        contractAddresses[key] = contractAddress;
        emit ContractAddressUpdated(key, contractAddress);
    }
}

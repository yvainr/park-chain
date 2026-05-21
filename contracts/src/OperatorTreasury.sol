// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

interface IOperatorRegistry {
    function getOperatorWallet(uint256 operatorId) external view returns (address);
}

contract OperatorTreasury {
    event EarningsAllocated(uint256 indexed operatorId, uint256 amountCredits);
    event EarningsWithdrawn(
        uint256 indexed operatorId,
        address indexed operatorWallet,
        uint256 amountCredits,
        uint256 amountWei
    );
    event CreditToEthRateUpdated(uint256 weiPerCredit);
    event ParkingLedgerUpdated(address indexed parkingLedger);
    event OperatorRegistryUpdated(address indexed operatorRegistry);

    error OwnableUnauthorizedAccount(address account);
    error ZeroAddressNotAllowed();
    error InvalidExchangeRate();
    error NotParkingLedger(address caller);
    error OperatorRegistryNotSet();
    error NoEarnings(uint256 operatorId);
    error NotOperatorWallet(uint256 operatorId, address caller);
    error InsufficientLiquidity(uint256 requiredWei, uint256 availableWei);
    error WithdrawalTransferFailed(address operatorWallet);

    address public owner;
    address public parkingLedger;
    address public operatorRegistry;

    uint256 private creditToEthRate;

    mapping(uint256 => uint256) private accumulatedEarnings;

    modifier onlyOwner() {
        if (msg.sender != owner) {
            revert OwnableUnauthorizedAccount(msg.sender);
        }
        _;
    }

    modifier onlyParkingLedger() {
        if (msg.sender != parkingLedger) {
            revert NotParkingLedger(msg.sender);
        }
        _;
    }

    constructor(address initialOwner) {
        if (initialOwner == address(0)) {
            revert ZeroAddressNotAllowed();
        }
        owner = initialOwner;
    }

    receive() external payable {}

    function setParkingLedger(address parkingLedger_) external onlyOwner {
        if (parkingLedger_ == address(0)) {
            revert ZeroAddressNotAllowed();
        }
        parkingLedger = parkingLedger_;
        emit ParkingLedgerUpdated(parkingLedger_);
    }

    function setOperatorRegistry(address operatorRegistry_) external onlyOwner {
        if (operatorRegistry_ == address(0)) {
            revert ZeroAddressNotAllowed();
        }
        operatorRegistry = operatorRegistry_;
        emit OperatorRegistryUpdated(operatorRegistry_);
    }

    function setCreditToEthRate(uint256 weiPerCredit) external onlyOwner {
        if (weiPerCredit == 0) {
            revert InvalidExchangeRate();
        }
        creditToEthRate = weiPerCredit;
        emit CreditToEthRateUpdated(weiPerCredit);
    }

    function allocateEarnings(uint256 operatorId, uint256 amountCredits) external onlyParkingLedger {
        accumulatedEarnings[operatorId] += amountCredits;
        emit EarningsAllocated(operatorId, amountCredits);
    }

    function withdraw(uint256 operatorId) external {
        if (operatorRegistry == address(0)) {
            revert OperatorRegistryNotSet();
        }

        address operatorWallet = IOperatorRegistry(operatorRegistry).getOperatorWallet(operatorId);
        if (msg.sender != operatorWallet) {
            revert NotOperatorWallet(operatorId, msg.sender);
        }

        uint256 amountCredits = accumulatedEarnings[operatorId];
        if (amountCredits == 0) {
            revert NoEarnings(operatorId);
        }

        uint256 amountWei = amountCredits * creditToEthRate;
        if (address(this).balance < amountWei) {
            revert InsufficientLiquidity(amountWei, address(this).balance);
        }

        accumulatedEarnings[operatorId] = 0;

        (bool success, ) = payable(operatorWallet).call{value: amountWei}("");
        if (!success) {
            accumulatedEarnings[operatorId] = amountCredits;
            revert WithdrawalTransferFailed(operatorWallet);
        }

        emit EarningsWithdrawn(operatorId, operatorWallet, amountCredits, amountWei);
    }

    function getAccumulatedEarnings(uint256 operatorId) external view returns (uint256) {
        return accumulatedEarnings[operatorId];
    }

    function getCreditToEthRate() external view returns (uint256) {
        return creditToEthRate;
    }
}


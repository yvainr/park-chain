// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

interface IOperatorRegistry {
    function getOperatorWallet(uint256 operatorId) external view returns (address);
}

contract OperatorTreasury {
    IOperatorRegistry public immutable operatorRegistry;

    address public owner;
    address public allocator;
    uint256 public creditToEthRate;

    mapping(uint256 => uint256) private accumulatedEarnings;

    bool private locked;

    event EarningsAllocated(uint256 indexed operatorId, uint256 amountCredits);
    event EarningsWithdrawn(
        uint256 indexed operatorId,
        address indexed operatorWallet,
        uint256 amountCredits,
        uint256 amountWei
    );
    event CreditToEthRateUpdated(uint256 weiPerCredit);
    event AllocatorUpdated(address indexed allocator);

    modifier onlyOwner() {
        require(msg.sender == owner, "OperatorTreasury: not owner");
        _;
    }

    modifier onlyAllocator() {
        require(msg.sender == allocator, "OperatorTreasury: not allocator");
        _;
    }

    modifier nonReentrant() {
        require(!locked, "OperatorTreasury: reentrant call");
        locked = true;
        _;
        locked = false;
    }

    constructor(IOperatorRegistry registry, uint256 initialCreditToEthRate) {
        require(address(registry) != address(0), "OperatorTreasury: zero registry");

        owner = msg.sender;
        allocator = msg.sender;
        operatorRegistry = registry;
        creditToEthRate = initialCreditToEthRate;

        emit CreditToEthRateUpdated(initialCreditToEthRate);
        emit AllocatorUpdated(msg.sender);
    }

    receive() external payable {}

    function setAllocator(address newAllocator) external onlyOwner {
        require(newAllocator != address(0), "OperatorTreasury: zero allocator");
        allocator = newAllocator;

        emit AllocatorUpdated(newAllocator);
    }

    function allocateEarnings(uint256 operatorId, uint256 amountCredits) external onlyAllocator {
        require(amountCredits > 0, "OperatorTreasury: zero amount");
        require(operatorRegistry.getOperatorWallet(operatorId) != address(0), "OperatorTreasury: unknown operator");

        accumulatedEarnings[operatorId] += amountCredits;

        emit EarningsAllocated(operatorId, amountCredits);
    }

    function withdraw(uint256 operatorId) external nonReentrant {
        address operatorWallet = operatorRegistry.getOperatorWallet(operatorId);
        require(operatorWallet != address(0), "OperatorTreasury: unknown operator");
        require(msg.sender == operatorWallet, "OperatorTreasury: not operator wallet");
        require(creditToEthRate > 0, "OperatorTreasury: zero exchange rate");

        uint256 amountCredits = accumulatedEarnings[operatorId];
        require(amountCredits > 0, "OperatorTreasury: no earnings");

        uint256 amountWei = amountCredits * creditToEthRate;
        require(address(this).balance >= amountWei, "OperatorTreasury: insufficient liquidity");

        accumulatedEarnings[operatorId] = 0;

        (bool sent, ) = operatorWallet.call{value: amountWei}("");
        require(sent, "OperatorTreasury: withdraw failed");

        emit EarningsWithdrawn(operatorId, operatorWallet, amountCredits, amountWei);
    }

    function setCreditToEthRate(uint256 weiPerCredit) external onlyOwner {
        creditToEthRate = weiPerCredit;

        emit CreditToEthRateUpdated(weiPerCredit);
    }

    function getAccumulatedEarnings(uint256 operatorId) external view returns (uint256) {
        return accumulatedEarnings[operatorId];
    }

    function getCreditToEthRate() external view returns (uint256) {
        return creditToEthRate;
    }
}

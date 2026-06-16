// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

contract OperatorRegistry {
    bytes32 public constant STANDARD_CATEGORY = keccak256("standard");
    bytes32 public constant DISABLED_CATEGORY = keccak256("disabled");
    bytes32 public constant EV_CHARGING_CATEGORY = keccak256("ev-charging");
    bytes32 public constant MOTORBIKE_CATEGORY = keccak256("motorbike");
    bytes32 public constant FAMILY_SLOT_CATEGORY = keccak256("family");
    bytes32 public constant WOMEN_SLOT_CATEGORY = keccak256("women");

    struct Operator {
        address wallet;
        string name;
        bool whitelisted;
    }

    address public owner;

    mapping(uint256 => Operator) public operators;
    mapping(uint256 => mapping(bytes32 => bool)) public supportedCategories;
    mapping(uint256 => mapping(bytes32 => uint256)) public pricePerHour;
    mapping(uint256 => uint256) public noShowFee;
    mapping(uint256 => mapping(bytes32 => uint256)) private categoryCapacity;

    event OperatorRegistered(uint256 indexed operatorId, address indexed wallet, string name);
    event OperatorRemoved(uint256 indexed operatorId);

    modifier onlyOwner() {
        require(msg.sender == owner, "OperatorRegistry: not owner");
        _;
    }

    modifier onlyOperatorWallet(uint256 operatorId) {
        require(msg.sender == operators[operatorId].wallet, "OperatorRegistry: not operator wallet");
        _;
    }

    constructor() {
        owner = msg.sender;
    }

    function registerOperator(
        uint256 operatorId,
        address wallet,
        string calldata name,
        bytes32[] calldata categories
    ) external onlyOwner {
        require(wallet != address(0), "OperatorRegistry: zero wallet");
        require(bytes(name).length > 0, "OperatorRegistry: empty name");

        operators[operatorId] = Operator({wallet: wallet, name: name, whitelisted: true});

        for (uint256 i = 0; i < categories.length; i++) {
            supportedCategories[operatorId][categories[i]] = true;
        }

        emit OperatorRegistered(operatorId, wallet, name);
    }

    function removeOperator(uint256 operatorId) external onlyOwner {
        require(operators[operatorId].wallet != address(0), "OperatorRegistry: unknown operator");
        operators[operatorId].whitelisted = false;

        emit OperatorRemoved(operatorId);
    }

    function setSupportedCategory(
        uint256 operatorId,
        bytes32 category,
        bool supported
    ) external onlyOwner {
        require(operators[operatorId].wallet != address(0), "OperatorRegistry: unknown operator");
        supportedCategories[operatorId][category] = supported;
    }

    function setPricePerHour(
        uint256 operatorId,
        bytes32 category,
        uint256 price
    ) external onlyOperatorWallet(operatorId) {
        require(operators[operatorId].whitelisted, "OperatorRegistry: not whitelisted");
        require(supportedCategories[operatorId][category], "OperatorRegistry: unsupported category");
        pricePerHour[operatorId][category] = price;
    }

    function setNoShowFee(uint256 operatorId, uint256 fee) external onlyOperatorWallet(operatorId) {
        require(operators[operatorId].whitelisted, "OperatorRegistry: not whitelisted");
        noShowFee[operatorId] = fee;
    }

    function isWhitelisted(uint256 operatorId) external view returns (bool) {
        return operators[operatorId].whitelisted;
    }

    function supportsCategory(uint256 operatorId, bytes32 category) external view returns (bool) {
        return supportedCategories[operatorId][category];
    }

    function getPricePerHour(uint256 operatorId, bytes32 category) external view returns (uint256) {
        return pricePerHour[operatorId][category];
    }

    function getNoShowFee(uint256 operatorId) external view returns (uint256) {
        return noShowFee[operatorId];
    }

    function getOperatorWallet(uint256 operatorId) external view returns (address) {
        return operators[operatorId].wallet;
    }

    // Parking Operator should be able to set the total number of parking slots in the parking lot (e.g. 100 cars)
    function setCategoryCapacity(uint256 operatorID, bytes32 category, uint256 capacity) external {
        require(operators[operatorID].wallet == msg.sender, "OperatorRegistry: not operator");
        require(capacity > 0, "OperatorRegistry: invalid capacity");

        categoryCapacity[operatorID][category] = capacity;
    }

    function getCategoryCapacity(uint256 operatorID, bytes32 category) external view returns(uint256) {
        return categoryCapacity[operatorID][category];
    }
}

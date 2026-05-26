// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

import "@openzeppelin/contracts/token/ERC1155/ERC1155.sol";
import "@openzeppelin/contracts/access/Ownable.sol";

contract ParkCredit is ERC1155, Ownable {
    // Token IDs
    uint256 public constant PARK_CREDIT = 1;

    //Errors ?

    // Role Management
    mapping(address => bool) public minters;
    mapping(address => bool) public burners;

    // Events
    event MinterUpdated(address indexed account, bool status);
    event BurnerUpdated(address indexed account, bool status);

    event CreditsMinted(
        address indexed to,
        uint256 amount
    );

    event CreditsBurned(
        address indexed from,
        uint256 amount
    );

    // Constructor
    constructor() ERC1155("") Ownable(msg.sender) {}

    // Modifiers
    modifier onlyMinter() {
        require(minters[msg.sender], "Not authorized to mint");
        _;
    }

    modifier onlyBurner() {
        require(burners[msg.sender], "Not authorized to burn");
        _;
    }

    // Role Administration
    function setMinter(
        address account,
        bool status
    ) external onlyOwner {
        minters[account] = status;
        emit MinterUpdated(account, status);
    }

    function setBurner(
        address account,
        bool status
    ) external onlyOwner {
        burners[account] = status;
        emit BurnerUpdated(account, status);
    }

    //
    function mint(
        address to, 
        uint256 amount 
    ) external onlyMinter {
        _mint(to, PARK_CREDIT, amount, "");
        emit CreditsMinted(to, amount);
    }

    function burn(
        address from, 
        uint256 amount 
    ) external onlyBurner {
        _burn(from, PARK_CREDIT, amount);
        emit CreditsMinted(from, amount);
    }

}
// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

import "@openzeppelin/contracts/access/Ownable.sol";

contract ParkingLedger is Ownable {
    // TODO: Implement reservation lifecycle, caps, and settlement logic.

    // define slot categories 
    enum SlotCategory {
        Standard,
        Accessible
    }

    enum ReservationStatus {
        Reserved,
        CheckedIn, 
        CheckedOut, 
        Cancelled, 
        NoShow
    }

    struct Reservation {
        uint256 reservationID;
        address member;
        uint256 operatorID;
        SlotCategory category;
        uint256 startTime;
        uint256 duration;
        uint256 checkInTime;
        ReservationStatus status;
    }

    uint256 public nextReservationID;
    uint256 public gracePeriodMinutes;

    mapping(uint256 => Reservation) private reservations;
    mapping(address => uint256[]) private memberReservations;

    // events for frontend 
    event ReservationCreated(
        uint256 indexed reservationID,
        address indexed member,
        uint256 operatorID
    );
    event ReservationCancelled(uint256 indexed reservationID);
    event CheckedIn(uint256 indexed reservationID, uint256 timestamp);
    event CheckedOut(uint256 indexed reservationID);
    event NoShow(uint256 indexed reservationID);

    // Deployer = Owner
    constructor() Ownable(msg.sender) {}

    function setGracePeriod(
        uint256 minutes_
    ) external onlyOwner {
        gracePeriodMinutes = minutes_;
    }

    function reserve(
        uint256 operatorID,
        SlotCategory category,
        uint256 startTime,
        uint256 duration
    )   external {
        require(duration > 0, "Invalid duration");

        // every new reservation gets new key 
        uint256 reservationID = nextReservationID++;

        reservations[reservationID] = Reservation({
            reservationID: reservationID,
            member: msg.sender,
            operatorID: operatorID,
            category: category,
            startTime: startTime,
            duration: duration,
            checkInTime: 0,
            status: ReservationStatus.Reserved
        });

        // finding all reservations of one specific member
        memberReservations[msg.sender].push(reservationID);

        emit ReservationCreated(reservationID, msg.sender, operatorID);
    }

    function cancelReservation(
        uint256 reservationID
    )   external {
        Reservation storage reservation = reservations[reservationID];

        require(reservation.member == msg.sender, "Not the booker");
        require(reservation.status == ReservationStatus.Reserved, "Invalid status");
        require(block.timestamp < reservation.startTime, "Reservation already started");
        
        reservation.status = ReservationStatus.Cancelled;

        emit ReservationCancelled(reservationID);
    }

    function checkIn(
        uint256 reservationID
    )   external {
        Reservation storage reservation = reservations[reservationID];

        require(reservation.member == msg.sender, "Not the booker");
        require(reservation.status == ReservationStatus.Reserved, "Invalid status");
        require(block.timestamp >= reservation.startTime, "Not the right time");
        
        reservation.checkInTime = block.timestamp;
        reservation.status = ReservationStatus.CheckedIn;

        emit CheckedIn(reservationID, block.timestamp);
    }

    function checkOut(
        uint256 reservationID
    )   external {
        Reservation storage reservation = reservations[reservationID];

        require(reservation.member == msg.sender, "Not the booker");
        require(reservation.status == ReservationStatus.CheckedIn, "Invalid status");
        
        reservation.status = ReservationStatus.CheckedOut;

        emit CheckedOut(reservationID);
    }

    function markNoShow(
        uint256 reservationID
    )   external onlyOwner {
        Reservation storage reservation = reservations[reservationID];
        
        require(reservation.status == ReservationStatus.Reserved, "Invalid status");
        require(block.timestamp >= reservation.startTime, "Not the right time");

        reservation.status = ReservationStatus.NoShow;

        emit NoShow(reservationID);
    }

    function getActiveReservation(
        address member
    )   external view returns (uint256[] memory) {
        return memberReservations[member];
    }

    function getReservation(
        uint256 reservationID
    )   external view returns (Reservation memory) {
        return reservations[reservationID];
    }
}
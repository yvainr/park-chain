// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

import "@openzeppelin/contracts/access/Ownable.sol";

interface IParkingMembershipManager {
    function isMemberActive(address member) external view returns (bool);
    function getMemberMonthlyHourCap(address member) external view returns (uint256);
}

interface IParkingOperatorRegistry {
    function isWhitelisted(uint256 operatorId) external view returns (bool);
    function supportsCategory(uint256 operatorId, bytes32 category) external view returns (bool);
    function getPricePerHour(uint256 operatorId, bytes32 category) external view returns (uint256);
    function getNoShowFee(uint256 operatorId) external view returns (uint256);
}

interface IParkingParkCredit {
    function burn(address from, uint256 amount) external;
}

interface IParkingOperatorTreasury {
    function allocateEarnings(uint256 operatorId, uint256 amountCredits) external;
}

contract ParkingLedger is Ownable {
    bytes32 public constant STANDARD_CATEGORY = keccak256("standard");
    bytes32 public constant DISABLED_CATEGORY = keccak256("disabled");
    bytes32 public constant EV_CHARGING_CATEGORY = keccak256("ev-charging");
    bytes32 public constant MOTORBIKE_CATEGORY = keccak256("motorbike");
    bytes32 public constant FAMILY_SLOT_CATEGORY = keccak256("family");
    bytes32 public constant WOMEN_SLOT_CATEGORY = keccak256("women");

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
        bytes32 category;
        uint256 startTime;
        uint256 duration;
        uint256 checkInTime;
        ReservationStatus status;
    }

    IParkingMembershipManager public immutable membershipManager;
    IParkingOperatorRegistry public immutable operatorRegistry;
    IParkingParkCredit public immutable parkCredit;
    IParkingOperatorTreasury public immutable operatorTreasury;

    uint256 public nextReservationID;
    uint256 public gracePeriodMinutes;

    mapping(uint256 => Reservation) private reservations;
    mapping(address => uint256[]) private memberReservations;
    mapping(address => mapping(bytes32 => mapping(uint256 => uint256))) private usedHoursByCategory;
    mapping(address => mapping(uint256 => mapping(uint256 => uint256))) private usedHoursByOperator;

    event ReservationCreated(
        uint256 indexed reservationID,
        address indexed member,
        uint256 indexed operatorID,
        bytes32 category
    );
    event ReservationCancelled(uint256 indexed reservationID);
    event CheckedIn(uint256 indexed reservationID, uint256 checkInTime, uint256 chargedCredits);
    event CheckedOut(uint256 indexed reservationID, uint256 checkOutTime, uint256 overstayFee);
    event NoShow(uint256 indexed reservationID, uint256 noShowFee);
    event GracePeriodUpdated(uint256 gracePeriodMinutes);

    constructor(
        IParkingMembershipManager membershipManager_,
        IParkingOperatorRegistry operatorRegistry_,
        IParkingParkCredit parkCredit_,
        IParkingOperatorTreasury operatorTreasury_
    ) Ownable(msg.sender) {
        require(address(membershipManager_) != address(0), "ParkingLedger: zero membership");
        require(address(operatorRegistry_) != address(0), "ParkingLedger: zero registry");
        require(address(parkCredit_) != address(0), "ParkingLedger: zero credit");
        require(address(operatorTreasury_) != address(0), "ParkingLedger: zero treasury");

        membershipManager = membershipManager_;
        operatorRegistry = operatorRegistry_;
        parkCredit = parkCredit_;
        operatorTreasury = operatorTreasury_;
    }

    function setGracePeriod(uint256 minutes_) external onlyOwner {
        gracePeriodMinutes = minutes_;
        emit GracePeriodUpdated(minutes_);
    }

    function setGracePeriodMinutes(uint256 minutes_) external onlyOwner {
        gracePeriodMinutes = minutes_;
        emit GracePeriodUpdated(minutes_);
    }

    function reserve(
        uint256 operatorID,
        bytes32 category,
        uint256 startTime,
        uint256 duration
    ) external returns (uint256 reservationID) {
        require(category != bytes32(0), "ParkingLedger: invalid category");
        require(duration > 0, "ParkingLedger: invalid duration");
        require(startTime >= block.timestamp, "ParkingLedger: start in past");
        require(membershipManager.isMemberActive(msg.sender), "ParkingLedger: inactive member");
        require(operatorRegistry.isWhitelisted(operatorID), "ParkingLedger: operator not whitelisted");
        require(operatorRegistry.supportsCategory(operatorID, category), "ParkingLedger: unsupported category");
        require(!_hasOverlap(msg.sender, operatorID, category, startTime, duration), "ParkingLedger: overlap");

        uint256 monthKey = _monthKey(startTime);
        uint256 cap = membershipManager.getMemberMonthlyHourCap(msg.sender);
        require(cap > 0, "ParkingLedger: no monthly cap");
        require(
            usedHoursByCategory[msg.sender][category][monthKey] + duration <= cap,
            "ParkingLedger: category cap exceeded"
        );
        require(
            usedHoursByOperator[msg.sender][operatorID][monthKey] + duration <= cap,
            "ParkingLedger: operator cap exceeded"
        );

        usedHoursByCategory[msg.sender][category][monthKey] += duration;
        usedHoursByOperator[msg.sender][operatorID][monthKey] += duration;

        reservationID = nextReservationID++;

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

        memberReservations[msg.sender].push(reservationID);

        emit ReservationCreated(reservationID, msg.sender, operatorID, category);
    }

    function cancelReservation(uint256 reservationID) external {
        Reservation storage reservation = reservations[reservationID];

        require(reservation.member == msg.sender, "ParkingLedger: not member");
        require(reservation.status == ReservationStatus.Reserved, "ParkingLedger: invalid status");

        if (block.timestamp < reservation.startTime) {
            _releaseReservedHours(reservation);
            reservation.status = ReservationStatus.Cancelled;
            emit ReservationCancelled(reservationID);
            return;
        }

        _settleNoShow(reservation);
    }

    function checkIn(uint256 reservationID) external {
        Reservation storage reservation = reservations[reservationID];

        require(reservation.member == msg.sender, "ParkingLedger: not member");
        require(reservation.status == ReservationStatus.Reserved, "ParkingLedger: invalid status");
        require(block.timestamp >= reservation.startTime, "ParkingLedger: too early");

        uint256 chargedCredits = operatorRegistry.getPricePerHour(reservation.operatorID, reservation.category)
            * reservation.duration;

        _chargeAndAllocate(reservation.member, reservation.operatorID, chargedCredits);

        reservation.checkInTime = block.timestamp;
        reservation.status = ReservationStatus.CheckedIn;

        emit CheckedIn(reservationID, block.timestamp, chargedCredits);
    }

    function checkOut(uint256 reservationID) external {
        Reservation storage reservation = reservations[reservationID];

        require(reservation.member == msg.sender, "ParkingLedger: not member");
        require(reservation.status == ReservationStatus.CheckedIn, "ParkingLedger: invalid status");

        uint256 overstayFee = _calculateOverstayFee(reservation);

        _chargeAndAllocate(reservation.member, reservation.operatorID, overstayFee);

        reservation.status = ReservationStatus.CheckedOut;

        emit CheckedOut(reservationID, block.timestamp, overstayFee);
    }

    function markNoShow(uint256 reservationID) external {
        Reservation storage reservation = reservations[reservationID];

        require(reservation.status == ReservationStatus.Reserved, "ParkingLedger: invalid status");
        require(block.timestamp >= reservation.startTime, "ParkingLedger: too early");

        _settleNoShow(reservation);
    }

    function getActiveReservation(address member) external view returns (uint256[] memory) {
        return memberReservations[member];
    }

    function getMemberReservations(address member) external view returns (uint256[] memory) {
        return memberReservations[member];
    }

    function getReservation(uint256 reservationID) external view returns (Reservation memory) {
        return reservations[reservationID];
    }

    function getUsedHoursByCategory(
        address member,
        bytes32 category,
        uint256 monthKey
    ) external view returns (uint256) {
        return usedHoursByCategory[member][category][monthKey];
    }

    function getUsedHoursByOperator(
        address member,
        uint256 operatorID,
        uint256 monthKey
    ) external view returns (uint256) {
        return usedHoursByOperator[member][operatorID][monthKey];
    }

    function getMonthKey(uint256 timestamp) external pure returns (uint256) {
        return _monthKey(timestamp);
    }

    function _settleNoShow(Reservation storage reservation) private {
        uint256 noShowFee = operatorRegistry.getNoShowFee(reservation.operatorID);

        _chargeAndAllocate(reservation.member, reservation.operatorID, noShowFee);
        _releaseReservedHours(reservation);

        reservation.status = ReservationStatus.NoShow;

        emit NoShow(reservation.reservationID, noShowFee);
    }

    function _chargeAndAllocate(address member, uint256 operatorID, uint256 amountCredits) private {
        if (amountCredits == 0) {
            return;
        }

        parkCredit.burn(member, amountCredits);
        operatorTreasury.allocateEarnings(operatorID, amountCredits);
    }

    function _calculateOverstayFee(Reservation storage reservation) private view returns (uint256) {
        uint256 reservedSeconds = reservation.duration * 1 hours;
        uint256 graceSeconds = gracePeriodMinutes * 1 minutes;
        uint256 actualSeconds = block.timestamp - reservation.checkInTime;

        if (actualSeconds <= reservedSeconds + graceSeconds) {
            return 0;
        }

        uint256 excessSeconds = actualSeconds - reservedSeconds - graceSeconds;
        uint256 excessHours = (excessSeconds + 1 hours - 1) / 1 hours;
        uint256 pricePerHour = operatorRegistry.getPricePerHour(reservation.operatorID, reservation.category);

        return excessHours * pricePerHour;
    }

    function _releaseReservedHours(Reservation storage reservation) private {
        uint256 monthKey = _monthKey(reservation.startTime);
        usedHoursByCategory[reservation.member][reservation.category][monthKey] -= reservation.duration;
        usedHoursByOperator[reservation.member][reservation.operatorID][monthKey] -= reservation.duration;
    }

    function _hasOverlap(
        address member,
        uint256 operatorID,
        bytes32 category,
        uint256 startTime,
        uint256 duration
    ) private view returns (bool) {
        uint256 endTime = startTime + (duration * 1 hours);
        uint256[] memory reservationIDs = memberReservations[member];

        for (uint256 i = 0; i < reservationIDs.length; i++) {
            Reservation storage existing = reservations[reservationIDs[i]];

            if (!_isActiveForOverlap(existing.status)) {
                continue;
            }

            if (existing.operatorID != operatorID || existing.category != category) {
                continue;
            }

            uint256 existingEndTime = existing.startTime + (existing.duration * 1 hours);
            if (startTime < existingEndTime && endTime > existing.startTime) {
                return true;
            }
        }

        return false;
    }

    function _isActiveForOverlap(ReservationStatus status) private pure returns (bool) {
        return status == ReservationStatus.Reserved || status == ReservationStatus.CheckedIn;
    }

    function _monthKey(uint256 timestamp) private pure returns (uint256) {
        return timestamp / 30 days;
    }
}

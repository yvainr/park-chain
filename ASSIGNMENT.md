# Assignment 7: Urban Parking & EV Charging Network

## Scenario

ParkChain is a city-wide parking and electric vehicle charging network. Municipal parking garages, private surface lots, and EV charging stations register as operators on a shared smart contract platform. Users purchase a monthly membership that mints a bundle of ParkCredits, an ERC-1155-compatible token, to their wallet. They spend these credits to reserve and occupy parking slots or charging bays at any registered operator. Operators withdraw their accumulated earnings at the end of the billing period.

Memberships come in three tiers that differ not only in credit allowance but also in how many hours per month a member may occupy within a given slot category, such as standard, disabled, ev-charging, or motorbike, or at a specific operator within a calendar month:

- Urban: up to 20 hours/month per category and per operator.
- Commuter: up to 60 hours/month per category and per operator.
- Unlimited: up to 120 hours/month per category and per operator.

The ParkingLedger enforces these caps on-chain.

Parking is a three-phase lifecycle:

1. A member first calls `reserve(operatorId, slotCategory, startTime, durationHours)` to claim a future time window for a specific slot category at a chosen operator.
2. The ParkingLedger checks that the requested window does not overlap with any existing reservation held by the same member at the same operator for the same category. Overlapping reservations are reverted.
3. At the declared start time, the member calls `checkIn()` to confirm occupancy and deduct credits proportionally to the reserved duration.
4. Finally, the member calls `checkOut()` to settle the booking.

If the actual occupancy duration, derived from `block.timestamp` minus the check-in timestamp, exceeds the reserved duration by more than a configurable grace period in minutes, the ParkingLedger deducts an overstay fee in ParkCredits per excess hour before closing the record.

A reservation that is never checked into may be cancelled by the member at no cost before the start time. After the start time, it is forfeited and the operator receives a configurable no-show fee.

The platform is governed by an admin, the ParkChain authority, who whitelists operators, sets membership tiers, configures the grace period, and manages the credit-to-ETH exchange rate.

No central intermediary holds user funds. Payments flow directly through the contracts.

## Stakeholders

| Actor | Description |
|---|---|
| Admin | Deploys and configures the platform; whitelists operators; sets membership tiers, grace period, and exchange rate. |
| Member | Purchases a membership; holds ParkCredits; reserves, checks in, and checks out at operators. |
| Operator | Registered parking or charging provider; sets credit price per hour and no-show fee; accepts reservations and check-ins; withdraws earnings. |

## User Stories

### Admin

#### US-A1

As an admin, I want to register and whitelist an operator by wallet address, name, operator ID, and supported slot categories so that members can reserve slots there and usage caps can be enforced per operator and per category.

#### US-A2

As an admin, I want to remove an operator from the whitelist so that it can no longer accept new reservations.

#### US-A3

As an admin, I want to define membership tiers, for example:

- Urban: 80 ParkCredits/month at 0.01 ETH.
- Commuter: 200 ParkCredits/month at 0.02 ETH.
- Unlimited: 400 ParkCredits/month at 0.03 ETH.

I also want to set the credit-to-ETH exchange rate and configure the global overstay grace period so that members can choose a plan and operators can be paid fairly.

### Member

#### US-M1

As a member, I want to purchase a monthly membership tier by sending ETH so that I receive the corresponding ParkCredit balance.

#### US-M2

As a member, I want to renew my membership before it expires so that my ParkCredit balance is topped up and my membership period is extended.

#### US-M3

As a member with an expired membership, I want to be prevented from making new reservations so that the system enforces the membership requirement.

#### US-M4

As a member, I want to call `reserve()` with an operator, slot category, start time, and duration so that a reservation record is created on-chain. The call reverts if the requested window overlaps with any of my existing reservations at the same operator for the same category.

#### US-M5

As a member, I want to call `checkIn()` at or after my reservation start time so that my occupancy is confirmed on-chain and the proportional credit cost for the reserved duration is deducted from my balance.

#### US-M6

As a member, I want to call `checkOut()` to close my occupancy. If I exceed the reserved duration by more than the grace period, an overstay fee per excess hour is automatically deducted from my ParkCredit balance before the record is closed.

#### US-M7

As a member, I want to cancel a reservation before its start time at no cost so that I am not charged for slots I no longer need.

#### US-M8

As a member, I want to be blocked from reserving once I have reached my tier's monthly hour cap for a specific slot category or for a specific operator so that the system enforces the tier limits.

#### US-M9

As a member, I want to view my current ParkCredit balance, membership expiry, remaining monthly hours per category and operator, and all my active reservations including operator, category, start time, duration, and status so that I can manage my parking.

### Operator

#### US-O1

As an operator, I want to set and update my credit price per hour per slot category and my no-show fee in ParkCredits so that the ParkingLedger charges members correctly.

#### US-O2

As an operator, I want to receive a ParkCredit allocation on member check-in for the reserved duration and an additional allocation for overstay fees and no-show fees so that all my earnings accumulate on-chain.

#### US-O3

As an operator, I want to withdraw my accumulated ParkCredits, converted to ETH at the current exchange rate, so that I receive payment for the services I provided.

#### US-O4

As an operator, I want to view my total accumulated earnings so that I can track revenue before withdrawing.

## The Preparation

The project must include:

1. One or more simplified business processes covering the use cases from the stakeholder perspectives.
2. Identification of all involved stakeholders and what each contributes to each process.
3. Planning of all involved smart contracts and their purpose.
4. Mapping of the interactions between stakeholders and contracts.
5. A short explanation, in half a page or less, of why a smart-contract-based system is suitable for this use case:
   - What problems does it solve?
   - What problems does it create?

## The Frontend

Develop a TypeScript or JavaScript single-page frontend for the different stakeholders, or one simple frontend for each stakeholder.

The frontend must enable the features from the user stories.

The frontend does not need to be visually polished. It only needs to be functional.

## The Cherry On Top

For each member of the group, add a specific unique feature to this smart contract platform.

If the group consists of three members, three small additional features are required.

Possible examples:

- Reservation transfer to another member.
- Dynamic peak-hour price multiplier.
- Operator blacklist for repeat overstay offenders.

The group should be creative.

## Future Requirements

Towards the middle of the semester, the stakeholders might change the scope or add requirements.

The project should be prepared for future changes.

## Required Artifacts

The required artifacts are:

1. All code in a git mono-repository:
   - contracts;
   - frontend;
   - tests;
   - analysis;
   - CI/CD;
   - documentation.
2. Two digital posters in vertical A1 format:
   - one intermediary poster;
   - one final poster.
3. Posters must be handed in as PDF files.
4. The group must be prepared to present both posters live.
5. A final report of up to 16 pages in LNCS format.
6. The report must follow the Springer LNCS proceedings author instructions.
7. Use the official LNCS proceedings template.
8. Every Monday, a commit must be pushed to the `main` branch.
9. The Monday commit must be a running version of the current project state.
10. The group must be prepared to discuss what has been built.

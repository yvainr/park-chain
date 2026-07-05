# Process Model

## Member Reservation and Rating

1. The member purchases or renews an active membership.
2. The member reserves an available operator slot for a category and time window.
3. At or after the start time, the member checks in and the reserved-duration credits are charged.
4. At checkout, the ledger charges any overstay fee beyond the grace period and closes the reservation.
5. The member submits a 1-5 rating for the parking experience. The frontend uses `checkOutWithRating` for the normal flow, and `rateReservation` remains available for reservations that were checked out without a rating.

Each reservation can be rated once. Operator averages are exposed as `calcAvgRating(operatorID)`, scaled by 100 for integer math.

## Operator Rating View

1. The operator signs in with the registered operator wallet.
2. The workspace resolves the operator ID from the wallet.
3. The operator page reads `operatorRatings(operatorID)` and `calcAvgRating(operatorID)`.
4. The frontend displays the average rating and rating count next to earnings and payout actions.

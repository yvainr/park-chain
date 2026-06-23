import { membershipManagerAbi, parkCreditAbi, parkingLedgerAbi } from "../abi/contracts";
import { ContractPanel, OutputPanel, SharedFields } from "../components/shared-panels";
import { Button, Card, CardContent, CardDescription, CardHeader, CardTitle, Input, Label } from "../components/ui";
import { readContract, toUint } from "../lib/wallet";

export function CustomerPage({ app }: any) {
  return (
    <div className="dashboard-grid">
      <div className="stack">
        <SharedFields app={app} includeCustomerLookup />

        <Card>
          <CardHeader>
            <CardTitle>Membership</CardTitle>
            <CardDescription>Purchase or renew monthly access and inspect your ParkCredit balance.</CardDescription>
          </CardHeader>
          <CardContent className="tab-panel">
            <div className="grid two">
              <Label>
                <span>Membership payment wei</span>
                <Input value={app.tierPriceWei} onChange={(event: any) => app.setTierPriceWei(event.target.value)} />
              </Label>
            </div>

            <div className="actions">
              <Button
                onClick={() =>
                  app.run("Purchase membership", () =>
                    app.txBase(
                      app.requireMembership(),
                      membershipManagerAbi,
                      "purchaseMembership",
                      [toUint(app.tierId, "Tier ID")],
                      toUint(app.tierPriceWei, "Membership payment wei"),
                    ),
                  )
                }
              >
                Purchase Membership
              </Button>
              <Button
                variant="secondary"
                onClick={() =>
                  app.run("Renew membership", () =>
                    app.txBase(
                      app.requireMembership(),
                      membershipManagerAbi,
                      "renewMembership",
                      [toUint(app.tierId, "Tier ID")],
                      toUint(app.tierPriceWei, "Membership payment wei"),
                    ),
                  )
                }
              >
                Renew Membership
              </Button>
              <Button
                variant="secondary"
                onClick={() =>
                  app.run("ParkCredit balance", async () =>
                    readContract({
                      address: app.requireCredit(),
                      abi: parkCreditAbi,
                      functionName: "balanceOf",
                      args: [app.memberReadAddress(), app.parkCreditId],
                    }),
                  )
                }
              >
                Get Credit Balance
              </Button>
              <Button
                variant="secondary"
                onClick={() =>
                  app.run("Membership expiry", async () =>
                    app.formatExpiry(
                      await readContract({
                        address: app.requireMembership(),
                        abi: membershipManagerAbi,
                        functionName: "getMembershipExpiry",
                        args: [app.memberReadAddress()],
                      }),
                    ),
                  )
                }
              >
                Get Expiry
              </Button>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Reservations</CardTitle>
            <CardDescription>Create reservations and complete check-in, check-out, or no-show workflows.</CardDescription>
          </CardHeader>
          <CardContent className="tab-panel">
            <div className="grid three">
              <Label>
                <span>Reservation ID</span>
                <Input value={app.reservationId} onChange={(event: any) => app.setReservationId(event.target.value)} />
              </Label>
              <Label>
                <span>Start timestamp</span>
                <Input
                  value={app.reservationStartTime}
                  onChange={(event: any) => app.setReservationStartTime(event.target.value)}
                />
              </Label>
              <Label>
                <span>Duration hours</span>
                <Input value={app.reservationDuration} onChange={(event: any) => app.setReservationDuration(event.target.value)} />
              </Label>
            </div>

            <div className="actions">
              <Button
                onClick={() =>
                  app.run("Reserve slot", () =>
                    app.txBase(app.requireLedger(), parkingLedgerAbi, "reserve", [
                      toUint(app.operatorId, "Operator ID"),
                      app.categoryHash,
                      toUint(app.reservationStartTime, "Start timestamp"),
                      toUint(app.reservationDuration, "Duration hours"),
                    ]),
                  )
                }
              >
                Reserve
              </Button>
              <Button
                variant="secondary"
                onClick={() =>
                  app.run("Cancel reservation", () =>
                    app.txBase(app.requireLedger(), parkingLedgerAbi, "cancelReservation", [
                      toUint(app.reservationId, "Reservation ID"),
                    ]),
                  )
                }
              >
                Cancel
              </Button>
              <Button
                variant="secondary"
                onClick={() =>
                  app.run("Check in", () =>
                    app.txBase(app.requireLedger(), parkingLedgerAbi, "checkIn", [toUint(app.reservationId, "Reservation ID")]),
                  )
                }
              >
                Check In
              </Button>
              <Button
                variant="secondary"
                onClick={() =>
                  app.run("Check out", () =>
                    app.txBase(app.requireLedger(), parkingLedgerAbi, "checkOut", [toUint(app.reservationId, "Reservation ID")]),
                  )
                }
              >
                Check Out
              </Button>
              <Button
                variant="secondary"
                onClick={() =>
                  app.run("Mark no-show", () =>
                    app.txBase(app.requireLedger(), parkingLedgerAbi, "markNoShow", [toUint(app.reservationId, "Reservation ID")]),
                  )
                }
              >
                Mark No-Show
              </Button>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Customer Reads</CardTitle>
            <CardDescription>Check membership status, active reservations, and monthly usage.</CardDescription>
          </CardHeader>
          <CardContent className="read-grid">
            <Button
              variant="secondary"
              onClick={() =>
                app.run("Membership active", async () =>
                  readContract({
                    address: app.requireMembership(),
                    abi: membershipManagerAbi,
                    functionName: "isMemberActive",
                    args: [app.memberReadAddress()],
                  }),
                )
              }
            >
              Is Member Active
            </Button>
            <Button
              variant="secondary"
              onClick={() =>
                app.run("Member tier", async () =>
                  readContract({
                    address: app.requireMembership(),
                    abi: membershipManagerAbi,
                    functionName: "getMemberTier",
                    args: [app.memberReadAddress()],
                  }),
                )
              }
            >
              Get Member Tier
            </Button>
            <Button
              variant="secondary"
              onClick={() =>
                app.run("Monthly hour cap", async () =>
                  readContract({
                    address: app.requireMembership(),
                    abi: membershipManagerAbi,
                    functionName: "getMemberMonthlyHourCap",
                    args: [app.memberReadAddress()],
                  }),
                )
              }
            >
              Get Hour Cap
            </Button>
            <Button
              variant="secondary"
              onClick={() =>
                app.run("Member reservations", () =>
                  readContract({
                    address: app.requireLedger(),
                    abi: parkingLedgerAbi,
                    functionName: "getMemberReservations",
                    args: [app.memberReadAddress()],
                  }),
                )
              }
            >
              Get Reservations
            </Button>
            <Button
              variant="secondary"
              onClick={() =>
                app.run("Reservation", () =>
                  readContract({
                    address: app.requireLedger(),
                    abi: parkingLedgerAbi,
                    functionName: "getReservation",
                    args: [toUint(app.reservationId, "Reservation ID")],
                  }),
                )
              }
            >
              Get Reservation
            </Button>
            <Button
              variant="secondary"
              onClick={() =>
                app.run("Month key", () =>
                  readContract({
                    address: app.requireLedger(),
                    abi: parkingLedgerAbi,
                    functionName: "getMonthKey",
                    args: [toUint(app.reservationStartTime, "Start timestamp")],
                  }),
                )
              }
            >
              Get Month Key
            </Button>
            <Label>
              <span>Month key for usage reads</span>
              <Input value={app.monthKey} onChange={(event: any) => app.setMonthKey(event.target.value)} />
            </Label>
            <Button
              variant="secondary"
              onClick={() =>
                app.run("Used category hours", () =>
                  readContract({
                    address: app.requireLedger(),
                    abi: parkingLedgerAbi,
                    functionName: "getUsedHoursByCategory",
                    args: [app.memberReadAddress(), app.categoryHash, toUint(app.monthKey, "Month key")],
                  }),
                )
              }
            >
              Used Category Hours
            </Button>
            <Button
              variant="secondary"
              onClick={() =>
                app.run("Used operator hours", () =>
                  readContract({
                    address: app.requireLedger(),
                    abi: parkingLedgerAbi,
                    functionName: "getUsedHoursByOperator",
                    args: [app.memberReadAddress(), toUint(app.operatorId, "Operator ID"), toUint(app.monthKey, "Month key")],
                  }),
                )
              }
            >
              Used Operator Hours
            </Button>
          </CardContent>
        </Card>
      </div>

      <aside className="side-stack">
        <ContractPanel app={app} />
        <OutputPanel app={app} />
      </aside>
    </div>
  );
}

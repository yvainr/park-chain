import { membershipManagerAbi, parkingLedgerAbi } from "../abi/contracts";
import { ContractPanel, OutputPanel, SharedFields } from "../components/shared-panels";
import { Badge, Button, Card, CardContent, CardDescription, CardHeader, CardTitle, Input, Label } from "../components/ui";
import { readContract, toUint } from "../lib/wallet";

export function CustomerPage({ app }: any) {
  return (
    <div className="dashboard-grid">
      <div className="stack">
        <ContractPanel app={app} />

        <Card>
          <CardHeader>
            <CardTitle>Membership</CardTitle>
            <CardDescription>Purchase or renew monthly access.</CardDescription>
          </CardHeader>
          <CardContent className="tab-panel">
            <div className="grid two">
              <Label>
                <span>Membership payment ETH</span>
                <Input value={app.tierPriceWei} onChange={(event: any) => app.setTierPriceWei(event.target.value)} />
              </Label>
            </div>

            <div className="actions">
              <Button
                onClick={() =>
                  app.run("Purchase membership", async () => {
                    const result = await app.txBase(
                      app.requireMembership(),
                      membershipManagerAbi,
                      "purchaseMembership",
                      [toUint(app.tierId, "Tier ID")],
                      app.ethToWei(app.tierPriceWei),
                    );
                    await app.refreshMemberAccount();
                    return result;
                  })
                }
              >
                Purchase Membership
              </Button>
              <Button
                variant="secondary"
                onClick={() =>
                  app.run("Renew membership", async () => {
                    const result = await app.txBase(
                      app.requireMembership(),
                      membershipManagerAbi,
                      "renewMembership",
                      [toUint(app.tierId, "Tier ID")],
                      app.ethToWei(app.tierPriceWei),
                    );
                    await app.refreshMemberAccount();
                    return result;
                  })
                }
              >
                Renew Membership
              </Button>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Reservations</CardTitle>
            <CardDescription>Create a booking, then continue with the next available action.</CardDescription>
          </CardHeader>
          <CardContent className="tab-panel">
            <div className="reservation-status">
              <Badge variant={app.canUseReservedActions || app.canCheckOutReservation ? "success" : "secondary"}>
                {app.reservationStatusLabel}
              </Badge>
              <span>{app.reservationSummary}</span>
            </div>

            <div className="grid two">
              <Label>
                <span>Start time Berlin</span>
                <Input
                  type="datetime-local"
                  value={app.reservationStartTime}
                  onChange={(event: any) => app.setReservationStartTime(event.target.value)}
                />
              </Label>
              <Label>
                <span>Duration hours</span>
                <Input
                  min="1"
                  step="1"
                  type="number"
                  value={app.reservationDuration}
                  onChange={(event: any) => app.setReservationDuration(event.target.value)}
                />
              </Label>
            </div>

            <div className="actions">
              <Button
                onClick={() =>
                  app.run("Reserve slot", async () => {
                    const result = await app.txBase(app.requireLedger(), parkingLedgerAbi, "reserve", [
                      toUint(app.operatorId, "Operator ID"),
                      app.categoryHash,
                      app.berlinDateTimeToUnixSeconds(app.reservationStartTime),
                      toUint(app.reservationDuration, "Duration hours"),
                    ]);
                    await app.loadLatestMemberReservation();
                    await app.refreshMemberAccount();
                    return result;
                  })
                }
              >
                Reserve
              </Button>

              {app.canUseReservedActions && (
                <>
                  <Button
                    variant="secondary"
                    onClick={() =>
                      app.run("Cancel reservation", async () => {
                        const result = await app.txBase(app.requireLedger(), parkingLedgerAbi, "cancelReservation", [
                          toUint(app.reservationId, "Reservation ID"),
                        ]);
                        await app.refreshSelectedReservation();
                        return result;
                      })
                    }
                  >
                    Cancel
                  </Button>
                  <Button
                    variant="secondary"
                    onClick={() =>
                      app.run("Check in", async () => {
                        const result = await app.txBase(app.requireLedger(), parkingLedgerAbi, "checkIn", [
                          toUint(app.reservationId, "Reservation ID"),
                        ]);
                        await app.refreshSelectedReservation();
                        return result;
                      })
                    }
                  >
                    Check In
                  </Button>
                  <Button
                    variant="secondary"
                    onClick={() =>
                      app.run("Mark no-show", async () => {
                        const result = await app.txBase(app.requireLedger(), parkingLedgerAbi, "markNoShow", [
                          toUint(app.reservationId, "Reservation ID"),
                        ]);
                        await app.refreshSelectedReservation();
                        return result;
                      })
                    }
                  >
                    Mark No-Show
                  </Button>
                </>
              )}

              {app.canCheckOutReservation && (
                <Button
                  variant="secondary"
                  onClick={() =>
                    app.run("Check out", async () => {
                      const result = await app.txBase(app.requireLedger(), parkingLedgerAbi, "checkOut", [
                        toUint(app.reservationId, "Reservation ID"),
                      ]);
                      await app.refreshSelectedReservation();
                      return result;
                    })
                  }
                >
                  Check Out
                </Button>
              )}
            </div>

            <details className="advanced-panel">
              <summary>Load existing reservation</summary>
              <div className="advanced-panel-content">
                <Label>
                  <span>Reservation ID</span>
                  <Input value={app.reservationId} onChange={(event: any) => app.setReservationId(event.target.value)} />
                </Label>
                <Button variant="secondary" onClick={() => app.run("Load reservation", () => app.loadReservation())}>
                  Load Reservation
                </Button>
              </div>
            </details>
          </CardContent>
        </Card>

        <details className="advanced-panel advanced-card">
          <summary>Customer reads</summary>
          <div className="advanced-panel-content read-grid">
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
            <Button variant="secondary" onClick={() => app.run("Reservation", () => app.loadReservation())}>
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
                    args: [app.berlinDateTimeToUnixSeconds(app.reservationStartTime)],
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
          </div>
        </details>

        <SharedFields app={app} />
      </div>

      <aside className="side-stack">
        <Card>
          <CardHeader>
            <div>
              <CardTitle>My Account</CardTitle>
              <CardDescription>Connected wallet summary.</CardDescription>
            </div>
            <Button variant="secondary" onClick={() => app.run("Refresh account", app.refreshMemberAccount)}>
              Refresh
            </Button>
          </CardHeader>
          <CardContent className="tab-panel">
            <div className="metric-grid side-metric-grid">
              <div>
                <span>Credits</span>
                <strong>{app.memberSummary.balance}</strong>
              </div>
              <div>
                <span>Membership</span>
                <strong>{app.memberSummary.active}</strong>
              </div>
              <div>
                <span>Tier</span>
                <strong>{app.memberSummary.tier}</strong>
              </div>
              <div>
                <span>Hour cap</span>
                <strong>{app.memberSummary.cap}</strong>
              </div>
              <div className="metric-wide">
                <span>Expiry</span>
                <strong>{app.memberSummary.expiry}</strong>
              </div>
              <div className="metric-wide">
                <span>Reservations</span>
                <strong>{app.memberSummary.reservations}</strong>
              </div>
            </div>

            <details className="advanced-panel">
              <summary>Lookup address</summary>
              <div className="advanced-panel-content">
                <Label>
                  <span>Customer address for reads</span>
                  <Input
                    placeholder="Defaults to connected wallet"
                    value={app.memberLookup}
                    onChange={(event: any) => app.setMemberLookup(event.target.value)}
                  />
                </Label>
              </div>
            </details>
          </CardContent>
        </Card>
        <OutputPanel app={app} />
      </aside>
    </div>
  );
}

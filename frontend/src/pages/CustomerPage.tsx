import { useState } from "react";
import { ChevronDown, ChevronUp } from "lucide-react";
import { membershipManagerAbi, parkingLedgerAbi } from "../abi/contracts";
import { ContractPanel, OutputPanel, SharedFields } from "../components/shared-panels";
import {
  Badge,
  Button,
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
  Input,
  Label,
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "../components/ui";
import { readContract, toUint } from "../lib/wallet";
import type { CategoryName } from "../types";

const CALENDAR_ROWS = 48;

function formatRowTime(row: number) {
  const hours = Math.floor(row / 2);
  const minutes = row % 2 === 0 ? "00" : "30";
  return `${hours.toString().padStart(2, "0")}:${minutes}`;
}

function reservationEndTime(reservation: any, app: any) {
  return reservation.startTime + reservation.duration * app.hourSeconds;
}

function reservationRowSpan(reservation: any, app: any) {
  const dayStart = app.slotCalendar.dayStart;
  const start = reservation.startTime > dayStart ? reservation.startTime : dayStart;
  const end = reservationEndTime(reservation, app);
  const dayEnd = dayStart + 24n * app.hourSeconds;
  const clippedEnd = end < dayEnd ? end : dayEnd;
  const span = (clippedEnd - start + app.halfHourSeconds - 1n) / app.halfHourSeconds;
  return Number(span > 0n ? span : 1n);
}

function reservationStartRow(reservation: any, app: any) {
  const dayStart = app.slotCalendar.dayStart;
  if (reservation.startTime <= dayStart) return 0;
  return Number((reservation.startTime - dayStart) / app.halfHourSeconds);
}

function reservationEndRow(reservation: any, app: any) {
  const dayStart = app.slotCalendar.dayStart;
  const end = reservationEndTime(reservation, app);
  const row = Number((end - dayStart + app.halfHourSeconds - 1n) / app.halfHourSeconds);
  return Math.min(CALENDAR_ROWS, Math.max(0, row));
}

function reservationForSlotRow(slotID: bigint, row: number, app: any) {
  return app.slotCalendar.reservations.find((reservation: any) => {
    if (reservation.slotID !== slotID) return false;
    return reservationStartRow(reservation, app) === row;
  });
}

function isCoveredByReservation(slotID: bigint, row: number, app: any) {
  return app.slotCalendar.reservations.some((reservation: any) => {
    if (reservation.slotID !== slotID) return false;
    return row > reservationStartRow(reservation, app) && row < reservationEndRow(reservation, app);
  });
}

function CustomerCollapsiblePanel({ title, description, badge, contentClassName = "", children }: any) {
  const [isOpen, setIsOpen] = useState(false);
  const panelId = `${String(title).toLowerCase().replace(/[^a-z0-9]+/g, "-")}-panel`;

  return (
    <Card className="dev-panel-card">
      <CardHeader className="dev-panel-header">
        <div className="dev-panel-heading">
          <div className="dev-panel-title-row">
            <CardTitle>{title}</CardTitle>
            {badge && <Badge>{badge}</Badge>}
          </div>
          <CardDescription>{description}</CardDescription>
        </div>
        <Button
          variant="ghost"
          className="dev-panel-toggle"
          aria-expanded={isOpen}
          aria-controls={panelId}
          onClick={() => setIsOpen((open) => !open)}
        >
          {isOpen ? "Hide" : "Show"}
          {isOpen ? <ChevronUp aria-hidden="true" size={16} /> : <ChevronDown aria-hidden="true" size={16} />}
        </Button>
      </CardHeader>
      <div id={panelId} className={`dev-panel-content${isOpen ? " is-open" : ""}`} aria-hidden={!isOpen} inert={!isOpen}>
        <div className="dev-panel-content-inner">
          <CardContent className={contentClassName}>{children}</CardContent>
        </div>
      </div>
    </Card>
  );
}

export function CustomerPage({ app }: any) {
  const selectedOperatorKnown = app.registeredOperators.some(
    (operator: any) => operator.id.toString() === app.operatorId,
  );
  const operatorOptions =
    selectedOperatorKnown || !app.operatorId
      ? app.registeredOperators
      : [{ id: app.operatorId, name: `Operator #${app.operatorId}`, wallet: "" }, ...app.registeredOperators];
  const activeMembershipTiers = app.membershipTiers.filter((tier: any) => tier.active);
  const selectedTier = app.membershipTiers.find((tier: any) => tier.id.toString() === app.tierId);

  function selectMembershipTier(tierId: string) {
    const tier = app.membershipTiers.find((candidate: any) => candidate.id.toString() === tierId);
    app.setTierId(tierId);
    if (!tier) return;
    app.setTierName(tier.name);
    app.setTierCredits(tier.monthlyCredits.toString());
    app.setTierHourCap(tier.monthlyHourCap.toString());
    app.setTierPriceWei(tier.priceWei.toString());
    app.setTierActive(tier.active);
  }

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
                <span>Membership tier</span>
                <Select value={app.tierId} onValueChange={selectMembershipTier}>
                  <SelectTrigger aria-label="Membership tier">
                    <SelectValue placeholder="Select a tier..." />
                  </SelectTrigger>
                  <SelectContent>
                    {activeMembershipTiers.map((tier: any) => (
                      <SelectItem key={tier.id.toString()} value={tier.id.toString()}>
                        {tier.name} - {tier.monthlyCredits.toString()} credits
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </Label>
              <div className="membership-tier-summary">
                <div>
                  <span>Price</span>
                  <strong>{selectedTier ? `${selectedTier.priceWei.toString()} wei` : "-"}</strong>
                </div>
                <div>
                  <span>Hour cap</span>
                  <strong>{selectedTier ? `${selectedTier.monthlyHourCap.toString()} h` : "-"}</strong>
                </div>
              </div>
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
                      toUint(app.tierPriceWei, "Membership price wei"),
                    );
                    await app.refreshMemberAccount();
                    await app.refreshMembershipTiers();
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
                      toUint(app.tierPriceWei, "Membership price wei"),
                    );
                    await app.refreshMemberAccount();
                    await app.refreshMembershipTiers();
                    return result;
                  })
                }
              >
                Renew Membership
              </Button>
            </div>
            {app.membershipTiers.length > 0 && (
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Tier</TableHead>
                    <TableHead>Credits</TableHead>
                    <TableHead>Hour cap</TableHead>
                    <TableHead>Price (wei)</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {activeMembershipTiers.map((tier: any) => (
                    <TableRow className={tier.id.toString() === app.tierId ? "is-dirty" : ""} key={tier.id.toString()}>
                      <TableCell>
                        <strong>{tier.name}</strong>
                      </TableCell>
                      <TableCell>{tier.monthlyCredits.toString()}</TableCell>
                      <TableCell>{tier.monthlyHourCap.toString()}</TableCell>
                      <TableCell>{tier.priceWei.toString()}</TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            )}
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
                <span>Operator</span>
                <Select value={app.operatorId} onValueChange={app.setOperatorId}>
                  <SelectTrigger aria-label="Reservation operator">
                    <SelectValue placeholder="Select an operator..." />
                  </SelectTrigger>
                  <SelectContent>
                    {operatorOptions.map((operator: any) => (
                      <SelectItem key={operator.id.toString()} value={operator.id.toString()}>
                        {operator.name} (ID {operator.id.toString()})
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </Label>
              <Label>
                <span>Category</span>
                <Select value={app.categoryName} onValueChange={(value: string) => app.setCategoryName(value as CategoryName)}>
                  <SelectTrigger aria-label="Reservation category">
                    <SelectValue placeholder="Select a category..." />
                  </SelectTrigger>
                  <SelectContent>
                    {app.categoryNames.map((name: CategoryName) => (
                      <SelectItem key={name} value={name}>
                        {name}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </Label>
              <Label>
                <span>Slot ID</span>
                <Input
                  min="1"
                  step="1"
                  type="number"
                  value={app.reservationSlotId}
                  onChange={(event: any) => app.setReservationSlotId(event.target.value)}
                />
              </Label>
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
                    const result = await app.txBase(app.requireLedger(), parkingLedgerAbi, "reserveSlot", [
                      toUint(app.operatorId, "Operator ID"),
                      app.categoryHash,
                      toUint(app.reservationSlotId, "Slot ID"),
                      app.berlinDateTimeToUnixSeconds(app.reservationStartTime),
                      toUint(app.reservationDuration, "Duration hours"),
                    ]);
                    await app.loadLatestMemberReservation();
                    await app.refreshMemberAccount();
                    await app.refreshSlotCalendar();
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
                        await app.refreshSlotCalendar();
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
                        await app.refreshSlotCalendar();
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
                        await app.refreshSlotCalendar();
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
                      await app.refreshSlotCalendar();
                      return result;
                    })
                  }
                >
                  Check Out
                </Button>
              )}
            </div>
          </CardContent>
        </Card>

        <CustomerCollapsiblePanel
          title="Load Existing Reservation"
          description="Open a reservation by ID to continue cancellation, check-in, or checkout."
          badge="Advanced"
          contentClassName="advanced-panel-content"
        >
          <Label>
            <span>Reservation ID</span>
            <Input value={app.reservationId} onChange={(event: any) => app.setReservationId(event.target.value)} />
          </Label>
          <Button variant="secondary" onClick={() => app.run("Load reservation", () => app.loadReservation())}>
            Load Reservation
          </Button>
        </CustomerCollapsiblePanel>

        <Card>
          <CardHeader>
            <div>
              <CardTitle>Slot Calendar</CardTitle>
              <CardDescription>
                {app.slotCalendar.dateLabel || "Select an operator and date"} - {app.slotCalendar.capacity} slots
              </CardDescription>
            </div>
            <Button variant="secondary" onClick={() => app.run("Refresh slot calendar", app.refreshSlotCalendar)}>
              Refresh
            </Button>
          </CardHeader>
          <CardContent className="slot-calendar-panel">
            {app.slotCalendar.error && <Badge variant="error">Calendar unavailable</Badge>}
            {app.slotCalendar.loading && <Badge variant="secondary">Loading</Badge>}
            {app.slotCalendar.error && <p className="slot-calendar-error">{app.slotCalendar.error}</p>}
            {!app.slotCalendar.error && app.slotCalendar.slots.length === 0 && (
              <p className="slot-calendar-empty">No configured slots for this operator and category.</p>
            )}
            {app.slotCalendar.slots.length > 0 && (
              <Table className="slot-calendar-table">
                <TableHeader>
                  <TableRow>
                    <TableHead className="slot-calendar-time-head">Time</TableHead>
                    {app.slotCalendar.slots.map((slotID: bigint) => (
                      <TableHead key={slotID.toString()} className="slot-calendar-slot-head">
                        Slot {slotID.toString()}
                      </TableHead>
                    ))}
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {Array.from({ length: CALENDAR_ROWS }, (_value, row) => {
                    const rowStart = app.slotCalendar.dayStart + BigInt(row) * app.halfHourSeconds;
                    return (
                      <TableRow key={row}>
                        <TableCell className="slot-calendar-time-cell">{formatRowTime(row)}</TableCell>
                        {app.slotCalendar.slots.map((slotID: bigint) => {
                          const reservation = reservationForSlotRow(slotID, row, app);
                          if (reservation) {
                            return (
                              <TableCell
                                key={slotID.toString()}
                                className="slot-calendar-booked-cell"
                                rowSpan={reservationRowSpan(reservation, app)}
                              >
                                <div className="slot-calendar-booking">
                                  <strong>
                                    {app.formatBerlinTime(reservation.startTime)} -{" "}
                                    {app.formatBerlinTime(reservationEndTime(reservation, app))}
                                  </strong>
                                  <span>Reservation #{reservation.id.toString()}</span>
                                </div>
                              </TableCell>
                            );
                          }

                          if (isCoveredByReservation(slotID, row, app)) return null;

                          return (
                            <TableCell key={slotID.toString()} className="slot-calendar-free-cell">
                              <button
                                type="button"
                                className="slot-calendar-free-button"
                                aria-label={`Select slot ${slotID.toString()} at ${formatRowTime(row)}`}
                                onClick={() => app.selectCalendarSlot(slotID, rowStart)}
                              />
                            </TableCell>
                          );
                        })}
                      </TableRow>
                    );
                  })}
                </TableBody>
              </Table>
            )}
          </CardContent>
        </Card>

        <CustomerCollapsiblePanel
          title="Customer Reads"
          description="Read membership, usage, and reservation data for the connected wallet."
          badge="Read tools"
          contentClassName="read-grid"
        >
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
        </CustomerCollapsiblePanel>

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
          </CardContent>
        </Card>
        <OutputPanel app={app} />
      </aside>
    </div>
  );
}

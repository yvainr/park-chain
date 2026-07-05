import { useMemo, useState } from "react";
import { CalendarClock, ChevronDown, ChevronUp, CreditCard, RefreshCw, Ticket, Wallet, X } from "lucide-react";
import { membershipManagerAbi, parkingLedgerAbi } from "../abi/contracts";
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

function CustomerCollapsiblePanel({ title, description, badge, contentClassName = "", children }: any) {
  const [isOpen, setIsOpen] = useState(false);
  const panelId = `${String(title).toLowerCase().replace(/[^a-z0-9]+/g, "-")}-panel`;

  return (
    <Card className="dev-panel-card customer-utility-card">
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

function CustomerMetric({ label, value, wide = false }: any) {
  return (
    <div className={wide ? "metric-wide" : ""}>
      <span>{label}</span>
      <strong>{value}</strong>
    </div>
  );
}

export function CustomerPage({ app }: any) {
  const calendarCells = useMemo(() => {
    const cells = new Map<string, { reservation?: any; covered: boolean }>();
    for (const reservation of app.slotCalendar.reservations) {
      const startRow = reservationStartRow(reservation, app);
      const endRow = reservationEndRow(reservation, app);
      cells.set(`${reservation.slotID}:${startRow}`, { reservation, covered: false });
      for (let row = startRow + 1; row < endRow; row++) {
        cells.set(`${reservation.slotID}:${row}`, { covered: true });
      }
    }
    return cells;
  }, [app.slotCalendar.dayStart, app.slotCalendar.reservations, app.hourSeconds, app.halfHourSeconds]);
  const selectedOperatorKnown = app.registeredOperators.some(
    (operator: any) => operator.id.toString() === app.operatorId,
  );
  const operatorOptions =
    selectedOperatorKnown || !app.operatorId
      ? app.registeredOperators
      : [{ id: app.operatorId, name: `Operator #${app.operatorId}`, wallet: "" }, ...app.registeredOperators];
  const activeMembershipTiers = app.membershipTiers.filter((tier: any) => tier.active);
  const selectedOperator = operatorOptions.find((operator: any) => operator.id.toString() === app.operatorId);
  const accountLoaded = app.memberSummary.active !== "-";
  const isMemberActive = String(app.memberSummary.active).toLowerCase() === "true";
  const memberTier = app.membershipTiers.find((tier: any) => tier.id.toString() === app.memberSummary.tier);
  const memberTierLabel = memberTier?.name ?? (accountLoaded ? "No plan" : "-");
  const shouldShowMembershipPrompt = accountLoaded && !isMemberActive;
  const isAccessOpen = Boolean(app.isCustomerAccessOpen);
  const availableSlot = app.availableSlotPreview ?? { error: "", loading: false, slotId: "" };
  const hasAvailableSlot = availableSlot.slotId && availableSlot.slotId !== "0" && !availableSlot.error;

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
    <div className="customer-flow">
      {!isMemberActive && (
        <Card className="customer-account-card">
          <CardHeader className="customer-account-header">
            <div className="customer-section-title">
              <Wallet aria-hidden="true" size={16} />
              <div>
                <CardTitle>My Account</CardTitle>
              </div>
            </div>
            <div className="customer-account-actions">
              <Button
                variant="secondary"
                className="icon-button-label"
                onClick={() => app.run("Refresh account", app.refreshMemberAccount)}
              >
                <RefreshCw aria-hidden="true" size={16} />
                Refresh
              </Button>
            </div>
          </CardHeader>
          <CardContent>
            <div className="customer-metric-grid">
              <CustomerMetric label="Credits" value={app.memberSummary.balance} />
              <CustomerMetric label="Tier" value={memberTierLabel} />
              <CustomerMetric label="Expiry" value={app.memberSummary.expiry} wide />
            </div>
          </CardContent>
        </Card>
      )}

      {shouldShowMembershipPrompt && (
        <div className="customer-membership-prompt">
          <Button onClick={() => app.setIsCustomerAccessOpen(true)} aria-haspopup="dialog">
            Buy membership
          </Button>
        </div>
      )}

      {isAccessOpen && (
        <div className="customer-modal-backdrop" role="presentation" onClick={() => app.setIsCustomerAccessOpen(false)}>
          <Card
            className="customer-access-modal"
            role="dialog"
            aria-modal="true"
            aria-labelledby="customer-access-title"
            onClick={(event: any) => event.stopPropagation()}
          >
            <CardHeader>
              <div className="customer-section-title">
                <CreditCard aria-hidden="true" size={18} />
                <div>
                  <CardTitle id="customer-access-title">Choose Access</CardTitle>
                  <CardDescription>Pick a monthly plan before booking parking or charging.</CardDescription>
                </div>
              </div>
              <Button
                variant="ghost"
                className="customer-modal-close"
                aria-label="Close membership plans"
                onClick={() => app.setIsCustomerAccessOpen(false)}
              >
                <X aria-hidden="true" size={18} />
              </Button>
            </CardHeader>
            <CardContent className="tab-panel">
              {activeMembershipTiers.length > 0 && (
                <div className="customer-tier-list">
                  {activeMembershipTiers.map((tier: any) => (
                    <button
                      key={tier.id.toString()}
                      type="button"
                      className={`customer-tier-card${tier.id.toString() === app.tierId ? " is-selected" : ""}`}
                      onClick={() => selectMembershipTier(tier.id.toString())}
                    >
                      <strong>{tier.name}</strong>
                      <span>{tier.priceWei.toString()} wei</span>
                      <small>
                        {tier.monthlyCredits.toString()} credits - {tier.monthlyHourCap.toString()} h / month
                      </small>
                    </button>
                  ))}
                </div>
              )}

              <div className="actions customer-primary-actions">
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
                      app.setIsCustomerAccessOpen(false);
                      return result;
                    })
                  }
                >
                  {isMemberActive ? "Upgrade Access" : "Buy Access"}
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
                      app.setIsCustomerAccessOpen(false);
                      return result;
                    })
                  }
                >
                  Renew Access
                </Button>
              </div>
            </CardContent>
          </Card>
        </div>
      )}

      {isMemberActive && (
        <>
          <div className="customer-main-grid">
            <div className="stack">
              <Card className="customer-workflow-card">
            <CardHeader>
              <div className="customer-section-title">
                <CalendarClock aria-hidden="true" size={18} />
                <div>
                  <CardTitle>Book a Slot</CardTitle>
                  <CardDescription>
                    {selectedOperator ? selectedOperator.name : "Select an operator"} -{" "}
                    {app.slotCalendar.dateLabel || "choose a date"}
                  </CardDescription>
                </div>
              </div>
              <Button
                variant="secondary"
                className="icon-button-label customer-booking-action-button"
                onClick={() => app.run("Refresh slot calendar", app.refreshSlotCalendar)}
              >
                <RefreshCw aria-hidden="true" size={16} />
                Slots
              </Button>
            </CardHeader>
            <CardContent className="tab-panel">
              <div className="customer-booking-grid">
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
                  <span>Parking type</span>
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
                  <span>Date and time</span>
                  <Input
                    type="datetime-local"
                    value={app.reservationStartTime}
                    onChange={(event: any) => app.setReservationStartTime(event.target.value)}
                  />
                </Label>
                <Label>
                  <span>Hours</span>
                  <Input
                    min="1"
                    step="1"
                    type="number"
                    value={app.reservationDuration}
                    onChange={(event: any) => app.setReservationDuration(event.target.value)}
                  />
                </Label>
                <Label>
                  <span>Parking place</span>
                  <Select value={app.selectedSlotId} onValueChange={app.setSelectedSlotId}>
                    <SelectTrigger aria-label="Parking place">
                      <SelectValue placeholder="Select an available place..." />
                    </SelectTrigger>
                    <SelectContent>
                      {app.slotCalendar.slots.map((slotID: bigint) => (
                        <SelectItem key={slotID.toString()} value={slotID.toString()}>
                          Slot {slotID.toString()}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </Label>
                <div className="customer-auto-slot">
                  <span>Selected place</span>
                  {availableSlot.loading && <Badge variant="secondary">Checking</Badge>}
                  {!availableSlot.loading && hasAvailableSlot && (
                    <Badge variant="success">Slot {availableSlot.slotId}</Badge>
                  )}
                  {!availableSlot.loading && !hasAvailableSlot && (
                    <Badge variant={availableSlot.error ? "error" : "secondary"}>
                      {availableSlot.error ? "Unavailable" : "Pending"}
                    </Badge>
                  )}
                </div>
                <div className="customer-booking-submit">
                  <Button
                    className="customer-booking-action-button"
                    onClick={() =>
                      app.run("Reserve", async () => {
                        const slotId = await app.refreshAvailableSlotPreview();
                        if (slotId === 0n) throw new Error("No free slot for the selected time");

                        const result = await app.txBase(app.requireLedger(), parkingLedgerAbi, "reserveSlot", [
                          toUint(app.operatorId, "Operator ID"),
                          app.categoryHash,
                          toUint(app.selectedSlotId, "Parking place"),
                          app.berlinDateTimeToUnixSeconds(app.reservationStartTime),
                          toUint(app.reservationDuration, "Duration hours"),
                        ]);
                        await app.loadLatestMemberReservation();
                        await app.refreshMemberAccount();
                        await app.refreshMemberReservations();
                        await app.refreshSlotCalendar();
                        return result;
                      })
                    }
                    disabled={availableSlot.loading || availableSlot.slotId === "0" || Boolean(availableSlot.error)}
                  >
                    Reserve
                  </Button>
                </div>
              </div>

              <div className="slot-calendar-panel customer-calendar-panel">
                <div className="slot-calendar-toolbar">
                  <div>
                    <strong>Available slots</strong>
                    <span>
                      {app.slotCalendar.capacity} slots on {app.slotCalendar.dateLabel || "selected date"}
                    </span>
                  </div>
                  {app.slotCalendar.loading && <Badge variant="secondary">Loading</Badge>}
                  {app.slotCalendar.error && <Badge variant="error">Unavailable</Badge>}
                </div>
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
                              const cell = calendarCells.get(`${slotID}:${row}`);
                              const reservation = cell?.reservation;
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

                              if (cell?.covered) return null;

                              return (
                                <TableCell key={slotID.toString()} className="slot-calendar-free-cell">
                                  <button
                                    type="button"
                                    className="slot-calendar-free-button"
                                    aria-label={`Use ${formatRowTime(row)} as the start time`}
                                    onClick={() => app.selectCalendarStartTime(rowStart, slotID)}
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
              </div>
            </CardContent>
              </Card>
            </div>

            <aside className="customer-side-stack">
              <Card className="customer-workflow-card">
            <CardHeader>
              <div className="customer-section-title">
                <Ticket aria-hidden="true" size={18} />
                <div>
                  <CardTitle>Current Reservation</CardTitle>
                  <CardDescription>{app.reservationSummary}</CardDescription>
                </div>
              </div>
              <Badge
                className="customer-reservation-status-badge"
                variant={app.canUseReservedActions || app.canCheckOutReservation ? "success" : "secondary"}
              >
                {app.reservationStatusLabel}
              </Badge>
            </CardHeader>
            <CardContent className="tab-panel">
              <div className="customer-reservation-load">
                <Label>
                  <span>Reservation</span>
                  {app.memberReservations.length > 0 ? (
                    <Select
                      value={app.reservationId}
                      onValueChange={(value: string) =>
                        app.run("Load reservation", () => app.loadReservation(toUint(value, "Reservation ID")))
                      }
                    >
                      <SelectTrigger aria-label="Select reservation">
                        <SelectValue placeholder="Select a reservation..." />
                      </SelectTrigger>
                      <SelectContent>
                        {app.memberReservations.map((reservation: any) => (
                          <SelectItem key={reservation.id.toString()} value={reservation.id.toString()}>
                            #{reservation.id.toString()} - {app.formatBerlinTime(reservation.startTime)} - Slot{" "}
                            {reservation.slotID.toString()}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  ) : (
                    <p className="customer-muted-copy">No reservations yet.</p>
                  )}
                </Label>
                <Button
                  variant="secondary"
                  className="icon-button-label"
                  onClick={() => app.run("Refresh reservations", app.refreshMemberReservations)}
                >
                  <RefreshCw aria-hidden="true" size={16} />
                </Button>
              </div>

              <div className="actions customer-reservation-actions">
                {app.canUseReservedActions && (
                  <>
                    <Button
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
                      No-Show
                    </Button>
                  </>
                )}

                {app.canCheckOutReservation && (
                  <Button
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

                {!app.canUseReservedActions && !app.canCheckOutReservation && (
                  <p className="customer-muted-copy">Reserve or load an active booking.</p>
                )}
              </div>
            </CardContent>
              </Card>
            </aside>
          </div>

          <CustomerCollapsiblePanel
            title="Customer Reads"
            description="Read membership, usage, and reservation data for the connected wallet."
            badge="Advanced"
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

          <CustomerCollapsiblePanel
            title="Developer Output"
            description="Raw transaction hashes, read results, and wallet errors."
            badge="Developer"
            contentClassName="customer-output-dev"
          >
            <pre className="customer-dev-output">{app.output}</pre>
          </CustomerCollapsiblePanel>
        </>
      )}
    </div>
  );
}

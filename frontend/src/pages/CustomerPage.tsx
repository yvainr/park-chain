import { useEffect, useMemo, useState } from "react";
import { CalendarClock, ChevronDown, ChevronUp, CircleCheck, CircleX, CreditCard, RefreshCw, Star, Ticket, Wallet, X } from "lucide-react";
import { membershipManagerAbi, operatorRegistryAbi, parkingLedgerAbi } from "../abi/contracts";
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

function reservationStartRow(reservation: any, app: any) {
  const dayStart = app.slotCalendar.dayStart;
  if (reservation.startTime <= dayStart) return 0;
  return Math.min(CALENDAR_ROWS - 1, Number((reservation.startTime - dayStart) / app.halfHourSeconds));
}

function reservationEndRow(reservation: any, app: any) {
  const end = reservationEndTime(reservation, app);
  const row = Number((end - app.slotCalendar.dayStart + app.halfHourSeconds - 1n) / app.halfHourSeconds);
  return Math.min(CALENDAR_ROWS, Math.max(1, row));
}

function reservationRowSpan(reservation: any, app: any) {
  return Math.max(1, reservationEndRow(reservation, app) - reservationStartRow(reservation, app));
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

function StarRatingSelector({ value, onChange }: { value: string; onChange: (value: string) => void }) {
  const selectedValue = Math.min(5, Math.max(1, Number(value) || 1));

  return (
    <div className="customer-star-rating" role="radiogroup" aria-label="Rating">
      {[1, 2, 3, 4, 5].map((rating) => (
        <button
          key={rating}
          type="button"
          className={rating <= selectedValue ? "is-selected" : ""}
          role="radio"
          aria-checked={rating === selectedValue}
          aria-label={`${rating} star${rating === 1 ? "" : "s"}`}
          onClick={() => onChange(String(rating))}
        >
          <Star aria-hidden="true" size={22} />
        </button>
      ))}
    </div>
  );
}

function OperatorFractionalStar({ fillPercent }: any) {
  const clampedFill = Math.max(0, Math.min(100, fillPercent));

  return (
    <span className="operator-option-star" style={{ "--star-fill": `${clampedFill}%` } as any}>
      <Star aria-hidden="true" size={13} className="operator-option-star-base" />
      <span className="operator-option-star-fill">
        <Star aria-hidden="true" size={13} />
      </span>
    </span>
  );
}

function OperatorRatingPictogram({ rating }: { rating?: { average: number; count: number } }) {
  const average = rating?.average ?? 0;
  const count = rating?.count ?? 0;

  return (
    <span className="operator-option-rating" aria-label={count > 0 ? `${rating?.average.toFixed(2)} out of 5` : "No ratings yet"}>
      <span className="operator-option-stars" aria-hidden="true">
        {[1, 2, 3, 4, 5].map((star) => {
          const fillPercent = (average - (star - 1)) * 100;
          return <OperatorFractionalStar key={star} fillPercent={fillPercent} />;
        })}
      </span>
      <small>{count > 0 ? `${rating?.average.toFixed(1)} (${count})` : "New"}</small>
    </span>
  );
}

function formatCountdown(seconds: number) {
  const clamped = Math.max(0, Math.floor(seconds));
  if (clamped < 60) return "less than 1m";

  const days = Math.floor(clamped / 86400);
  const hours = Math.floor((clamped % 86400) / 3600);
  const minutes = Math.floor((clamped % 3600) / 60);

  if (days > 0) return `${days}d ${hours}h`;
  if (hours > 0) return `${hours}h ${minutes}m`;
  return `${minutes}m`;
}

function reservationTimeState(reservation: any, app: any, nowSeconds: number) {
  if (!reservation || reservation.status > 1) return null;

  const startSeconds = Number(reservation.startTime);
  const endSeconds = Number(reservationEndTime(reservation, app));
  const durationSeconds = Math.max(1, endSeconds - startSeconds);
  const rangeLabel = `${app.formatBerlinTime(reservation.startTime)} - ${app.formatBerlinTime(
    reservationEndTime(reservation, app),
  )}`;

  if (nowSeconds < startSeconds) {
    const startsIn = startSeconds - nowSeconds;
    return {
      ariaLabel: `Reservation starts in ${formatCountdown(startsIn)}`,
      label: "Starts in",
      percent: 100,
      rangeLabel,
      value: formatCountdown(startsIn),
    };
  }

  if (nowSeconds >= endSeconds) {
    return {
      ariaLabel: "Reservation window has ended",
      label: "Time left",
      percent: 0,
      rangeLabel,
      value: "0m",
    };
  }

  const remainingSeconds = endSeconds - nowSeconds;
  return {
    ariaLabel: `${formatCountdown(remainingSeconds)} left in reservation window`,
    label: "Time left",
    percent: Math.max(0, Math.min(100, (remainingSeconds / durationSeconds) * 100)),
    rangeLabel,
    value: formatCountdown(remainingSeconds),
  };
}

function reservationDropdownStatus(reservation: any, app: any, nowSeconds: number) {
  if (reservation.status === 2) return "checked out";
  if (reservation.status >= 3) return "canceled";
  if (reservation.status === 1) return "running";

  const startSeconds = Number(reservation.startTime);
  const endSeconds = Number(reservationEndTime(reservation, app));
  return nowSeconds >= startSeconds && nowSeconds < endSeconds ? "running" : "created";
}

export function CustomerPage({ app }: any) {
  const [isCheckoutRatingOpen, setIsCheckoutRatingOpen] = useState(false);
  const [isSlotCalendarOpen, setIsSlotCalendarOpen] = useState(false);
  const [nowSeconds, setNowSeconds] = useState(Math.floor(Date.now() / 1000));
  const [operatorRatings, setOperatorRatings] = useState<Record<string, { average: number; count: number }>>({});
  const [categorySupport, setCategorySupport] = useState<Record<string, boolean>>({});
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
  }, [app.slotCalendar.dayStart, app.slotCalendar.reservations, app.halfHourSeconds]);
  const selectedOperatorKnown = app.registeredOperators.some(
    (operator: any) => operator.id.toString() === app.operatorId,
  );
  const operatorOptions =
    selectedOperatorKnown || !app.operatorId
      ? app.registeredOperators
      : [{ id: app.operatorId, name: `Operator #${app.operatorId}`, wallet: "" }, ...app.registeredOperators];
  const activeMembershipTiers = app.membershipTiers.filter((tier: any) => tier.active);
  const accountLoaded = app.memberSummary.active !== "-";
  const isMemberActive = String(app.memberSummary.active).toLowerCase() === "true";
  const memberTier = app.membershipTiers.find((tier: any) => tier.id.toString() === app.memberSummary.tier);
  const memberTierLabel = memberTier?.name ?? (accountLoaded ? "No plan" : "-");
  const shouldShowMembershipPrompt = accountLoaded && !isMemberActive;
  const isAccessOpen = Boolean(app.isCustomerAccessOpen);
  const availableSlot = app.availableSlotPreview ?? { error: "", loading: false, slotId: "" };
  const hasAvailableSlot = availableSlot.slotId && availableSlot.slotId !== "0" && !availableSlot.error;
  const operatorRatingKey = operatorOptions.map((operator: any) => operator.id.toString()).join(",");
  const currentReservations = app.memberReservations.filter(
    (reservation: any) => reservation.status === 0 || reservation.status === 1,
  );
  const selectedReservationIsCurrent =
    Boolean(app.selectedReservation) && (app.selectedReservation.status === 0 || app.selectedReservation.status === 1);
  const hasCurrentReservations = currentReservations.length > 0 || selectedReservationIsCurrent;
  const selectedCurrentReservationId = currentReservations.some(
    (reservation: any) => reservation.id.toString() === app.reservationId,
  )
    ? app.reservationId
    : "";
  const reservationProgress = selectedReservationIsCurrent
    ? reservationTimeState(app.selectedReservation, app, nowSeconds)
    : null;

  useEffect(() => {
    setIsCheckoutRatingOpen(false);
  }, [app.reservationId]);

  useEffect(() => {
    if (!app.selectedReservation || app.selectedReservation.status > 1) return;

    setNowSeconds(Math.floor(Date.now() / 1000));
    const timer = window.setInterval(() => {
      setNowSeconds(Math.floor(Date.now() / 1000));
    }, 1000);

    return () => window.clearInterval(timer);
  }, [
    app.selectedReservation?.duration?.toString(),
    app.selectedReservation?.id?.toString(),
    app.selectedReservation?.startTime?.toString(),
    app.selectedReservation?.status,
  ]);

  useEffect(() => {
    let cancelled = false;

    async function loadOperatorRatings() {
      if (!app.ledgerAddress || operatorOptions.length === 0) {
        setOperatorRatings({});
        return;
      }

      let ledger;
      try {
        ledger = app.requireLedger();
      } catch {
        setOperatorRatings({});
        return;
      }

      const entries = await Promise.all(
        operatorOptions.map(async (operator: any) => {
          const operatorId = toUint(operator.id.toString(), "Operator ID");
          try {
            const [averageRaw, ratingRaw] = await Promise.all([
              readContract({
                address: ledger,
                abi: parkingLedgerAbi,
                functionName: "calcAvgRating",
                args: [operatorId],
              }),
              readContract({
                address: ledger,
                abi: parkingLedgerAbi,
                functionName: "operatorRatings",
                args: [operatorId],
              }),
            ]);
            const count = Number((ratingRaw as any).ratingCount ?? (ratingRaw as any)[1] ?? 0);
            return [operator.id.toString(), { average: Number(averageRaw) / 100, count }] as const;
          } catch {
            return [operator.id.toString(), { average: 0, count: 0 }] as const;
          }
        }),
      );

      if (!cancelled) setOperatorRatings(Object.fromEntries(entries));
    }

    void loadOperatorRatings();
    return () => {
      cancelled = true;
    };
  }, [app.ledgerAddress, operatorRatingKey]);

  useEffect(() => {
    let cancelled = false;

    async function loadCategorySupport() {
      if (!app.registryAddress || !app.operatorId) {
        setCategorySupport({});
        return;
      }

      try {
        const registry = app.requireRegistry();
        const operatorId = toUint(app.operatorId, "Operator ID");
        const entries = await Promise.all(
          app.categoryNames.map(async (name: CategoryName) => {
            const supported = await readContract({
              address: registry,
              abi: operatorRegistryAbi,
              functionName: "supportsCategory",
              args: [operatorId, app.categoryHashForName(name)],
            });
            return [name, Boolean(supported)] as const;
          }),
        );

        if (!cancelled) setCategorySupport(Object.fromEntries(entries));
      } catch {
        if (!cancelled) setCategorySupport({});
      }
    }

    void loadCategorySupport();
    return () => {
      cancelled = true;
    };
  }, [app.registryAddress, app.operatorId]);

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

  const hasReservationPriority = hasCurrentReservations;

  return (
    <div className={`customer-flow${hasReservationPriority ? " has-reservation-priority" : ""}`}>
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
                      <span className="customer-tier-price">{tier.priceWei.toString()} wei</span>
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
                          <span className="operator-option-row">
                            <span className="operator-option-name">{operator.name} (ID {operator.id.toString()})</span>
                            <OperatorRatingPictogram rating={operatorRatings[operator.id.toString()]} />
                          </span>
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
                      {app.categoryNames.map((name: CategoryName) => {
                        const forbidden = categorySupport[name] === false;
                        return (
                          <SelectItem key={name} value={name} disabled={forbidden}>
                            {name}{forbidden ? " — not available" : ""}
                          </SelectItem>
                        );
                      })}
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
                <div className="customer-booking-submit">
                  <div className="customer-free-slot-status">
                    {availableSlot.loading && <Badge variant="secondary">Checking free slot</Badge>}
                    {!availableSlot.loading && hasAvailableSlot && (
                      <Badge variant="success">
                        <CircleCheck aria-hidden="true" size={14} />
                        Free slot found
                      </Badge>
                    )}
                    {!availableSlot.loading && !hasAvailableSlot && (
                      <Badge variant="error">
                        <CircleX aria-hidden="true" size={14} />
                        Free slot not found
                      </Badge>
                    )}
                  </div>
                  <div className="customer-booking-submit-action">
                    <Button
                      className="customer-booking-action-button"
                      onClick={() =>
                        app.run("Reserve", async () => {
                          const slotId = await app.refreshAvailableSlotPreview();
                          if (slotId === 0n) throw new Error("No free slot for the selected time");

                          const result = await app.txBase(app.requireLedger(), parkingLedgerAbi, "reserve", [
                            toUint(app.operatorId, "Operator ID"),
                            app.categoryHash,
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
              </div>

              <div className="slot-calendar-panel customer-calendar-panel">
                <div className="dev-panel-header slot-calendar-toolbar">
                  <div className="dev-panel-heading">
                    <div className="dev-panel-title-row">
                      <CardTitle>Available slots</CardTitle>
                      {app.slotCalendar.loading && <Badge variant="secondary">Loading</Badge>}
                      {app.slotCalendar.error && <Badge variant="error">Unavailable</Badge>}
                    </div>
                    <CardDescription>
                      {app.slotCalendar.capacity} slots on {app.slotCalendar.dateLabel || "selected date"}
                    </CardDescription>
                  </div>
                  <Button
                    variant="ghost"
                    className="dev-panel-toggle slot-calendar-toggle-button"
                    aria-expanded={isSlotCalendarOpen}
                    onClick={() => setIsSlotCalendarOpen((open) => !open)}
                  >
                    {isSlotCalendarOpen ? "Hide" : "Show"}
                    {isSlotCalendarOpen ? <ChevronUp aria-hidden="true" size={16} /> : <ChevronDown aria-hidden="true" size={16} />}
                  </Button>
                </div>
                <div
                  className={`slot-calendar-content${isSlotCalendarOpen ? " is-open" : ""}`}
                  aria-hidden={!isSlotCalendarOpen}
                  inert={!isSlotCalendarOpen}
                >
                  <div className="slot-calendar-content-inner">
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
                                        <button
                                          type="button"
                                          className="slot-calendar-booking"
                                          onClick={() =>
                                            app.run("Load reservation", () =>
                                              app.loadReservation(toUint(reservation.id.toString(), "Reservation ID")),
                                            )
                                          }
                                          aria-label={`Load reservation ${reservation.id.toString()}`}
                                        >
                                          <strong>
                                            {app.formatBerlinTime(reservation.startTime)} -{" "}
                                            {app.formatBerlinTime(reservationEndTime(reservation, app))}
                                          </strong>
                                          <span>
                                            #{reservation.id.toString()} - {reservation.status === 1 ? "Checked in" : "Reserved"}
                                          </span>
                                        </button>
                                      </TableCell>
                                    );
                                  }

                                  if (cell?.covered) return null;

                                  return (
                                    <TableCell key={slotID.toString()} className="slot-calendar-free-cell">
                                      <button
                                        type="button"
                                        className="slot-calendar-free-button"
                                        aria-label={`Use ${formatRowTime(row)} as the reservation start`}
                                        onClick={() => app.selectCalendarStartTime(rowStart)}
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
                </div>
              </div>
            </CardContent>
              </Card>
            </div>

            <aside className="customer-side-stack">
              <Card
                className={`customer-workflow-card customer-current-reservation-card${
                  hasCurrentReservations ? "" : " is-empty-mobile"
                }`}
              >
            <CardHeader>
              <div className="customer-section-title">
                <Ticket aria-hidden="true" size={18} />
                <div>
                  <CardTitle>Current Reservation</CardTitle>
                  <CardDescription>
                    {selectedReservationIsCurrent ? app.reservationSummary : "No running or planned reservation"}
                  </CardDescription>
                </div>
              </div>
              <Badge
                className="customer-reservation-status-badge"
                variant={selectedReservationIsCurrent && (app.canUseReservedActions || app.canCheckOutReservation) ? "success" : "secondary"}
              >
                {selectedReservationIsCurrent ? app.reservationStatusLabel : "No current reservation"}
              </Badge>
            </CardHeader>
            <CardContent className="tab-panel">
              <div className="customer-reservation-load">
                <Label>
                  <span>Reservation</span>
                  {currentReservations.length > 0 ? (
                    <Select
                      value={selectedCurrentReservationId}
                      onValueChange={(value: string) =>
                        app.run("Load reservation", () => app.loadReservation(toUint(value, "Reservation ID")))
                      }
                    >
                      <SelectTrigger aria-label="Select reservation">
                        <SelectValue placeholder="Select a reservation..." />
                      </SelectTrigger>
                      <SelectContent>
                        {currentReservations.map((reservation: any) => {
                          const dropdownStatus = reservationDropdownStatus(reservation, app, nowSeconds);
                          return (
                            <SelectItem key={reservation.id.toString()} value={reservation.id.toString()}>
                              <span className="reservation-option-row">
                                <span className="reservation-option-main">
                                  #{reservation.id.toString()} - {app.formatBerlinTime(reservation.startTime)} - Slot{" "}
                                  {reservation.slotID.toString()}
                                </span>
                                <span
                                  className={`reservation-option-badge reservation-option-badge-${dropdownStatus.replace(
                                    " ",
                                    "-",
                                  )}`}
                                >
                                  {dropdownStatus}
                                </span>
                              </span>
                            </SelectItem>
                          );
                        })}
                      </SelectContent>
                    </Select>
                  ) : (
                    <p className="customer-muted-copy">No running or planned reservations.</p>
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

              {reservationProgress && (
                <div className="customer-reservation-progress">
                  <div className="customer-reservation-progress-copy">
                    <span>{reservationProgress.label}</span>
                    <strong className={reservationProgress.value === "less than 1m" ? "is-compact" : ""}>
                      {reservationProgress.value}
                    </strong>
                  </div>
                  <div
                    className="customer-reservation-progress-track"
                    role="progressbar"
                    aria-valuemin={0}
                    aria-valuemax={100}
                    aria-valuenow={Math.round(reservationProgress.percent)}
                    aria-valuetext={reservationProgress.ariaLabel}
                  >
                    <span style={{ "--reservation-progress": `${reservationProgress.percent}%` } as any} />
                  </div>
                  <small>{reservationProgress.rangeLabel}</small>
                </div>
              )}

              <div className="actions customer-reservation-actions">
                {selectedReservationIsCurrent && app.canUseReservedActions && (
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

                {selectedReservationIsCurrent && app.canCheckOutReservation && (
                  <>
                    {isCheckoutRatingOpen && (
                      <div className="customer-rating-panel">
                        <span>Rating</span>
                        <p>Please rate the service.</p>
                        <StarRatingSelector value={app.checkoutRating} onChange={app.setCheckoutRating} />
                      </div>
                    )}
                    <Button
                      onClick={() => {
                        if (!isCheckoutRatingOpen) {
                          setIsCheckoutRatingOpen(true);
                          return;
                        }

                        return app.run("Check out", async () => {
                          const result = await app.txBase(app.requireLedger(), parkingLedgerAbi, "checkOutWithRating", [
                            toUint(app.reservationId, "Reservation ID"),
                            toUint(app.checkoutRating, "Rating"),
                          ]);
                          await app.refreshSelectedReservation();
                          await app.refreshMemberReservations();
                          await app.refreshSlotCalendar();
                          setIsCheckoutRatingOpen(false);
                          return result;
                        });
                      }}
                    >
                      {isCheckoutRatingOpen ? "Submit Check Out" : "Check Out"}
                    </Button>
                  </>
                )}

                {(!selectedReservationIsCurrent || (!app.canUseReservedActions && !app.canCheckOutReservation)) && (
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

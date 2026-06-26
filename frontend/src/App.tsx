import { useMemo, useState } from "react";
import { type Hex, keccak256, toBytes } from "viem";
import {
  membershipManagerAbi,
  operatorRegistryAbi,
  operatorTreasuryAbi,
  parkCreditAbi,
  parkingLedgerAbi,
} from "./abi/contracts";
import { connectWallet, readContract, toAddress, toUint, writeContract } from "./lib/wallet";

const CATEGORY_NAMES = ["standard", "disabled", "ev-charging", "motorbike", "family", "women"] as const;
const PARK_CREDIT_ID = 1n;
const ZERO_ADDRESS = "0x0000000000000000000000000000000000000000";
const BERLIN_TIME_ZONE = "Europe/Berlin";
const HOUR_SECONDS = 3600n;
const MEMBERSHIP_TIERS = [
  { id: "1", name: "Urban", credits: "80", priceWei: "10000000000000000", priceEth: "0.01 ETH", cap: "20 h" },
  { id: "2", name: "Commuter", credits: "200", priceWei: "20000000000000000", priceEth: "0.02 ETH", cap: "60 h" },
  { id: "3", name: "Unlimited", credits: "400", priceWei: "30000000000000000", priceEth: "0.03 ETH", cap: "120 h" },
] as const;
const DURATION_HOUR_OPTIONS = ["1", "2", "4", "8"] as const;

type CategoryName = (typeof CATEGORY_NAMES)[number];
type Tab = "admin" | "member" | "operator" | "reads";
type ReservationView = {
  member: string;
  status: number;
  startTime: bigint;
};
type MemberSummary = {
  balance: string;
  active: string;
  tier: string;
  cap: string;
  expiry: string;
  reservations: string;
};

const RESERVATION_STATUS_LABELS = ["Reserved", "Checked in", "Checked out", "Cancelled", "No-show"] as const;

function cn(...classes: Array<string | false | null | undefined>) {
  return classes.filter(Boolean).join(" ");
}

function Button({ variant = "default", className = "", ...props }: any) {
  return <button className={cn("ui-button", `ui-button-${variant}`, className)} {...props} />;
}

function Card({ className = "", ...props }: any) {
  return <section className={cn("ui-card", className)} {...props} />;
}

function CardHeader({ className = "", ...props }: any) {
  return <div className={cn("ui-card-header", className)} {...props} />;
}

function CardTitle({ className = "", ...props }: any) {
  return <h2 className={cn("ui-card-title", className)} {...props} />;
}

function CardDescription({ className = "", ...props }: any) {
  return <p className={cn("ui-card-description", className)} {...props} />;
}

function CardContent({ className = "", ...props }: any) {
  return <div className={cn("ui-card-content", className)} {...props} />;
}

function Input(props: any) {
  return <input className="ui-input" {...props} />;
}

function Select(props: any) {
  return <select className="ui-select" {...props} />;
}

function Checkbox(props: any) {
  return <input className="ui-checkbox" type="checkbox" {...props} />;
}

function Label({ className = "", ...props }: any) {
  return <label className={cn("ui-label", className)} {...props} />;
}

function Badge({ variant = "secondary", className = "", ...props }: any) {
  return <span className={cn("ui-badge", `ui-badge-${variant}`, className)} {...props} />;
}

function formatReadResult(result: unknown) {
  if (typeof result === "bigint") return result.toString();
  if (typeof result === "boolean") return String(result);
  if (typeof result === "object" && result !== null) {
    return JSON.stringify(
      result,
      (_key, value) => (typeof value === "bigint" ? value.toString() : value),
      2,
    );
  }
  return String(result ?? "");
}

function formatExpiry(value: unknown) {
  const expiry = typeof value === "bigint" ? value : BigInt(String(value || 0));
  if (expiry === 0n) return "0";
  return `${expiry.toString()} (${new Date(Number(expiry) * 1000).toLocaleString()})`;
}

function formatBerlinDateTimeInput(timestampSeconds: number) {
  const parts = new Intl.DateTimeFormat("sv-SE", {
    timeZone: BERLIN_TIME_ZONE,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    hour12: false,
  }).formatToParts(new Date(timestampSeconds * 1000));
  const part = (type: string) => parts.find((entry) => entry.type === type)?.value ?? "00";
  return `${part("year")}-${part("month")}-${part("day")}T${part("hour")}:${part("minute")}`;
}

function berlinDateTimeToUnixSeconds(value: string) {
  const match = /^(\d{4})-(\d{2})-(\d{2})T(\d{2}):(\d{2})$/.exec(value.trim());
  if (!match) {
    throw new Error("Start time must be a Berlin date and time");
  }

  const year = Number(match[1]);
  const month = Number(match[2]);
  const day = Number(match[3]);
  const hour = Number(match[4]);
  const minute = Number(match[5]);
  const utcGuess = Date.UTC(year, month - 1, day, hour, minute);
  const offset = getTimeZoneOffsetMs(new Date(utcGuess), BERLIN_TIME_ZONE);
  return BigInt(Math.floor((utcGuess - offset) / 1000));
}

function getTimeZoneOffsetMs(date: Date, timeZone: string) {
  const parts = new Intl.DateTimeFormat("en-US", {
    timeZone,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    second: "2-digit",
    hour12: false,
  }).formatToParts(date);
  const part = (type: string) => Number(parts.find((entry) => entry.type === type)?.value ?? 0);
  const zonedAsUtc = Date.UTC(part("year"), part("month") - 1, part("day"), part("hour"), part("minute"), part("second"));
  return zonedAsUtc - date.getTime();
}

function categoryToBytes32(name: CategoryName, customCategory: string) {
  const custom = customCategory.trim();
  if (custom) {
    if (!/^0x[0-9a-fA-F]{64}$/.test(custom)) {
      throw new Error("Custom category must be a bytes32 hex value");
    }
    return custom as Hex;
  }

  return keccak256(toBytes(name));
}

function parseReservation(result: any): ReservationView {
  return {
    member: String(result.member ?? result[1] ?? ZERO_ADDRESS),
    status: Number(result.status ?? result[7] ?? 0),
    startTime: BigInt(result.startTime ?? result[4] ?? 0),
  };
}

function isExistingReservation(reservation: ReservationView | null) {
  return Boolean(reservation && reservation.member.toLowerCase() !== ZERO_ADDRESS);
}

export function App() {
  const [account, setAccount] = useState("");
  const [activeTab, setActiveTab] = useState<Tab>("member");
  const [creditAddress, setCreditAddress] = useState("");
  const [membershipAddress, setMembershipAddress] = useState("");
  const [registryAddress, setRegistryAddress] = useState("");
  const [treasuryAddress, setTreasuryAddress] = useState("");
  const [ledgerAddress, setLedgerAddress] = useState("");
  const [tierId, setTierId] = useState("1");
  const [tierName, setTierName] = useState("Urban");
  const [tierCredits, setTierCredits] = useState("80");
  const [tierPriceWei, setTierPriceWei] = useState("10000000000000000");
  const [tierHourCap, setTierHourCap] = useState("20");
  const [tierActive, setTierActive] = useState(true);
  const [memberLookup, setMemberLookup] = useState("");
  const [operatorId, setOperatorId] = useState("1");
  const [operatorWallet, setOperatorWallet] = useState("");
  const [operatorName, setOperatorName] = useState("Central Garage");
  const [categoryName, setCategoryName] = useState<CategoryName>("standard");
  const [customCategory, setCustomCategory] = useState("");
  const [categoryEnabled, setCategoryEnabled] = useState(true);
  const [pricePerHour, setPricePerHour] = useState("10");
  const [noShowFee, setNoShowFee] = useState("5");
  const [allocator, setAllocator] = useState("");
  const [creditRate, setCreditRate] = useState("1000000000000000");
  const [gracePeriodMinutes, setGracePeriodMinutes] = useState("15");
  const [reservationId, setReservationId] = useState("0");
  const [reservationStartTime, setReservationStartTime] = useState(formatBerlinDateTimeInput(Math.floor(Date.now() / 1000) + 3600));
  const [reservationDurationHours, setReservationDurationHours] = useState("2");
  const [selectedReservation, setSelectedReservation] = useState<ReservationView | null>(null);
  const [memberSummary, setMemberSummary] = useState<MemberSummary>({
    balance: "-",
    active: "-",
    tier: "-",
    cap: "-",
    expiry: "-",
    reservations: "-",
  });
  const [monthKey, setMonthKey] = useState("");
  const [selectedCategories, setSelectedCategories] = useState<Record<CategoryName, boolean>>({
    standard: true,
    disabled: false,
    "ev-charging": true,
    motorbike: false,
    "family": false,
    "women": false,
  });
  const [output, setOutput] = useState("Connect a wallet and paste contract addresses to begin.");

  const categoryHash = useMemo(
    () => categoryToBytes32(categoryName, customCategory),
    [categoryName, customCategory],
  );

  async function run(label: string, action: () => Promise<unknown>) {
    try {
      setOutput(`${label}...`);
      const result = await action();
      setOutput(`${label} complete\n${formatReadResult(result)}`);
    } catch (error) {
      setOutput(`${label} failed\n${error instanceof Error ? error.message : String(error)}`);
    }
  }

  async function connect() {
    const connected = await connectWallet();
    setAccount(connected);
    return connected;
  }

  function requireAccount() {
    if (!account) throw new Error("Connect wallet first");
    return toAddress(account, "Connected account");
  }

  function requireCredit() {
    return toAddress(creditAddress, "ParkCredit address");
  }

  function requireMembership() {
    return toAddress(membershipAddress, "MembershipManager address");
  }

  function requireRegistry() {
    return toAddress(registryAddress, "OperatorRegistry address");
  }

  function requireTreasury() {
    return toAddress(treasuryAddress, "OperatorTreasury address");
  }

  function requireLedger() {
    return toAddress(ledgerAddress, "ParkingLedger address");
  }

  async function pasteAddress(setValue: (value: string) => void, label: string) {
    const value = await navigator.clipboard.readText();
    setValue(toAddress(value, label));
    return `${label} pasted`;
  }

  function memberReadAddress() {
    const target = memberLookup.trim() || account;
    if (!target) throw new Error("Connect wallet or enter a member address");
    return toAddress(target, "Member address");
  }

  function connectedMemberAddress() {
    return requireAccount();
  }

  function selectedMembershipTier() {
    return MEMBERSHIP_TIERS.find((tier) => tier.id === tierId) ?? MEMBERSHIP_TIERS[0];
  }

  function selectedCategoryHashes() {
    return CATEGORY_NAMES.filter((name) => selectedCategories[name]).map((name) => keccak256(toBytes(name)));
  }

  function txBase(address: `0x${string}`, abi: any, functionName: string, args: readonly unknown[], value?: bigint) {
    return writeContract({
      account: requireAccount(),
      address,
      abi,
      functionName,
      args,
      value,
    });
  }

  async function loadReservation(id = toUint(reservationId, "Reservation ID")) {
    const result = await readContract({
      address: requireLedger(),
      abi: parkingLedgerAbi,
      functionName: "getReservation",
      args: [id],
    });
    const reservation = parseReservation(result);
    setSelectedReservation(isExistingReservation(reservation) ? reservation : null);
    return result;
  }

  async function setLatestMemberReservation() {
    const ids = (await readContract({
      address: requireLedger(),
      abi: parkingLedgerAbi,
      functionName: "getMemberReservations",
      args: [requireAccount()],
    })) as bigint[];

    const latestId = ids.at(-1);
    if (latestId === undefined) {
      setSelectedReservation(null);
      return "No reservations found";
    }

    setReservationId(latestId.toString());
    await loadReservation(latestId);
    return latestId.toString();
  }

  async function refreshSelectedReservationAfter(hash: unknown) {
    await loadReservation();
    return hash;
  }

  async function purchaseSelectedTier() {
    const tier = selectedMembershipTier();
    setTierId(tier.id);
    setTierPriceWei(tier.priceWei);
    const hash = await txBase(
      requireMembership(),
      membershipManagerAbi,
      "purchaseMembership",
      [toUint(tier.id, "Tier ID")],
      toUint(tier.priceWei, "Membership payment wei"),
    );
    await refreshMemberAccount();
    return hash;
  }

  async function renewSelectedTier() {
    const tier = selectedMembershipTier();
    setTierId(tier.id);
    setTierPriceWei(tier.priceWei);
    const hash = await txBase(
      requireMembership(),
      membershipManagerAbi,
      "renewMembership",
      [toUint(tier.id, "Tier ID")],
      toUint(tier.priceWei, "Membership payment wei"),
    );
    await refreshMemberAccount();
    return hash;
  }

  async function refreshMemberAccount() {
    const member = connectedMemberAddress();
    const [balance, active, tier, cap, expiry, reservations] = await Promise.all([
      readContract({
        address: requireCredit(),
        abi: parkCreditAbi,
        functionName: "balanceOf",
        args: [member, PARK_CREDIT_ID],
      }),
      readContract({
        address: requireMembership(),
        abi: membershipManagerAbi,
        functionName: "isMemberActive",
        args: [member],
      }),
      readContract({
        address: requireMembership(),
        abi: membershipManagerAbi,
        functionName: "getMemberTier",
        args: [member],
      }),
      readContract({
        address: requireMembership(),
        abi: membershipManagerAbi,
        functionName: "getMemberMonthlyHourCap",
        args: [member],
      }),
      readContract({
        address: requireMembership(),
        abi: membershipManagerAbi,
        functionName: "getMembershipExpiry",
        args: [member],
      }),
      readContract({
        address: requireLedger(),
        abi: parkingLedgerAbi,
        functionName: "getMemberReservations",
        args: [member],
      }),
    ]);

    setMemberSummary({
      balance: formatReadResult(balance),
      active: String(active),
      tier: formatReadResult(tier),
      cap: `${formatReadResult(cap)} h`,
      expiry: formatExpiry(expiry),
      reservations: Array.isArray(reservations) ? reservations.map((id) => id.toString()).join(", ") || "-" : "-",
    });

    return {
      balance,
      active,
      tier,
      cap,
      expiry: formatExpiry(expiry),
      reservations,
    };
  }

  async function reserveSlot() {
    const durationHours = toUint(reservationDurationHours, "Duration hours");
    const hash = await txBase(requireLedger(), parkingLedgerAbi, "reserve", [
      toUint(operatorId, "Operator ID"),
      categoryHash,
      berlinDateTimeToUnixSeconds(reservationStartTime),
      durationHours * HOUR_SECONDS,
    ]);
    const latestId = await setLatestMemberReservation();
    await refreshMemberAccount();
    return `Transaction: ${formatReadResult(hash)}\nReservation ID: ${latestId}`;
  }

  const reservationExists = isExistingReservation(selectedReservation);
  const selectedReservationStatus = selectedReservation?.status;
  const selectedReservationLabel =
    selectedReservationStatus === undefined
      ? "No reservation loaded"
      : (RESERVATION_STATUS_LABELS[selectedReservationStatus] ?? `Status ${selectedReservationStatus}`);
  const canUseReservedActions = reservationExists && selectedReservationStatus === 0;
  const canCheckOut = reservationExists && selectedReservationStatus === 1;
  const canMarkNoShow = canUseReservedActions;
  const selectedTier = selectedMembershipTier();

  return (
    <main className="app-shell">
      <section className="hero">
        <div className="hero-copy">
          <Badge variant={account ? "success" : "secondary"}>ParkChain MVP</Badge>
          <h1>Membership, Operator Registry, and Treasury</h1>
          <p>Manage member tiers, ParkCredit balances, operator onboarding, category pricing, and treasury actions.</p>
        </div>
        <Button onClick={() => run("Connect wallet", connect)}>
          {account ? `${account.slice(0, 6)}...${account.slice(-4)}` : "Connect Wallet"}
        </Button>
      </section>

      <div className="status-strip">
        <Badge variant={account ? "success" : "secondary"}>{account ? "Wallet connected" : "Wallet disconnected"}</Badge>
        <span>{creditAddress ? "ParkCredit address set" : "ParkCredit address missing"}</span>
        <span>{membershipAddress ? "Membership address set" : "Membership address missing"}</span>
        <span>{registryAddress ? "Registry address set" : "Registry address missing"}</span>
        <span>{treasuryAddress ? "Treasury address set" : "Treasury address missing"}</span>
        <span>{ledgerAddress ? "Ledger address set" : "Ledger address missing"}</span>
      </div>

      <details className="shared-inputs contract-addresses">
        <summary>
          <span>Contract Addresses</span>
          <span>{[creditAddress, membershipAddress, registryAddress, treasuryAddress, ledgerAddress].filter(Boolean).length}/5 set</span>
        </summary>
        <div className="grid two shared-inputs-content">
          <Label>
            <span>ParkCredit address</span>
            <div className="paste-row">
              <Input value={creditAddress} onChange={(event: any) => setCreditAddress(event.target.value)} />
              <Button variant="secondary" onClick={() => run("Paste ParkCredit address", () => pasteAddress(setCreditAddress, "ParkCredit address"))}>
                Paste
              </Button>
            </div>
          </Label>
          <Label>
            <span>MembershipManager address</span>
            <div className="paste-row">
              <Input value={membershipAddress} onChange={(event: any) => setMembershipAddress(event.target.value)} />
              <Button
                variant="secondary"
                onClick={() => run("Paste MembershipManager address", () => pasteAddress(setMembershipAddress, "MembershipManager address"))}
              >
                Paste
              </Button>
            </div>
          </Label>
          <Label>
            <span>OperatorRegistry address</span>
            <div className="paste-row">
              <Input value={registryAddress} onChange={(event: any) => setRegistryAddress(event.target.value)} />
              <Button
                variant="secondary"
                onClick={() => run("Paste OperatorRegistry address", () => pasteAddress(setRegistryAddress, "OperatorRegistry address"))}
              >
                Paste
              </Button>
            </div>
          </Label>
          <Label>
            <span>OperatorTreasury address</span>
            <div className="paste-row">
              <Input value={treasuryAddress} onChange={(event: any) => setTreasuryAddress(event.target.value)} />
              <Button
                variant="secondary"
                onClick={() => run("Paste OperatorTreasury address", () => pasteAddress(setTreasuryAddress, "OperatorTreasury address"))}
              >
                Paste
              </Button>
            </div>
          </Label>
          <Label>
            <span>ParkingLedger address</span>
            <div className="paste-row">
              <Input value={ledgerAddress} onChange={(event: any) => setLedgerAddress(event.target.value)} />
              <Button variant="secondary" onClick={() => run("Paste ParkingLedger address", () => pasteAddress(setLedgerAddress, "ParkingLedger address"))}>
                Paste
              </Button>
            </div>
          </Label>
        </div>
      </details>

      <div className="workspace-layout">
        <Card className="workspace-card">
          <CardHeader className="workspace-header">
            <div>
              <CardTitle>Actions</CardTitle>
              <CardDescription>Select a role surface and submit contract calls.</CardDescription>
            </div>
            <div className="tabs-list">
              {(["admin", "member", "operator", "reads"] as const).map((tab) => (
                <Button key={tab} variant={activeTab === tab ? "default" : "ghost"} onClick={() => setActiveTab(tab)}>
                  {tab[0].toUpperCase() + tab.slice(1)}
                </Button>
              ))}
            </div>
        </CardHeader>

        {activeTab === "admin" && (
          <CardContent className="tab-panel">
            <div className="grid two">
              <Label>
                <span>Operator wallet</span>
                <Input value={operatorWallet} onChange={(event: any) => setOperatorWallet(event.target.value)} />
              </Label>
              <Label>
                <span>Operator name</span>
                <Input value={operatorName} onChange={(event: any) => setOperatorName(event.target.value)} />
              </Label>
            </div>

            <div className="category-card">
              <div>
                <h3>Registration categories</h3>
                <p>Selected categories are hashed to bytes32 with viem before registration.</p>
              </div>
              <div className="checks">
                {CATEGORY_NAMES.map((name) => (
                  <Label className="check-row" key={name}>
                    <Checkbox
                      checked={selectedCategories[name]}
                      onChange={(event: any) =>
                        setSelectedCategories({ ...selectedCategories, [name]: event.target.checked })
                      }
                    />
                    <span>{name}</span>
                  </Label>
                ))}
              </div>
            </div>

            <div className="actions">
              <Button
                onClick={() =>
                  run("Register operator", () =>
                    txBase(requireRegistry(), operatorRegistryAbi, "registerOperator", [
                      toUint(operatorId, "Operator ID"),
                      toAddress(operatorWallet, "Operator wallet"),
                      operatorName,
                      selectedCategoryHashes(),
                    ]),
                  )
                }
              >
                Register Operator
              </Button>
              <Button
                variant="secondary"
                onClick={() =>
                  run("Remove operator", () =>
                    txBase(requireRegistry(), operatorRegistryAbi, "removeOperator", [toUint(operatorId, "Operator ID")]),
                  )
                }
              >
                Remove Operator
              </Button>
              <Button
                variant="secondary"
                onClick={() =>
                  run("Set supported category", () =>
                    txBase(requireRegistry(), operatorRegistryAbi, "setSupportedCategory", [
                      toUint(operatorId, "Operator ID"),
                      categoryHash,
                      categoryEnabled,
                    ]),
                  )
                }
              >
                Set Category
              </Button>
              <Label className="switch-row">
                <Checkbox checked={categoryEnabled} onChange={(event: any) => setCategoryEnabled(event.target.checked)} />
                <span>Category enabled</span>
              </Label>
            </div>

            <div className="grid two">
              <Label>
                <span>Tier name</span>
                <Input value={tierName} onChange={(event: any) => setTierName(event.target.value)} />
              </Label>
              <Label>
                <span>Monthly credits</span>
                <Input value={tierCredits} onChange={(event: any) => setTierCredits(event.target.value)} />
              </Label>
              <Label>
                <span>Tier price wei</span>
                <Input value={tierPriceWei} onChange={(event: any) => setTierPriceWei(event.target.value)} />
              </Label>
              <Label>
                <span>Monthly hour cap</span>
                <Input value={tierHourCap} onChange={(event: any) => setTierHourCap(event.target.value)} />
              </Label>
            </div>

            <div className="actions">
              <Button
                variant="secondary"
                onClick={() =>
                  run("Set membership tier", () =>
                    txBase(requireMembership(), membershipManagerAbi, "setTier", [
                      toUint(tierId, "Tier ID"),
                      tierName,
                      toUint(tierCredits, "Monthly credits"),
                      toUint(tierPriceWei, "Tier price wei"),
                      toUint(tierHourCap, "Monthly hour cap"),
                      tierActive,
                    ]),
                  )
                }
              >
                Set Tier
              </Button>
              <Label className="switch-row">
                <Checkbox checked={tierActive} onChange={(event: any) => setTierActive(event.target.checked)} />
                <span>Tier active</span>
              </Label>
            </div>

            <div className="grid two">
              <Label>
                <span>Treasury allocator</span>
                <Input value={allocator} onChange={(event: any) => setAllocator(event.target.value)} />
              </Label>
              <Label>
                <span>Wei per credit</span>
                <Input value={creditRate} onChange={(event: any) => setCreditRate(event.target.value)} />
              </Label>
            </div>

            <div className="actions">
              <Button
                variant="secondary"
                onClick={() =>
                  run("Set allocator", () =>
                    txBase(requireTreasury(), operatorTreasuryAbi, "setAllocator", [
                      toAddress(allocator, "Treasury allocator"),
                    ]),
                  )
                }
              >
                Set Allocator
              </Button>
              <Button
                variant="secondary"
                onClick={() =>
                  run("Set exchange rate", () =>
                    txBase(requireTreasury(), operatorTreasuryAbi, "setCreditToEthRate", [
                      toUint(creditRate, "Wei per credit"),
                    ]),
                  )
                }
              >
                Set Exchange Rate
              </Button>
            </div>

            <div className="grid two">
              <Label>
                <span>Grace period minutes</span>
                <Input value={gracePeriodMinutes} onChange={(event: any) => setGracePeriodMinutes(event.target.value)} />
              </Label>
            </div>

            <div className="actions">
              <Button
                variant="secondary"
                onClick={() =>
                  run("Set grace period", () =>
                    txBase(requireLedger(), parkingLedgerAbi, "setGracePeriodMinutes", [
                      toUint(gracePeriodMinutes, "Grace period minutes"),
                    ]),
                  )
                }
              >
                Set Grace Period
              </Button>
            </div>
          </CardContent>
        )}

        {activeTab === "member" && (
          <CardContent className="tab-panel">
            <div className="member-section">
              <div className="section-heading">
                <h3>Membership</h3>
                <Badge>{selectedTier.name}</Badge>
              </div>
              <div className="tier-options">
                {MEMBERSHIP_TIERS.map((tier) => (
                  <button
                    className={cn("tier-option", tierId === tier.id && "tier-option-active")}
                    key={tier.id}
                    type="button"
                    onClick={() => {
                      setTierId(tier.id);
                      setTierPriceWei(tier.priceWei);
                    }}
                  >
                    <strong>{tier.name}</strong>
                    <span>{tier.priceEth}</span>
                    <small>{tier.credits} credits · {tier.cap}/month</small>
                  </button>
                ))}
              </div>
              <div className="actions">
                <Button onClick={() => run("Purchase membership", purchaseSelectedTier)}>Purchase</Button>
                <Button variant="secondary" onClick={() => run("Renew membership", renewSelectedTier)}>
                  Renew
                </Button>
              </div>
            </div>

            <div className="member-section">
              <div className="section-heading">
                <h3>Reserve Slot</h3>
                <Badge>{categoryName}</Badge>
              </div>
              <div className="grid three">
                <Label>
                  <span>Start time Berlin</span>
                  <Input
                    type="datetime-local"
                    value={reservationStartTime}
                    onChange={(event: any) => setReservationStartTime(event.target.value)}
                  />
                </Label>
                <Label>
                  <span>Duration</span>
                  <Input
                    min="1"
                    step="1"
                    type="number"
                    value={reservationDurationHours}
                    onChange={(event: any) => setReservationDurationHours(event.target.value)}
                  />
                </Label>
                <Label>
                  <span>Category</span>
                  <Select value={categoryName} onChange={(event: any) => setCategoryName(event.target.value as CategoryName)}>
                    {CATEGORY_NAMES.map((name) => (
                      <option key={name} value={name}>
                        {name}
                      </option>
                    ))}
                  </Select>
                </Label>
              </div>
              <div className="duration-options">
                {DURATION_HOUR_OPTIONS.map((hours) => (
                  <Button
                    key={hours}
                    variant={reservationDurationHours === hours ? "default" : "secondary"}
                    onClick={() => setReservationDurationHours(hours)}
                  >
                    {hours}h
                  </Button>
                ))}
              </div>
              <div className="actions">
                <Button onClick={() => run("Reserve slot", reserveSlot)}>Reserve</Button>
              </div>
            </div>

            <div className="member-section">
              <div className="section-heading">
                <h3>Current Reservation</h3>
                <Badge variant={reservationExists ? "success" : "secondary"}>{selectedReservationLabel}</Badge>
              </div>
              <div className="status-strip compact">
                <span>{reservationExists ? `Reservation #${reservationId}` : "Reserve or load a reservation"}</span>
              </div>
              <div className="actions">
                <Button variant="secondary" onClick={() => run("Refresh reservation", loadReservation)}>
                  Refresh
                </Button>
                {canUseReservedActions && (
                  <Button
                    variant="secondary"
                    onClick={() =>
                      run("Cancel reservation", async () =>
                        refreshSelectedReservationAfter(
                          await txBase(requireLedger(), parkingLedgerAbi, "cancelReservation", [
                            toUint(reservationId, "Reservation ID"),
                          ]),
                        ),
                      )
                    }
                  >
                    Cancel
                  </Button>
                )}
                {canUseReservedActions && (
                  <Button
                    variant="secondary"
                    onClick={() =>
                      run("Check in", async () =>
                        refreshSelectedReservationAfter(
                          await txBase(requireLedger(), parkingLedgerAbi, "checkIn", [toUint(reservationId, "Reservation ID")]),
                        ),
                      )
                    }
                  >
                    Check In
                  </Button>
                )}
                {canCheckOut && (
                  <Button
                    variant="secondary"
                    onClick={() =>
                      run("Check out", async () =>
                        refreshSelectedReservationAfter(
                          await txBase(requireLedger(), parkingLedgerAbi, "checkOut", [
                            toUint(reservationId, "Reservation ID"),
                          ]),
                        ),
                      )
                    }
                  >
                    Check Out
                  </Button>
                )}
                {canMarkNoShow && (
                  <Button
                    variant="secondary"
                    onClick={() =>
                      run("Mark no-show", async () =>
                        refreshSelectedReservationAfter(
                          await txBase(requireLedger(), parkingLedgerAbi, "markNoShow", [
                            toUint(reservationId, "Reservation ID"),
                          ]),
                        ),
                      )
                    }
                  >
                    Mark No-Show
                  </Button>
                )}
              </div>
              <details className="advanced-panel">
                <summary>Load existing reservation</summary>
                <div className="advanced-panel-content">
                  <Label>
                    <span>Reservation ID</span>
                    <Input
                      value={reservationId}
                      onChange={(event: any) => {
                        setReservationId(event.target.value);
                        setSelectedReservation(null);
                      }}
                    />
                  </Label>
                  <Button variant="secondary" onClick={() => run("Reservation", loadReservation)}>
                    Load
                  </Button>
                </div>
              </details>
            </div>

          </CardContent>
        )}

        {activeTab === "operator" && (
          <CardContent className="tab-panel">
            <div className="grid two">
              <Label>
                <span>Price per hour</span>
                <Input value={pricePerHour} onChange={(event: any) => setPricePerHour(event.target.value)} />
              </Label>
              <Label>
                <span>No-show fee</span>
                <Input value={noShowFee} onChange={(event: any) => setNoShowFee(event.target.value)} />
              </Label>
            </div>
            <div className="actions">
              <Button
                onClick={() =>
                  run("Set price", () =>
                    txBase(requireRegistry(), operatorRegistryAbi, "setPricePerHour", [
                      toUint(operatorId, "Operator ID"),
                      categoryHash,
                      toUint(pricePerHour, "Price per hour"),
                    ]),
                  )
                }
              >
                Set Price
              </Button>
              <Button
                variant="secondary"
                onClick={() =>
                  run("Set no-show fee", () =>
                    txBase(requireRegistry(), operatorRegistryAbi, "setNoShowFee", [
                      toUint(operatorId, "Operator ID"),
                      toUint(noShowFee, "No-show fee"),
                    ]),
                  )
                }
              >
                Set No-Show Fee
              </Button>
              <Button
                variant="secondary"
                onClick={() =>
                  run("Withdraw earnings", () =>
                    txBase(requireTreasury(), operatorTreasuryAbi, "withdraw", [toUint(operatorId, "Operator ID")]),
                  )
                }
              >
                Withdraw
              </Button>
            </div>
          </CardContent>
        )}

        {activeTab === "reads" && (
          <CardContent className="tab-panel">
            <div className="read-grid">
              <Button
                variant="secondary"
                onClick={() =>
                  run("Whitelisted", () =>
                    readContract({
                      address: requireRegistry(),
                      abi: operatorRegistryAbi,
                      functionName: "isWhitelisted",
                      args: [toUint(operatorId, "Operator ID")],
                    }),
                  )
                }
              >
                Is Whitelisted
              </Button>
              <Button
                variant="secondary"
                onClick={() =>
                  run("Supports category", () =>
                    readContract({
                      address: requireRegistry(),
                      abi: operatorRegistryAbi,
                      functionName: "supportsCategory",
                      args: [toUint(operatorId, "Operator ID"), categoryHash],
                    }),
                  )
                }
              >
                Supports Category
              </Button>
              <Button
                variant="secondary"
                onClick={() =>
                  run("Price per hour", () =>
                    readContract({
                      address: requireRegistry(),
                      abi: operatorRegistryAbi,
                      functionName: "getPricePerHour",
                      args: [toUint(operatorId, "Operator ID"), categoryHash],
                    }),
                  )
                }
              >
                Get Price
              </Button>
              <Button
                variant="secondary"
                onClick={() =>
                  run("No-show fee", () =>
                    readContract({
                      address: requireRegistry(),
                      abi: operatorRegistryAbi,
                      functionName: "getNoShowFee",
                      args: [toUint(operatorId, "Operator ID")],
                    }),
                  )
                }
              >
                Get No-Show Fee
              </Button>
              <Button
                variant="secondary"
                onClick={() =>
                  run("Operator wallet", () =>
                    readContract({
                      address: requireRegistry(),
                      abi: operatorRegistryAbi,
                      functionName: "getOperatorWallet",
                      args: [toUint(operatorId, "Operator ID")],
                    }),
                  )
                }
              >
                Get Wallet
              </Button>
              <Button
                variant="secondary"
                onClick={() =>
                  run("Accumulated earnings", () =>
                    readContract({
                      address: requireTreasury(),
                      abi: operatorTreasuryAbi,
                      functionName: "getAccumulatedEarnings",
                      args: [toUint(operatorId, "Operator ID")],
                    }),
                  )
                }
              >
                Get Earnings
              </Button>
              <Button
                variant="secondary"
                onClick={() =>
                  run("Exchange rate", () =>
                    readContract({
                      address: requireTreasury(),
                      abi: operatorTreasuryAbi,
                      functionName: "getCreditToEthRate",
                    }),
                  )
                }
              >
                Get Rate
              </Button>
              <Button
                variant="secondary"
                onClick={() =>
                  run("Month key", () =>
                    readContract({
                      address: requireLedger(),
                      abi: parkingLedgerAbi,
                      functionName: "getMonthKey",
                      args: [berlinDateTimeToUnixSeconds(reservationStartTime)],
                    }),
                  )
                }
              >
                Get Month Key
              </Button>
              <Label>
                <span>Month key for usage reads</span>
                <Input value={monthKey} onChange={(event: any) => setMonthKey(event.target.value)} />
              </Label>
              <Button
                variant="secondary"
                onClick={() =>
                  run("Used category hours", () =>
                    readContract({
                      address: requireLedger(),
                      abi: parkingLedgerAbi,
                      functionName: "getUsedHoursByCategory",
                      args: [memberReadAddress(), categoryHash, toUint(monthKey, "Month key")],
                    }),
                  )
                }
              >
                Used Category Hours
              </Button>
              <Button
                variant="secondary"
                onClick={() =>
                  run("Used operator hours", () =>
                    readContract({
                      address: requireLedger(),
                      abi: parkingLedgerAbi,
                      functionName: "getUsedHoursByOperator",
                      args: [memberReadAddress(), toUint(operatorId, "Operator ID"), toUint(monthKey, "Month key")],
                    }),
                  )
                }
              >
                Used Operator Hours
              </Button>
            </div>
          </CardContent>
        )}
        </Card>

        <div className="side-stack">
          <Card>
            <CardHeader>
              <div>
                <CardTitle>My Account</CardTitle>
                <CardDescription>Connected wallet summary.</CardDescription>
              </div>
              <Button variant="secondary" onClick={() => run("Refresh account", refreshMemberAccount)}>
                Refresh
              </Button>
            </CardHeader>
            <CardContent>
              <div className="metric-grid side-metric-grid">
                <div>
                  <span>Credits</span>
                  <strong>{memberSummary.balance}</strong>
                </div>
                <div>
                  <span>Membership</span>
                  <strong>{memberSummary.active}</strong>
                </div>
                <div>
                  <span>Tier</span>
                  <strong>{memberSummary.tier}</strong>
                </div>
                <div>
                  <span>Hour cap</span>
                  <strong>{memberSummary.cap}</strong>
                </div>
                <div className="metric-wide">
                  <span>Expiry</span>
                  <strong>{memberSummary.expiry}</strong>
                </div>
                <div className="metric-wide">
                  <span>Reservations</span>
                  <strong>{memberSummary.reservations}</strong>
                </div>
              </div>
              <details className="advanced-panel">
                <summary>Advanced reads</summary>
                <div className="advanced-panel-content">
                  <Label>
                    <span>Lookup address</span>
                    <Input
                      placeholder="Defaults to connected wallet"
                      value={memberLookup}
                      onChange={(event: any) => setMemberLookup(event.target.value)}
                    />
                  </Label>
                  <Button
                    variant="secondary"
                    onClick={() =>
                      run("Member reservations", () =>
                        readContract({
                          address: requireLedger(),
                          abi: parkingLedgerAbi,
                          functionName: "getMemberReservations",
                          args: [memberReadAddress()],
                        }),
                      )
                    }
                  >
                    Get Reservations
                  </Button>
                </div>
              </details>
            </CardContent>
          </Card>

          <Card className="output-card">
            <CardHeader>
              <CardTitle>Output</CardTitle>
              <CardDescription>Transaction hashes, read results, and wallet errors appear here.</CardDescription>
            </CardHeader>
            <CardContent>
              <pre>{output}</pre>
            </CardContent>
          </Card>
        </div>
      </div>

      <details className="shared-inputs">
        <summary>
          <span>Shared Inputs</span>
          <span>{`Tier ${tierId} · Operator ${operatorId} · ${categoryName}`}</span>
        </summary>
        <div className="grid four shared-inputs-content">
          <Label>
            <span>Tier ID</span>
            <Input value={tierId} onChange={(event: any) => setTierId(event.target.value)} />
          </Label>
          <Label>
            <span>Operator ID</span>
            <Input value={operatorId} onChange={(event: any) => setOperatorId(event.target.value)} />
          </Label>
          <Label>
            <span>Category</span>
            <Select value={categoryName} onChange={(event: any) => setCategoryName(event.target.value as CategoryName)}>
              {CATEGORY_NAMES.map((name) => (
                <option key={name} value={name}>
                  {name}
                </option>
              ))}
            </Select>
          </Label>
          <Label>
            <span>Custom category bytes32</span>
            <Input value={customCategory} onChange={(event: any) => setCustomCategory(event.target.value)} />
          </Label>
        </div>
      </details>
    </main>
  );
}

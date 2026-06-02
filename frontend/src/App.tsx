import { useMemo, useState } from "react";
import { type Hex, keccak256, toBytes } from "viem";
import {
  membershipManagerAbi,
  operatorRegistryAbi,
  operatorTreasuryAbi,
  parkCreditAbi,
} from "./abi/contracts";
import { connectWallet, readContract, toAddress, toUint, writeContract } from "./lib/wallet";

const CATEGORY_NAMES = ["standard", "disabled", "ev-charging", "motorbike"] as const;
const PARK_CREDIT_ID = 1n;

type CategoryName = (typeof CATEGORY_NAMES)[number];
type Tab = "admin" | "member" | "operator" | "reads";

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
  return String(result ?? "");
}

function formatExpiry(value: unknown) {
  const expiry = typeof value === "bigint" ? value : BigInt(String(value || 0));
  if (expiry === 0n) return "0";
  return `${expiry.toString()} (${new Date(Number(expiry) * 1000).toLocaleString()})`;
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

export function App() {
  const [account, setAccount] = useState("");
  const [activeTab, setActiveTab] = useState<Tab>("admin");
  const [creditAddress, setCreditAddress] = useState("");
  const [membershipAddress, setMembershipAddress] = useState("");
  const [registryAddress, setRegistryAddress] = useState("");
  const [treasuryAddress, setTreasuryAddress] = useState("");
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
  const [selectedCategories, setSelectedCategories] = useState<Record<CategoryName, boolean>>({
    standard: true,
    disabled: false,
    "ev-charging": true,
    motorbike: false,
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

  function memberReadAddress() {
    const target = memberLookup.trim() || account;
    if (!target) throw new Error("Connect wallet or enter a member address");
    return toAddress(target, "Member address");
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

  return (
    <main className="app-shell">
      <section className="hero">
        <div className="hero-copy">
          <Badge>ParkChain MVP</Badge>
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
      </div>

      <div className="layout">
        <div className="stack">
          <Card>
            <CardHeader>
              <CardTitle>Contracts</CardTitle>
              <CardDescription>Paste deployed addresses from your local chain.</CardDescription>
            </CardHeader>
            <CardContent className="grid two">
              <Label>
                <span>ParkCredit address</span>
                <Input value={creditAddress} onChange={(event: any) => setCreditAddress(event.target.value)} />
              </Label>
              <Label>
                <span>MembershipManager address</span>
                <Input value={membershipAddress} onChange={(event: any) => setMembershipAddress(event.target.value)} />
              </Label>
              <Label>
                <span>OperatorRegistry address</span>
                <Input value={registryAddress} onChange={(event: any) => setRegistryAddress(event.target.value)} />
              </Label>
              <Label>
                <span>OperatorTreasury address</span>
                <Input value={treasuryAddress} onChange={(event: any) => setTreasuryAddress(event.target.value)} />
              </Label>
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle>Shared Inputs</CardTitle>
              <CardDescription>These fields drive role-specific contract actions.</CardDescription>
            </CardHeader>
            <CardContent className="grid three">
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
            </CardContent>
          </Card>
        </div>

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
          </CardContent>
        )}

        {activeTab === "member" && (
          <CardContent className="tab-panel">
            <div className="grid two">
              <Label>
                <span>Membership payment wei</span>
                <Input value={tierPriceWei} onChange={(event: any) => setTierPriceWei(event.target.value)} />
              </Label>
              <Label>
                <span>Member address for reads</span>
                <Input
                  placeholder="Defaults to connected wallet"
                  value={memberLookup}
                  onChange={(event: any) => setMemberLookup(event.target.value)}
                />
              </Label>
            </div>

            <div className="actions">
              <Button
                onClick={() =>
                  run("Purchase membership", () =>
                    txBase(
                      requireMembership(),
                      membershipManagerAbi,
                      "purchaseMembership",
                      [toUint(tierId, "Tier ID")],
                      toUint(tierPriceWei, "Membership payment wei"),
                    ),
                  )
                }
              >
                Purchase Membership
              </Button>
              <Button
                variant="secondary"
                onClick={() =>
                  run("Renew membership", () =>
                    txBase(
                      requireMembership(),
                      membershipManagerAbi,
                      "renewMembership",
                      [toUint(tierId, "Tier ID")],
                      toUint(tierPriceWei, "Membership payment wei"),
                    ),
                  )
                }
              >
                Renew Membership
              </Button>
            </div>

            <div className="read-grid">
              <Button
                variant="secondary"
                onClick={() =>
                  run("ParkCredit balance", async () =>
                    readContract({
                      address: requireCredit(),
                      abi: parkCreditAbi,
                      functionName: "balanceOf",
                      args: [memberReadAddress(), PARK_CREDIT_ID],
                    }),
                  )
                }
              >
                Get Credit Balance
              </Button>
              <Button
                variant="secondary"
                onClick={() =>
                  run("Membership active", async () =>
                    readContract({
                      address: requireMembership(),
                      abi: membershipManagerAbi,
                      functionName: "isMemberActive",
                      args: [memberReadAddress()],
                    }),
                  )
                }
              >
                Is Member Active
              </Button>
              <Button
                variant="secondary"
                onClick={() =>
                  run("Member tier", async () =>
                    readContract({
                      address: requireMembership(),
                      abi: membershipManagerAbi,
                      functionName: "getMemberTier",
                      args: [memberReadAddress()],
                    }),
                  )
                }
              >
                Get Member Tier
              </Button>
              <Button
                variant="secondary"
                onClick={() =>
                  run("Monthly hour cap", async () =>
                    readContract({
                      address: requireMembership(),
                      abi: membershipManagerAbi,
                      functionName: "getMemberMonthlyHourCap",
                      args: [memberReadAddress()],
                    }),
                  )
                }
              >
                Get Hour Cap
              </Button>
              <Button
                variant="secondary"
                onClick={() =>
                  run("Membership expiry", async () =>
                    formatExpiry(
                      await readContract({
                        address: requireMembership(),
                        abi: membershipManagerAbi,
                        functionName: "getMembershipExpiry",
                        args: [memberReadAddress()],
                      }),
                    ),
                  )
                }
              >
                Get Expiry
              </Button>
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
            </div>
          </CardContent>
        )}
      </Card>
    </main>
  );
}

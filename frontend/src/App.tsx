import { useEffect, useMemo, useState } from "react";
import { type Hex, keccak256, toBytes, zeroAddress } from "viem";
import { parkChainRouterAbi } from "./abi/contracts";
import { StatusStrip } from "./components/shared-panels";
import { Badge, Button } from "./components/ui";
import { connectWallet, readContract, toAddress, writeContract } from "./lib/wallet";
import { AdminPage } from "./pages/AdminPage";
import { CustomerPage } from "./pages/CustomerPage";
import { LoginPage } from "./pages/LoginPage";
import { OperatorPage } from "./pages/OperatorPage";
import type { CategoryName, UserRole } from "./types";

export const CATEGORY_NAMES = ["standard", "disabled", "ev-charging", "motorbike", "family", "women"] as const;
export const PARK_CREDIT_ID = 1n;

const ROUTER_ADDRESS = String(import.meta.env.VITE_PARKCHAIN_ROUTER_ADDRESS ?? "").trim();
const ROUTER_CONTRACTS = [
  { label: "ParkCredit", stateKey: "credit", key: keccak256(toBytes("ParkCredit")) },
  { label: "MembershipManager", stateKey: "membership", key: keccak256(toBytes("MembershipManager")) },
  { label: "OperatorRegistry", stateKey: "registry", key: keccak256(toBytes("OperatorRegistry")) },
  { label: "OperatorTreasury", stateKey: "treasury", key: keccak256(toBytes("OperatorTreasury")) },
  { label: "ParkingLedger", stateKey: "ledger", key: keccak256(toBytes("ParkingLedger")) },
] as const;

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

function routeToRole() {
  const route = window.location.hash.replace(/^#\/?/, "");
  if (route === "admin" || route === "operator" || route === "customer") return route;
  return null;
}

function roleTitle(role: UserRole) {
  if (role === "admin") return "Admin Console";
  if (role === "operator") return "Operator Workspace";
  return "Customer Portal";
}

export function App() {
  const [account, setAccount] = useState("");
  const [role, setRole] = useState<UserRole | null>(routeToRole());

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

  const [operatorId, setOperatorId] = useState("1");
  const [operatorWallet, setOperatorWallet] = useState("");
  const [operatorName, setOperatorName] = useState("Central Garage");
  const [pricePerHour, setPricePerHour] = useState("10");
  const [noShowFee, setNoShowFee] = useState("5");

  const [categoryName, setCategoryName] = useState<CategoryName>("standard");
  const [customCategory, setCustomCategory] = useState("");
  const [categoryEnabled, setCategoryEnabled] = useState(true);
  const [selectedCategories, setSelectedCategories] = useState<Record<CategoryName, boolean>>({
    standard: true,
    disabled: false,
    "ev-charging": true,
    motorbike: false,
    family: false,
    women: false,
  });

  const [allocator, setAllocator] = useState("");
  const [creditRate, setCreditRate] = useState("1000000000000000");
  const [gracePeriodMinutes, setGracePeriodMinutes] = useState("15");

  const [memberLookup, setMemberLookup] = useState("");
  const [reservationId, setReservationId] = useState("0");
  const [reservationStartTime, setReservationStartTime] = useState(String(Math.floor(Date.now() / 1000) + 3600));
  const [reservationDuration, setReservationDuration] = useState("2");
  const [monthKey, setMonthKey] = useState("");

  const [output, setOutput] = useState("Resolving contract addresses from ParkChainRouter.");

  const categoryHash = useMemo(
    () => categoryToBytes32(categoryName, customCategory),
    [categoryName, customCategory],
  );

  useEffect(() => {
    const onRouteChange = () => setRole(routeToRole());
    window.addEventListener("hashchange", onRouteChange);
    window.addEventListener("popstate", onRouteChange);
    if (!window.location.hash) window.history.replaceState(null, "", "#/login");
    return () => {
      window.removeEventListener("hashchange", onRouteChange);
      window.removeEventListener("popstate", onRouteChange);
    };
  }, []);

  useEffect(() => {
    let cancelled = false;

    async function resolveContractAddresses() {
      if (!ROUTER_ADDRESS) {
        setOutput("Router address missing\nSet VITE_PARKCHAIN_ROUTER_ADDRESS=0x... in frontend/.env and restart the frontend.");
        return;
      }

      try {
        const routerAddress = toAddress(ROUTER_ADDRESS, "ParkChainRouter address");
        const resolved = await Promise.all(
          ROUTER_CONTRACTS.map(async (contract) => {
            const address = String(
              await readContract({
                address: routerAddress,
                abi: parkChainRouterAbi,
                functionName: "getContract",
                args: [contract.key],
              }),
            );
            return { ...contract, address: toAddress(address, `${contract.label} address`) };
          }),
        );

        if (cancelled) return;

        const unset = resolved.filter((contract) => contract.address.toLowerCase() === zeroAddress);
        for (const contract of resolved) {
          if (contract.stateKey === "credit") setCreditAddress(contract.address);
          if (contract.stateKey === "membership") setMembershipAddress(contract.address);
          if (contract.stateKey === "registry") setRegistryAddress(contract.address);
          if (contract.stateKey === "treasury") setTreasuryAddress(contract.address);
          if (contract.stateKey === "ledger") setLedgerAddress(contract.address);
        }

        if (unset.length > 0) {
          setOutput(
            `Router key unset\n${unset
              .map((contract) => `${contract.label} resolved to ${zeroAddress}`)
              .join("\n")}\nRedeploy with ROUTER_ADDRESS=${routerAddress} npm run deploy:contracts:local`,
          );
          return;
        }

        setOutput(
          `Resolved contract addresses from router ${routerAddress}\n${resolved
            .map((contract) => `${contract.label}: ${contract.address}`)
            .join("\n")}`,
        );
      } catch (error) {
        if (!cancelled) {
          setOutput(`Router address resolution failed\n${error instanceof Error ? error.message : String(error)}`);
        }
      }
    }

    resolveContractAddresses();
    return () => {
      cancelled = true;
    };
  }, []);

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

  function loginAs(nextRole: UserRole) {
    setRole(nextRole);
    window.history.pushState(null, "", `#/${nextRole}`);
    setOutput(`Signed in as ${roleTitle(nextRole)}.`);
  }

  function logout() {
    setRole(null);
    window.history.pushState(null, "", "#/login");
    setOutput("Signed out. Select a role to continue.");
  }

  function requireAccount() {
    if (!account) throw new Error("Connect wallet first");
    return toAddress(account, "Connected account");
  }

  function requireResolvedAddress(value: string, label: string) {
    const address = toAddress(value, label);
    if (address.toLowerCase() === zeroAddress) throw new Error(`${label} is not resolved in ParkChainRouter`);
    return address;
  }

  const requireCredit = () => requireResolvedAddress(creditAddress, "ParkCredit address");
  const requireMembership = () => requireResolvedAddress(membershipAddress, "MembershipManager address");
  const requireRegistry = () => requireResolvedAddress(registryAddress, "OperatorRegistry address");
  const requireTreasury = () => requireResolvedAddress(treasuryAddress, "OperatorTreasury address");
  const requireLedger = () => requireResolvedAddress(ledgerAddress, "ParkingLedger address");

  function memberReadAddress() {
    const target = memberLookup.trim() || account;
    if (!target) throw new Error("Connect wallet or enter a customer address");
    return toAddress(target, "Customer address");
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

  const app = {
    account,
    allocator,
    categoryEnabled,
    categoryHash,
    categoryName,
    categoryNames: CATEGORY_NAMES,
    connect,
    creditAddress,
    creditRate,
    customCategory,
    formatExpiry,
    gracePeriodMinutes,
    ledgerAddress,
    loginAs,
    logout,
    memberLookup,
    memberReadAddress,
    membershipAddress,
    monthKey,
    noShowFee,
    operatorId,
    operatorName,
    operatorWallet,
    output,
    parkCreditId: PARK_CREDIT_ID,
    pricePerHour,
    registryAddress,
    requireCredit,
    requireLedger,
    requireMembership,
    requireRegistry,
    requireTreasury,
    reservationDuration,
    reservationId,
    reservationStartTime,
    role,
    routerAddress: ROUTER_ADDRESS,
    run,
    selectedCategories,
    selectedCategoryHashes,
    setAllocator,
    setCategoryEnabled,
    setCategoryName,
    setCreditRate,
    setCustomCategory,
    setGracePeriodMinutes,
    setMemberLookup,
    setMonthKey,
    setNoShowFee,
    setOperatorId,
    setOperatorName,
    setOperatorWallet,
    setPricePerHour,
    setReservationDuration,
    setReservationId,
    setReservationStartTime,
    setSelectedCategories,
    setTierActive,
    setTierCredits,
    setTierHourCap,
    setTierId,
    setTierName,
    setTierPriceWei,
    tierActive,
    tierCredits,
    tierHourCap,
    tierId,
    tierName,
    tierPriceWei,
    treasuryAddress,
    txBase,
  };

  if (!role) return <LoginPage app={app} />;

  return (
    <main className="app-shell">
      <section className="hero">
        <div className="hero-copy">
          <Badge>ParkChain MVP</Badge>
          <h1>{roleTitle(role)}</h1>
          <p>
            {role === "admin" && "Manage platform configuration, operators, memberships, and treasury settings."}
            {role === "operator" && "Manage pricing, no-show fees, and earnings for your registered parking operation."}
            {role === "customer" && "Buy memberships, reserve parking or charging, and track your monthly usage."}
          </p>
        </div>
        <div className="hero-actions">
          <Button variant="secondary" onClick={logout}>
            Sign Out
          </Button>
          <Button onClick={() => run("Connect wallet", connect)}>
            {account ? `${account.slice(0, 6)}...${account.slice(-4)}` : "Connect Wallet"}
          </Button>
        </div>
      </section>

      <StatusStrip app={app} />
      {role === "admin" && <AdminPage app={app} />}
      {role === "operator" && <OperatorPage app={app} />}
      {role === "customer" && <CustomerPage app={app} />}
    </main>
  );
}

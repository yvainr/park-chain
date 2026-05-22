import React, { useMemo, useState } from "react";
import { createRoot } from "react-dom/client";

declare global {
  interface Window {
    ethereum?: {
      request<T = unknown>(args: { method: string; params?: unknown[] }): Promise<T>;
    };
  }
}

const CATEGORY_HASHES = {
  standard: "0x478d756bb22d71bdc5edc92355dddf6a14f2cf4824f978ced7de55b760d354d4",
  disabled: "0x37a170f786e458179522ad8acdf045019b62598928e7a1acbbae427b70fe1ee5",
  "ev-charging": "0xd986b2818467bb18e1c281076f8625be6f7ca03f6a17efab2a19427f12822f37",
  motorbike: "0x9dd4e24c63d65741e9cccb4a3f02a662d0d1b894f37e2e2819e58af94413c503",
};

const SELECTORS = {
  registerOperator: "0x61157a6e",
  removeOperator: "0xf46673f6",
  setSupportedCategory: "0x7c595885",
  setPricePerHour: "0x8a871af2",
  setNoShowFee: "0x1de056f3",
  isWhitelisted: "0x751b02c2",
  supportsCategory: "0xa2d51285",
  getPricePerHour: "0x8d4d6bcd",
  getNoShowFee: "0xd3b81c2b",
  getOperatorWallet: "0x78a1ab0c",
  setCreditToEthRate: "0xe31768bd",
  setAllocator: "0xbf83f2a2",
  withdraw: "0x2e1a7d4d",
  getAccumulatedEarnings: "0x14e54022",
  getCreditToEthRate: "0xd5f1e793",
};

type CategoryName = keyof typeof CATEGORY_HASHES;
type Tab = "admin" | "operator" | "reads";

function cleanHex(value: string) {
  return value.startsWith("0x") ? value.slice(2) : value;
}

function word(value: bigint) {
  return value.toString(16).padStart(64, "0");
}

function encodeUint(value: string | number | bigint) {
  return word(BigInt(value || 0));
}

function encodeAddress(value: string) {
  const hex = cleanHex(value.trim());
  if (!/^[0-9a-fA-F]{40}$/.test(hex)) {
    throw new Error("Address must be 20 bytes");
  }
  return hex.padStart(64, "0");
}

function encodeBool(value: boolean) {
  return word(value ? 1n : 0n);
}

function encodeBytes32(value: string) {
  const hex = cleanHex(value.trim());
  if (!/^[0-9a-fA-F]{64}$/.test(hex)) {
    throw new Error("Category must be a bytes32 hex value");
  }
  return hex;
}

function encodeString(value: string) {
  const bytes = new TextEncoder().encode(value);
  const body = Array.from(bytes, (byte) => byte.toString(16).padStart(2, "0")).join("");
  const paddedLength = Math.ceil(body.length / 64) * 64;
  return word(BigInt(bytes.length)) + body.padEnd(paddedLength, "0");
}

function encodeBytes32Array(values: string[]) {
  return word(BigInt(values.length)) + values.map(encodeBytes32).join("");
}

function callData(selector: string, ...args: string[]) {
  return selector + args.join("");
}

function encodeRegisterOperator(operatorId: string, wallet: string, name: string, categories: string[]) {
  const encodedName = encodeString(name);
  const encodedCategories = encodeBytes32Array(categories);
  const nameOffset = 32n * 4n;
  const categoriesOffset = nameOffset + BigInt(encodedName.length / 2);

  return callData(
    SELECTORS.registerOperator,
    encodeUint(operatorId),
    encodeAddress(wallet),
    word(nameOffset),
    word(categoriesOffset),
    encodedName,
    encodedCategories,
  );
}

function encodeCategoryList(selected: Record<CategoryName, boolean>) {
  return Object.entries(selected)
    .filter(([, enabled]) => enabled)
    .map(([name]) => CATEGORY_HASHES[name as CategoryName]);
}

function decodeBool(hex: string) {
  return BigInt(hex || "0x0") !== 0n;
}

function decodeUint(hex: string) {
  return BigInt(hex || "0x0").toString();
}

function decodeAddress(hex: string) {
  const clean = cleanHex(hex).padStart(64, "0");
  return `0x${clean.slice(24)}`;
}

function requireEthereum() {
  if (!window.ethereum) {
    throw new Error("No injected wallet found");
  }
  return window.ethereum;
}

async function sendTransaction(from: string, to: string, data: string) {
  return requireEthereum().request<string>({
    method: "eth_sendTransaction",
    params: [{ from, to, data }],
  });
}

async function readContract(to: string, data: string) {
  return requireEthereum().request<string>({
    method: "eth_call",
    params: [{ to, data }, "latest"],
  });
}

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

function App() {
  const [account, setAccount] = useState("");
  const [activeTab, setActiveTab] = useState<Tab>("admin");
  const [registryAddress, setRegistryAddress] = useState("");
  const [treasuryAddress, setTreasuryAddress] = useState("");
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
    () => customCategory.trim() || CATEGORY_HASHES[categoryName],
    [categoryName, customCategory],
  );

  async function run(label: string, action: () => Promise<unknown>) {
    try {
      setOutput(`${label}...`);
      const result = await action();
      setOutput(`${label} complete\n${String(result ?? "")}`);
    } catch (error) {
      setOutput(`${label} failed\n${error instanceof Error ? error.message : String(error)}`);
    }
  }

  async function connectWallet() {
    const accounts = await requireEthereum().request<string[]>({ method: "eth_requestAccounts" });
    setAccount(accounts[0] ?? "");
    return accounts[0] ?? "";
  }

  function requireAccount() {
    if (!account) throw new Error("Connect wallet first");
    return account;
  }

  function requireRegistry() {
    if (!registryAddress) throw new Error("Registry address is required");
    return registryAddress;
  }

  function requireTreasury() {
    if (!treasuryAddress) throw new Error("Treasury address is required");
    return treasuryAddress;
  }

  return (
    <main className="app-shell">
      <section className="hero">
        <div className="hero-copy">
          <Badge>ParkChain MVP</Badge>
          <h1>Operator Registry and Treasury</h1>
          <p>Manage operator onboarding, category pricing, treasury allocation, and read-only contract checks.</p>
        </div>
        <Button onClick={() => run("Connect wallet", connectWallet)}>
          {account ? `${account.slice(0, 6)}...${account.slice(-4)}` : "Connect Wallet"}
        </Button>
      </section>

      <div className="status-strip">
        <Badge variant={account ? "success" : "secondary"}>{account ? "Wallet connected" : "Wallet disconnected"}</Badge>
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
              <CardDescription>These fields drive admin, operator, and read actions.</CardDescription>
            </CardHeader>
            <CardContent className="grid three">
              <Label>
                <span>Operator ID</span>
                <Input value={operatorId} onChange={(event: any) => setOperatorId(event.target.value)} />
              </Label>
              <Label>
                <span>Category</span>
                <Select value={categoryName} onChange={(event: any) => setCategoryName(event.target.value as CategoryName)}>
                  {Object.keys(CATEGORY_HASHES).map((name) => (
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
            {(["admin", "operator", "reads"] as const).map((tab) => (
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
                <p>Categories selected here are encoded as bytes32 values for registration.</p>
              </div>
              <div className="checks">
                {(Object.keys(CATEGORY_HASHES) as CategoryName[]).map((name) => (
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
                    sendTransaction(
                      requireAccount(),
                      requireRegistry(),
                      encodeRegisterOperator(
                        operatorId,
                        operatorWallet,
                        operatorName,
                        encodeCategoryList(selectedCategories),
                      ),
                    ),
                  )
                }
              >
                Register Operator
              </Button>
              <Button
                variant="secondary"
                onClick={() =>
                  run("Remove operator", () =>
                    sendTransaction(
                      requireAccount(),
                      requireRegistry(),
                      callData(SELECTORS.removeOperator, encodeUint(operatorId)),
                    ),
                  )
                }
              >
                Remove Operator
              </Button>
              <Button
                variant="secondary"
                onClick={() =>
                  run("Set supported category", () =>
                    sendTransaction(
                      requireAccount(),
                      requireRegistry(),
                      callData(
                        SELECTORS.setSupportedCategory,
                        encodeUint(operatorId),
                        encodeBytes32(categoryHash),
                        encodeBool(categoryEnabled),
                      ),
                    ),
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
                    sendTransaction(
                      requireAccount(),
                      requireTreasury(),
                      callData(SELECTORS.setAllocator, encodeAddress(allocator)),
                    ),
                  )
                }
              >
                Set Allocator
              </Button>
              <Button
                variant="secondary"
                onClick={() =>
                  run("Set exchange rate", () =>
                    sendTransaction(
                      requireAccount(),
                      requireTreasury(),
                      callData(SELECTORS.setCreditToEthRate, encodeUint(creditRate)),
                    ),
                  )
                }
              >
                Set Exchange Rate
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
                    sendTransaction(
                      requireAccount(),
                      requireRegistry(),
                      callData(
                        SELECTORS.setPricePerHour,
                        encodeUint(operatorId),
                        encodeBytes32(categoryHash),
                        encodeUint(pricePerHour),
                      ),
                    ),
                  )
                }
              >
                Set Price
              </Button>
              <Button
                variant="secondary"
                onClick={() =>
                  run("Set no-show fee", () =>
                    sendTransaction(
                      requireAccount(),
                      requireRegistry(),
                      callData(SELECTORS.setNoShowFee, encodeUint(operatorId), encodeUint(noShowFee)),
                    ),
                  )
                }
              >
                Set No-Show Fee
              </Button>
              <Button
                variant="secondary"
                onClick={() =>
                  run("Withdraw earnings", () =>
                    sendTransaction(
                      requireAccount(),
                      requireTreasury(),
                      callData(SELECTORS.withdraw, encodeUint(operatorId)),
                    ),
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
                  run("Whitelisted", async () =>
                    String(
                      decodeBool(
                        await readContract(requireRegistry(), callData(SELECTORS.isWhitelisted, encodeUint(operatorId))),
                      ),
                    ),
                  )
                }
              >
                Is Whitelisted
              </Button>
              <Button
                variant="secondary"
                onClick={() =>
                  run("Supports category", async () =>
                    String(
                      decodeBool(
                        await readContract(
                          requireRegistry(),
                          callData(SELECTORS.supportsCategory, encodeUint(operatorId), encodeBytes32(categoryHash)),
                        ),
                      ),
                    ),
                  )
                }
              >
                Supports Category
              </Button>
              <Button
                variant="secondary"
                onClick={() =>
                  run("Price per hour", async () =>
                    decodeUint(
                      await readContract(
                        requireRegistry(),
                        callData(SELECTORS.getPricePerHour, encodeUint(operatorId), encodeBytes32(categoryHash)),
                      ),
                    ),
                  )
                }
              >
                Get Price
              </Button>
              <Button
                variant="secondary"
                onClick={() =>
                  run("No-show fee", async () =>
                    decodeUint(await readContract(requireRegistry(), callData(SELECTORS.getNoShowFee, encodeUint(operatorId)))),
                  )
                }
              >
                Get No-Show Fee
              </Button>
              <Button
                variant="secondary"
                onClick={() =>
                  run("Operator wallet", async () =>
                    decodeAddress(
                      await readContract(requireRegistry(), callData(SELECTORS.getOperatorWallet, encodeUint(operatorId))),
                    ),
                  )
                }
              >
                Get Wallet
              </Button>
              <Button
                variant="secondary"
                onClick={() =>
                  run("Accumulated earnings", async () =>
                    decodeUint(
                      await readContract(requireTreasury(), callData(SELECTORS.getAccumulatedEarnings, encodeUint(operatorId))),
                    ),
                  )
                }
              >
                Get Earnings
              </Button>
              <Button
                variant="secondary"
                onClick={() =>
                  run("Exchange rate", async () =>
                    decodeUint(await readContract(requireTreasury(), callData(SELECTORS.getCreditToEthRate))),
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

createRoot(document.getElementById("root") as HTMLElement).render(
  <React.StrictMode>
    <App />
  </React.StrictMode>,
);

const style = document.createElement("style");
style.textContent = `
  :root {
    color: #0f172a;
    background: #f8fafc;
    font-family: Inter, ui-sans-serif, system-ui, -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif;
    font-synthesis-weight: none;
    text-rendering: optimizeLegibility;
  }

  * {
    box-sizing: border-box;
  }

  body {
    min-width: 320px;
    margin: 0;
  }

  h1, h2, h3, p {
    margin: 0;
  }

  .app-shell {
    width: min(1180px, calc(100vw - 32px));
    margin: 0 auto;
    padding: 28px 0 44px;
  }

  .hero {
    display: flex;
    align-items: flex-start;
    justify-content: space-between;
    gap: 20px;
    padding: 24px 0 18px;
  }

  .hero-copy {
    display: grid;
    gap: 10px;
    max-width: 720px;
  }

  .hero h1 {
    color: #020617;
    font-size: 32px;
    font-weight: 750;
    line-height: 1.1;
  }

  .hero p,
  .ui-card-description,
  .category-card p {
    color: #64748b;
    font-size: 14px;
    line-height: 1.55;
  }

  .status-strip {
    display: flex;
    flex-wrap: wrap;
    align-items: center;
    gap: 10px;
    margin-bottom: 18px;
    color: #475569;
    font-size: 13px;
  }

  .status-strip span {
    min-height: 26px;
    display: inline-flex;
    align-items: center;
    border: 1px solid #e2e8f0;
    border-radius: 999px;
    padding: 0 10px;
    background: #ffffff;
  }

  .layout {
    display: grid;
    grid-template-columns: minmax(0, 1fr) minmax(300px, 380px);
    gap: 16px;
    align-items: stretch;
  }

  .stack {
    display: grid;
    gap: 16px;
  }

  .ui-card {
    border: 1px solid #e2e8f0;
    border-radius: 8px;
    background: #ffffff;
    color: #0f172a;
    box-shadow: 0 1px 2px rgba(15, 23, 42, 0.04);
  }

  .ui-card-header {
    display: flex;
    justify-content: space-between;
    gap: 16px;
    padding: 20px 20px 0;
  }

  .ui-card-title {
    color: #020617;
    font-size: 16px;
    font-weight: 700;
    line-height: 1.25;
  }

  .ui-card-description {
    margin-top: 6px;
  }

  .ui-card-content {
    padding: 20px;
  }

  .grid {
    display: grid;
    gap: 14px;
  }

  .two {
    grid-template-columns: repeat(2, minmax(0, 1fr));
  }

  .three {
    grid-template-columns: repeat(3, minmax(0, 1fr));
  }

  .ui-label {
    display: grid;
    gap: 7px;
    min-width: 0;
    color: #334155;
    font-size: 13px;
    font-weight: 650;
  }

  .ui-input,
  .ui-select {
    width: 100%;
    min-height: 40px;
    border: 1px solid #cbd5e1;
    border-radius: 6px;
    padding: 0 11px;
    color: #0f172a;
    background: #ffffff;
    font: inherit;
    font-size: 14px;
    outline: none;
    transition: border-color 120ms ease, box-shadow 120ms ease;
  }

  .ui-input:focus,
  .ui-select:focus {
    border-color: #0f172a;
    box-shadow: 0 0 0 3px rgba(15, 23, 42, 0.12);
  }

  .ui-checkbox {
    width: 16px;
    height: 16px;
    accent-color: #0f172a;
  }

  .ui-button {
    min-height: 40px;
    border: 1px solid transparent;
    border-radius: 6px;
    padding: 0 14px;
    font: inherit;
    font-size: 14px;
    font-weight: 650;
    cursor: pointer;
    transition: background 120ms ease, border-color 120ms ease, color 120ms ease;
  }

  .ui-button-default {
    color: #f8fafc;
    background: #0f172a;
  }

  .ui-button-default:hover {
    background: #1e293b;
  }

  .ui-button-secondary {
    border-color: #e2e8f0;
    color: #0f172a;
    background: #ffffff;
  }

  .ui-button-secondary:hover,
  .ui-button-ghost:hover {
    background: #f1f5f9;
  }

  .ui-button-ghost {
    color: #475569;
    background: transparent;
  }

  .ui-badge {
    width: fit-content;
    min-height: 24px;
    display: inline-flex;
    align-items: center;
    border-radius: 999px;
    padding: 0 9px;
    font-size: 12px;
    font-weight: 700;
  }

  .ui-badge-secondary {
    color: #334155;
    background: #e2e8f0;
  }

  .ui-badge-success {
    color: #14532d;
    background: #dcfce7;
  }

  .output-card {
    min-height: 100%;
  }

  pre {
    min-height: 228px;
    max-height: 360px;
    overflow: auto;
    margin: 0;
    padding: 14px;
    border: 1px solid #1e293b;
    border-radius: 6px;
    background: #020617;
    color: #dbeafe;
    font-size: 13px;
    line-height: 1.55;
    white-space: pre-wrap;
    word-break: break-word;
  }

  .workspace-card {
    margin-top: 16px;
  }

  .workspace-header {
    align-items: flex-start;
  }

  .tabs-list {
    display: inline-flex;
    gap: 4px;
    border: 1px solid #e2e8f0;
    border-radius: 8px;
    padding: 4px;
    background: #f8fafc;
  }

  .tabs-list .ui-button {
    min-height: 34px;
  }

  .tab-panel {
    display: grid;
    gap: 18px;
  }

  .category-card {
    display: flex;
    align-items: flex-start;
    justify-content: space-between;
    gap: 16px;
    border: 1px solid #e2e8f0;
    border-radius: 8px;
    padding: 14px;
    background: #f8fafc;
  }

  .category-card h3 {
    font-size: 14px;
    line-height: 1.35;
  }

  .checks,
  .actions,
  .read-grid {
    display: flex;
    flex-wrap: wrap;
    gap: 10px;
  }

  .check-row,
  .switch-row {
    width: fit-content;
    display: inline-flex;
    align-items: center;
    gap: 8px;
    min-height: 40px;
    border: 1px solid #e2e8f0;
    border-radius: 6px;
    padding: 0 10px;
    background: #ffffff;
  }

  .read-grid .ui-button {
    min-width: 148px;
  }

  @media (max-width: 920px) {
    .layout {
      grid-template-columns: 1fr;
    }

    .three {
      grid-template-columns: 1fr;
    }
  }

  @media (max-width: 700px) {
    .app-shell {
      width: min(100vw - 24px, 1180px);
      padding-top: 18px;
    }

    .hero,
    .workspace-header,
    .category-card {
      display: grid;
    }

    .hero h1 {
      font-size: 26px;
    }

    .two {
      grid-template-columns: 1fr;
    }

    .tabs-list {
      width: 100%;
      display: grid;
      grid-template-columns: repeat(3, minmax(0, 1fr));
    }

    .tabs-list .ui-button,
    .actions .ui-button,
    .read-grid .ui-button {
      width: 100%;
    }
  }
`;
document.head.appendChild(style);

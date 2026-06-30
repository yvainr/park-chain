import { type Abi, type Address, createPublicClient, createWalletClient, custom, http } from "viem";
import { hardhat } from "viem/chains";

const LOCAL_TRANSACTION_GAS_LIMIT = 1_000_000n;

declare global {
  interface Window {
    ethereum?: {
      request<T = unknown>(args: { method: string; params?: unknown[] }): Promise<T>;
      on?(event: "accountsChanged", listener: (accounts: unknown) => void): void;
      removeListener?(event: "accountsChanged", listener: (accounts: unknown) => void): void;
    };
  }
}

export function requireEthereum() {
  if (!window.ethereum) {
    throw new Error("No injected wallet found");
  }

  return window.ethereum;
}

export async function connectWallet() {
  const accounts = await requireEthereum().request<Address[]>({ method: "eth_requestAccounts" });
  return accounts[0] ?? "";
}

export async function getConnectedWallet() {
  if (!window.ethereum) return "";
  const accounts = await window.ethereum.request<Address[]>({ method: "eth_accounts" });
  return accounts[0] ?? "";
}

export function watchWalletAccounts(listener: (account: string) => void) {
  const ethereum = window.ethereum;
  if (!ethereum?.on) return () => undefined;

  const handleAccountsChanged = (value: unknown) => {
    const accounts = Array.isArray(value) ? value : [];
    listener(typeof accounts[0] === "string" ? accounts[0] : "");
  };

  ethereum.on("accountsChanged", handleAccountsChanged);
  return () => ethereum.removeListener?.("accountsChanged", handleAccountsChanged);
}

export function toAddress(value: string, label = "Address") {
  const trimmed = value.trim();
  if (!/^0x[0-9a-fA-F]{40}$/.test(trimmed)) {
    throw new Error(`${label} must be a 20-byte hex address`);
  }

  return trimmed as Address;
}

export function toUint(value: string | number | bigint, label = "Value") {
  try {
    const parsed = BigInt(value || 0);
    if (parsed < 0n) {
      throw new Error();
    }
    return parsed;
  } catch {
    throw new Error(`${label} must be a non-negative integer`);
  }
}

export const publicClient = createPublicClient({
  chain: hardhat,
  transport: http("http://127.0.0.1:8545"),
});

const HARDHAT_TX_GAS_CAP = 16_000_000n;

function walletClient(account: Address) {
  return createWalletClient({
    account,
    chain: hardhat,
    transport: custom(requireEthereum()),
  });
}

export async function readContract(args: {
  address: Address;
  abi: Abi;
  functionName: string;
  args?: readonly unknown[];
}) {
  return publicClient.readContract({
    address: args.address,
    abi: args.abi,
    functionName: args.functionName,
    args: args.args ?? [],
  } as any);
}

export async function writeContract(args: {
  account: Address;
  address: Address;
  abi: Abi;
  functionName: string;
  args?: readonly unknown[];
  value?: bigint;
}) {
  const client = walletClient(args.account);
  const estimatedGas = await publicClient.estimateContractGas({
    account: args.account,
    address: args.address,
    abi: args.abi,
    functionName: args.functionName,
    args: args.args ?? [],
    // Avoid injected wallets using Hardhat's 21M fallback estimate, which is
    // above the node's 16,777,216 per-transaction gas cap.
    gas: LOCAL_TRANSACTION_GAS_LIMIT,
    value: args.value,
  } as any);
  const gas = estimatedGas + estimatedGas / 5n + 10_000n;

  if (gas > HARDHAT_TX_GAS_CAP) {
    throw new Error(`Estimated gas ${gas.toString()} exceeds the local Hardhat transaction cap`);
  }

  const hash = await client.writeContract({
    account: args.account,
    address: args.address,
    abi: args.abi,
    functionName: args.functionName,
    args: args.args ?? [],
    value: args.value,
    gas,
  } as any);

  const receipt = await publicClient.waitForTransactionReceipt({ hash });
  if (receipt.status !== "success") {
    throw new Error(`Transaction reverted: ${hash}`);
  }

  return hash;
}

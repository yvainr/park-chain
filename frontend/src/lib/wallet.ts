import { type Abi, type Address, createPublicClient, createWalletClient, custom, http } from "viem";
import { hardhat, sepolia } from "viem/chains";

const LOCAL_TRANSACTION_GAS_LIMIT = 1_000_000n;
const HARDHAT_CHAIN_ID = hardhat.id;
const SEPOLIA_CHAIN_ID = sepolia.id;
const DEFAULT_LOCAL_RPC_URL = "http://127.0.0.1:8545";
const DEFAULT_SEPOLIA_RPC_URL = "https://rpc.sepolia.org";

const configuredChainId = Number(import.meta.env.VITE_PARKCHAIN_CHAIN_ID ?? HARDHAT_CHAIN_ID);
export const appChain = configuredChainId === SEPOLIA_CHAIN_ID ? sepolia : hardhat;
export const appRpcUrl = String(
  import.meta.env.VITE_PARKCHAIN_RPC_URL ??
    (appChain.id === SEPOLIA_CHAIN_ID ? DEFAULT_SEPOLIA_RPC_URL : DEFAULT_LOCAL_RPC_URL),
).trim();

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
  await ensureWalletChain();
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
  chain: appChain,
  transport: http(appRpcUrl),
});

const HARDHAT_TX_GAS_CAP = 16_000_000n;
const accountWriteLocks = new Map<string, Promise<unknown>>();

function walletClient(account: Address) {
  return createWalletClient({
    account,
    chain: appChain,
    transport: custom(requireEthereum()),
  });
}

async function ensureWalletChain() {
  const ethereum = requireEthereum();
  const currentChainId = await ethereum.request<string>({ method: "eth_chainId" });
  const targetChainId = `0x${appChain.id.toString(16)}`;

  if (currentChainId.toLowerCase() === targetChainId) {
    return;
  }

  try {
    await ethereum.request({
      method: "wallet_switchEthereumChain",
      params: [{ chainId: targetChainId }],
    });
  } catch (error) {
    const code = typeof error === "object" && error !== null && "code" in error ? (error as { code?: unknown }).code : undefined;

    if (code === 4902 && appChain.id === SEPOLIA_CHAIN_ID) {
      await ethereum.request({
        method: "wallet_addEthereumChain",
        params: [
          {
            blockExplorerUrls: ["https://sepolia.etherscan.io"],
            chainId: targetChainId,
            chainName: "Sepolia",
            nativeCurrency: { decimals: 18, name: "Sepolia Ether", symbol: "ETH" },
            rpcUrls: [appRpcUrl],
          },
        ],
      });
      return;
    }

    throw error;
  }
}

async function withAccountWriteLock<T>(account: Address, action: () => Promise<T>) {
  const key = account.toLowerCase();
  const previous = accountWriteLocks.get(key) ?? Promise.resolve();

  const current = previous
    .catch(() => undefined)
    .then(action)
    .finally(() => {
      if (accountWriteLocks.get(key) === current) {
        accountWriteLocks.delete(key);
      }
    });

  accountWriteLocks.set(key, current);
  return current;
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
  return withAccountWriteLock(args.account, async () => {
    await ensureWalletChain();
    const client = walletClient(args.account);
    const estimatedGas = await publicClient.estimateContractGas({
      account: args.account,
      address: args.address,
      abi: args.abi,
      functionName: args.functionName,
      args: args.args ?? [],
      // Avoid injected wallets using Hardhat's 21M fallback estimate, which is
      // above the node's 16,777,216 per-transaction gas cap.
      ...(appChain.id === HARDHAT_CHAIN_ID ? { gas: LOCAL_TRANSACTION_GAS_LIMIT } : {}),
      value: args.value,
    } as any);
    const gas = estimatedGas + estimatedGas / 5n + 10_000n;

    if (appChain.id === HARDHAT_CHAIN_ID && gas > HARDHAT_TX_GAS_CAP) {
      throw new Error(`Estimated gas ${gas.toString()} exceeds the local Hardhat transaction cap`);
    }

    const nonce = await publicClient.getTransactionCount({
      address: args.account,
      blockTag: "pending",
    });

    const hash = await client.writeContract({
      account: args.account,
      address: args.address,
      abi: args.abi,
      functionName: args.functionName,
      args: args.args ?? [],
      value: args.value,
      gas,
      nonce,
    } as any);

    const receipt = await publicClient.waitForTransactionReceipt({ hash });
    if (receipt.status !== "success") {
      throw new Error(`Transaction reverted: ${hash}`);
    }

    return hash;
  });
}

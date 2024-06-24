import { useCallback, useState, useMemo, createContext, useContext } from "react";

import { PasskeyStamper, createPasskey, isSupported } from "@turnkey/react-native-passkey-stamper";
import { ApiKeyStamper } from "@turnkey/api-key-stamper";
import { TurnkeyClient } from "@turnkey/http";
import { TurnkeySigner, TurnkeySubOrganization } from "@alchemy/aa-signers/dist/esm/turnkey";
import { createLightAccountAlchemyClient } from "@alchemy/aa-alchemy";
import { sepolia } from "@alchemy/aa-core";
import { Alchemy, Network, AssetTransfersCategory, AssetTransfersResult } from "alchemy-sdk";

import { Buffer } from "buffer";
import { http, parseEther, formatEther } from "viem";

const RPID = "testcreds.ericlewis.workers.dev";
const BASE_URL = "https://api.turnkey.com";

interface AccountContextType {
  provider: any;
  walletAddress: string | null;
  login: () => Promise<void>;
  signup: () => Promise<void>;
  sendTransaction: (address: string, amount: string) => Promise<void>;
  getTransactions: () => Promise<AssetTransfersResult[]>;
  getBalance: () => Promise<string>;
}

const AccountContext = createContext<AccountContextType | undefined>(undefined);

export const useAccount = () => {
  const context = useContext(AccountContext);
  if (context === undefined) {
    throw new Error('useAccount must be used within an AccountProvider');
  }
  return context;
};

export const AccountProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [provider, setProvider] = useState<any>(null);
  const [walletAddress, setWalletAddress] = useState<string | null>(null);

  const login = useCallback(async () => {
    if (!provider) {
      const newProvider = await onPasskeySignature();
      setProvider(newProvider);
      setWalletAddress(newProvider!.account.address as any);
    }
  }, [provider]);

  const signup = useCallback(async () => {
    if (!provider) {
      const newProvider = await onPasskeyCreate();
      setProvider(newProvider);
      setWalletAddress(newProvider!.account.address as any);
    }
  }, [provider]);

  const sendTransaction = useCallback(async (address: string, amount: string) => {
    if (provider) {
      const ethAmount = parseEther(amount);
      const balanceFrom = await provider.getBalance({
        address: provider.account.address,
      });

      if (balanceFrom < ethAmount) {
        throw new Error(`Insufficient ETH balance: ${formatEther(balanceFrom)}. Need at least ${formatEther(ethAmount)}.`);
      }

      const transaction = await provider.sendTransaction({
        to: address,
        value: ethAmount,
      } as any);

      return transaction;
    } else {
      throw new Error("Provider not initialized. Please login or signup first.");
    }
  }, [provider]);

  const getTransactions = useCallback(async (): Promise<AssetTransfersResult[]> => {
    if (!provider || !walletAddress) {
      throw new Error("Provider not initialized or wallet address not set. Please login or signup first.");
    }

    try {
      const alchemy = new Alchemy({
        apiKey: process.env.EXPO_PUBLIC_ALCHEMY_API_KEY,
        network: Network.ETH_SEPOLIA,
      });

      const [sentTransfers, receivedTransfers] = await Promise.all([
        alchemy.core.getAssetTransfers({
          maxCount: 1000,
          fromAddress: walletAddress,
          excludeZeroValue: true,
          category: [
            AssetTransfersCategory.ERC1155,
            AssetTransfersCategory.ERC20,
            AssetTransfersCategory.ERC721,
            AssetTransfersCategory.EXTERNAL,
            AssetTransfersCategory.INTERNAL,
            AssetTransfersCategory.SPECIALNFT
          ],
        }),
        alchemy.core.getAssetTransfers({
          maxCount: 1000,
          toAddress: walletAddress,
          excludeZeroValue: true,
          category: [
            AssetTransfersCategory.ERC1155,
            AssetTransfersCategory.ERC20,
            AssetTransfersCategory.ERC721,
            AssetTransfersCategory.EXTERNAL,
            AssetTransfersCategory.INTERNAL,
            AssetTransfersCategory.SPECIALNFT
          ],
        })
      ]);

      // Combine and sort transfers by block number (descending)
      const allTransfers = [...sentTransfers.transfers, ...receivedTransfers.transfers]
        .sort((a, b) => parseInt(b.blockNum) - parseInt(a.blockNum));

      return allTransfers;
    } catch (error) {
      console.error("Error fetching transactions:", error);
      throw error;
    }
  }, [provider, walletAddress]);

  const getBalance = useCallback(async (): Promise<string> => {
    if (!provider || !walletAddress) {
      throw new Error("Provider not initialized or wallet address not set. Please login or signup first.");
    }

    try {
      const balance = await provider.getBalance({ address: walletAddress });
      return formatEther(balance);
    } catch (error) {
      console.error("Error fetching balance:", error);
      throw error;
    }
  }, [provider, walletAddress]);

  const value = useMemo(() => ({
    provider,
    walletAddress,
    login,
    signup,
    sendTransaction,
    getTransactions,
    getBalance,
  }), [provider, walletAddress, login, signup, sendTransaction, getTransactions, getBalance]);

  return <AccountContext.Provider value={value}>{children}</AccountContext.Provider>;
};


async function onPasskeyCreate() {
    if (!isSupported()) {
      alert("Passkeys are not supported on this device");
      return;
    }
  
    try {
      const now = new Date();
      const humanReadableDateTime = `${now.getFullYear()}-${now.getMonth()}-${now.getDay()}@${now.getHours()}h${now.getMinutes()}min`;
  
      const userId = Buffer.from(String(Date.now())).toString("base64");
  
      const authenticatorParams = await createPasskey({
        authenticatorName: "End-User Passkey",
        rp: {
          id: RPID,
          name: "Passkey App",
        },
        user: {
          id: userId,
          name: `Key @ ${humanReadableDateTime}`,
          displayName: `Key @ ${humanReadableDateTime}`,
        },
        authenticatorSelection: {
          residentKey: "required",
          requireResidentKey: true,
          userVerification: "preferred",
        },
      });
  
      console.log("Passkey registration succeeded:", authenticatorParams);
  
      const response = await createSubOrganization(authenticatorParams);
      console.log("Created sub-org:", response);
  
      const organizationId = response.activity.result.createSubOrganizationResultV4!.subOrganizationId;
      alert(`Sub-org created! Your ID: ${organizationId}`);
  
      const address = response.activity.result.createSubOrganizationResultV4!.wallet!.addresses[0];
  
      const stamper = new PasskeyStamper({ rpId: RPID });
  
      const turnkeySigner = new TurnkeySigner({
        apiUrl: BASE_URL,
        stamper,
      });
  
      await turnkeySigner.authenticate({
        resolveSubOrganization: async () => {
          return new TurnkeySubOrganization({
            subOrganizationId: organizationId,
            signWith: address,
          });
        },
        transport: http(`https://eth-sepolia.g.alchemy.com/v2/${process.env.EXPO_PUBLIC_ALCHEMY_API_KEY}`) as any,
      });
  
      const provider = await createLightAccountAlchemyClient({
        apiKey: process.env.EXPO_PUBLIC_ALCHEMY_API_KEY,
        chain: sepolia,
        signer: turnkeySigner,
      });
  
      return provider;
  
    } catch (e) {
      console.error("Error during passkey creation", e);
    }
  }
  
  async function onPasskeySignature() {
    try {
      const stamper = new PasskeyStamper({ rpId: RPID });
  
      const turnkeySigner = new TurnkeySigner({
        apiUrl: BASE_URL,
        stamper,
      });
  
      const client = new TurnkeyClient({ baseUrl: BASE_URL }, stamper);
  
      const { organizationId } = await client.getWhoami({
        organizationId: process.env.EXPO_PUBLIC_TURNKEY_ORGANIZATION_ID,
      });
  
      const {
        wallets: [{ walletId }],
      } = await client.getWallets({ organizationId });
  
      const {
        accounts: [{ address }],
      } = await client.getWalletAccounts({ organizationId, walletId });
  
      await turnkeySigner.authenticate({
        resolveSubOrganization: async () => {
          return new TurnkeySubOrganization({
            subOrganizationId: organizationId,
            signWith: address,
          });
        },
        transport: http(`https://eth-sepolia.g.alchemy.com/v2/${process.env.EXPO_PUBLIC_ALCHEMY_API_KEY}`) as any,
      });
  
      const provider = await createLightAccountAlchemyClient({
        apiKey: process.env.EXPO_PUBLIC_ALCHEMY_API_KEY,
        chain: sepolia,
        signer: turnkeySigner,
      });
  
      return provider;
    } catch (e) {
      console.error("Error during passkey signature", e);
    }
  }
  
  async function createSubOrganization(authenticatorParams: Awaited<ReturnType<typeof createPasskey>>) {
    const stamper = new ApiKeyStamper({
      apiPublicKey: process.env.EXPO_PUBLIC_TURNKEY_API_PUBLIC_KEY,
      apiPrivateKey: process.env.EXPO_PUBLIC_TURNKEY_API_PRIVATE_KEY,
    });
  
    const client = new TurnkeyClient(
      { baseUrl: "https://api.turnkey.com" },
      stamper,
    );
  
    const data = await client.createSubOrganization({
      type: "ACTIVITY_TYPE_CREATE_SUB_ORGANIZATION_V4",
      timestampMs: String(Date.now()),
      organizationId: process.env.EXPO_PUBLIC_TURNKEY_ORGANIZATION_ID,
      parameters: {
        subOrganizationName: `Sub-organization at ${String(Date.now())}`,
        rootQuorumThreshold: 1,
        rootUsers: [
          {
            userName: "Root User",
            apiKeys: [],
            authenticators: [authenticatorParams],
          },
        ],
        wallet: {
          walletName: "string",
          accounts: [
            {
              curve: "CURVE_SECP256K1",
              pathFormat: "PATH_FORMAT_BIP32",
              path: "m/44'/60'/0'/0/0",
              addressFormat: "ADDRESS_FORMAT_ETHEREUM",
            },
          ],
          mnemonicLength: 24,
        },
      },
    });
  
    return data;
  }
  
  async function sendTransaction(provider: any, address: string, amount: string) {
    const ethAmount = parseEther(amount);
    const balanceFrom = await provider.getBalance({
      address: provider.account.address,
    });
  
    console.log(provider.account.address);
  
    if (balanceFrom < ethAmount) {
      alert(`Insufficient ETH balance: ${formatEther(balanceFrom)}. Need at least ${formatEther(ethAmount)}.`);
      return;
    }
  
    console.log(
      `The balance of the sender (${provider.account.address}) is: ${formatEther(balanceFrom)} ETH`
    );
  
    const transaction = await provider.sendTransaction({
      to: address,
      value: ethAmount,
    } as any);
  
    console.log(transaction);
  }
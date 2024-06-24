import React, { useCallback, useState, useMemo, createContext, useContext, useEffect } from "react";
import AsyncStorage from '@react-native-async-storage/async-storage';
import { PasskeyStamper, createPasskey, isSupported } from "@turnkey/react-native-passkey-stamper";
import { ApiKeyStamper } from "@turnkey/api-key-stamper";
import { TurnkeyClient } from "@turnkey/http";
import { TurnkeySigner, TurnkeySubOrganization } from "@alchemy/aa-signers/dist/esm/turnkey";
import { createLightAccountAlchemyClient, } from "@alchemy/aa-alchemy";
import { sepolia } from "@alchemy/aa-core";
import { Alchemy, Network, AssetTransfersCategory, AssetTransfersResult } from "alchemy-sdk";
import { Buffer } from "buffer";
import { http, parseEther, formatEther } from "viem";

const RPID = "testcreds.ericlewis.workers.dev";
const BASE_URL = "https://api.turnkey.com";

interface AccountContextType {
  provider: any;
  walletAddress: string | null;
  organizationId: string | null;
  isLoggedIn: boolean;
  isLoading: boolean;
  login: () => Promise<void>;
  signup: () => Promise<void>;
  logout: () => Promise<void>;
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
  const [organizationId, setOrganizationId] = useState<string | null>(null);
  const [isLoggedIn, setIsLoggedIn] = useState(false);
  const [isLoading, setIsLoading] = useState(false);

  useEffect(() => {
    const loadSavedData = async () => {
      setIsLoading(true);
      try {
        const savedWalletAddress = await AsyncStorage.getItem('walletAddress');
        const savedOrganizationId = await AsyncStorage.getItem('organizationId');
        if (savedWalletAddress && savedOrganizationId) {
          setWalletAddress(savedWalletAddress);
          setOrganizationId(savedOrganizationId);
          await login(savedOrganizationId, savedWalletAddress);
        }
      } catch (error) {
        console.error('Failed to load saved data:', error);
      } finally {
        setIsLoading(false);
      }
    };
    loadSavedData();
  }, []);

  const saveDataToStorage = async (wallet: string, orgId: string) => {
    try {
      await AsyncStorage.setItem('walletAddress', wallet);
      await AsyncStorage.setItem('organizationId', orgId);
    } catch (error) {
      console.error('Failed to save data:', error);
    }
  };

  const login = useCallback(async (savedOrganizationId?: string, savedWalletAddress?: string) => {
    setIsLoading(true);
    try {
      const [newProvider, orgId, walletAddress] = await onPasskeySignature(savedOrganizationId, savedWalletAddress);
      if (newProvider) {
        setProvider(newProvider);
        setWalletAddress(newProvider.account.address);
        setOrganizationId(orgId);
        await saveDataToStorage(walletAddress, orgId);
        setIsLoggedIn(true);
      }
    } catch (error) {
      console.error("Login failed:", error);
      throw error;
    } finally {
      setIsLoading(false);
    }
  }, []);

  const signup = useCallback(async () => {
    setIsLoading(true);
    try {
      const result = await onPasskeyCreate();
      if (result) {
        const { provider: newProvider, organizationId: newOrganizationId, address: newWalletAddress } = result;
        setProvider(newProvider);
        setWalletAddress(newProvider.account.address);
        setOrganizationId(newOrganizationId);
        await saveDataToStorage(newWalletAddress, newOrganizationId);
        setIsLoggedIn(true);
      }
    } catch (error) {
      console.error("Signup failed:", error);
      throw error;
    } finally {
      setIsLoading(false);
    }
  }, []);

  const logout = useCallback(async () => {
    setProvider(null);
    setWalletAddress(null);
    setOrganizationId(null);
    setIsLoggedIn(false);
    try {
      await AsyncStorage.removeItem('walletAddress');
      await AsyncStorage.removeItem('organizationId');
    } catch (error) {
      console.error('Failed to remove saved data:', error);
    }
  }, []);

  const sendTransaction = useCallback(async (address: string, amount: string) => {
    if (provider && isLoggedIn) {
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
      throw new Error("Provider not initialized or not logged in. Please login or signup first.");
    }
  }, [provider, isLoggedIn]);

  const getTransactions = useCallback(async (): Promise<AssetTransfersResult[]> => {
    if (!provider || !walletAddress || !isLoggedIn) {
      throw new Error("Not logged in or wallet address not set. Please login or signup first.");
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

      const allTransfers = [...sentTransfers.transfers, ...receivedTransfers.transfers]
        .sort((a, b) => parseInt(b.blockNum) - parseInt(a.blockNum));

      return allTransfers;
    } catch (error) {
      console.error("Error fetching transactions:", error);
      throw error;
    }
  }, [provider, walletAddress, isLoggedIn]);

  const getBalance = useCallback(async (): Promise<string> => {
    if (!provider || !walletAddress || !isLoggedIn) {
      throw new Error("Not logged in or wallet address not set. Please login or signup first.");
    }
    try {
      const balance = await provider.getBalance({ address: walletAddress });
      return formatEther(balance);
    } catch (error) {
      console.error("Error fetching balance:", error);
      throw error;
    }
  }, [provider, walletAddress, isLoggedIn]);

  const value = useMemo(() => ({
    provider,
    walletAddress,
    organizationId,
    isLoggedIn,
    isLoading,
    login,
    signup,
    logout,
    sendTransaction,
    getTransactions,
    getBalance,
  }), [provider, walletAddress, organizationId, isLoggedIn, isLoading, login, signup, logout, sendTransaction, getTransactions, getBalance]);

  return <AccountContext.Provider value={value}>{children}</AccountContext.Provider>;
};

async function onPasskeyCreate() {
  if (!isSupported()) {
    throw new Error("Passkeys are not supported on this device");
  }

  try {
    const now = new Date();
    const humanReadableDateTime = `${now.getFullYear()}-${now.getMonth() + 1}-${now.getDate()}@${now.getHours()}h${now.getMinutes()}min`;

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

    const response = await createSubOrganization(authenticatorParams);
    const organizationId = response.activity.result.createSubOrganizationResultV4!.subOrganizationId;
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

    return { provider, organizationId, address };
  } catch (e) {
    console.error("Error during passkey creation", e);
    throw e;
  }
}

async function onPasskeySignature(savedOrganizationId?: string | null, savedWalletAddress?: string | null): Promise<[any, string, string]> {
  try {
    const stamper = new PasskeyStamper({ rpId: RPID });
    const turnkeySigner = new TurnkeySigner({
      apiUrl: BASE_URL,
      stamper,
    });

    let organizationId = savedOrganizationId;
    let address = savedWalletAddress;

    if (!organizationId || !address) {
      const client = new TurnkeyClient({ baseUrl: BASE_URL }, stamper);
      const whoamiResponse = await client.getWhoami({
        organizationId: process.env.EXPO_PUBLIC_TURNKEY_ORGANIZATION_ID,
      });
      organizationId = whoamiResponse.organizationId;
      const { wallets: [{ walletId }] } = await client.getWallets({ organizationId });
      const { accounts: [{ address: fetchedAddress }] } = await client.getWalletAccounts({ organizationId, walletId });
      address = fetchedAddress;
    }

    await turnkeySigner.authenticate({
      resolveSubOrganization: async () => {
        return new TurnkeySubOrganization({
          subOrganizationId: organizationId!,
          signWith: address!,
        });
      },
      transport: http(`https://eth-sepolia.g.alchemy.com/v2/${process.env.EXPO_PUBLIC_ALCHEMY_API_KEY}`) as any,
    });

    const provider = await createLightAccountAlchemyClient({
      apiKey: process.env.EXPO_PUBLIC_ALCHEMY_API_KEY,
      chain: sepolia,
      signer: turnkeySigner,
    });

    return [provider, organizationId!, address!];
  } catch (e) {
    console.error("Error during passkey signature", e);
    throw e;
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
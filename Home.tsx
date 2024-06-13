import { StatusBar } from "expo-status-bar";
import { Button, StyleSheet, Text, TextInput, View } from "react-native";
import { useCallback, useState } from "react";

import { PasskeyStamper, createPasskey, isSupported } from "@turnkey/react-native-passkey-stamper";
import { ApiKeyStamper } from "@turnkey/api-key-stamper";
import { TurnkeyClient } from "@turnkey/http";
import { TurnkeySigner, TurnkeySubOrganization } from "@alchemy/aa-signers/dist/esm/turnkey";
import { createLightAccountAlchemyClient } from "@alchemy/aa-alchemy";
import { sepolia } from "@alchemy/aa-core";

import { Buffer } from "buffer";
import { http, parseEther, formatEther } from "viem";

const RPID = "testcreds.ericlewis.workers.dev";

export default function Home() {
  const [provider, setProvider] = useState<any>(null);
  const [address, setAddress] = useState<string>("0x4481cD4231c27f1fE64df32604a33Bdb1F6248Ea");
  const [amount, setAmount] = useState<string>("0.0");

  const login = useCallback(async () => {
    if (!provider) {
      const newProvider = await onPasskeySignature();
      setProvider(newProvider);
    }
  }, [provider]);

  const handleSendTransaction = useCallback(async () => {
    if (provider) {
      await sendTransaction(provider, address, amount);
    } else {
      alert("You need to sign in first");
    }
  }, [provider, address, amount]);

  return (
    <View style={styles.container}>
      <Text style={styles.title}>Native Passkeys + Turnkey</Text>
      {provider ? null : <Button title="Sign Up" onPress={onPasskeyCreate} />}
      {provider ? null : <Button title="Sign In & get your ID" onPress={login} />}
      {provider ? <TextInput placeholder="Recipient address" value={address} onChangeText={setAddress} /> : null}
      {provider ? <TextInput placeholder="Amount" value={amount} onChangeText={setAmount} /> : null}
      {provider ? <Button title="Send monies" onPress={handleSendTransaction} /> : null}
      <StatusBar style="auto" />
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: "#fff",
    alignItems: "center",
    justifyContent: "center",
  },
  title: {
    fontSize: 24,
    fontWeight: "600",
    margin: 42,
  },
});

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

    alert(
      `Sub-org created! Your ID: ${response.activity.result.createSubOrganizationResultV4?.subOrganizationId}`,
    );
  } catch (e) {
    console.error("Error during passkey creation", e);
  }
}

async function onPasskeySignature() {
  try {
    const BASE_URL = "https://api.turnkey.com";

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

async function createSubOrganization(
  authenticatorParams: Awaited<ReturnType<typeof createPasskey>>,
) {
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

async function sendTransaction(provider, address, amount) {
  const ethAmount = parseEther(amount);
  const balanceFrom = await provider.getBalance({
    address: provider.account.address,
  });

  console.log(provider.account.address);

  if (balanceFrom < ethAmount) {
    throw new Error(`Insufficient ETH balance: ${formatEther(balanceFrom)}. Need at least ${formatEther(ethAmount)}.`);
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
import { StatusBar } from 'expo-status-bar';
import { Button, StyleSheet, Text, View } from 'react-native';
import { PasskeyStamper, createPasskey, isSupported } from "@turnkey/react-native-passkey-stamper";
import {TURNKEY_ORGANIZATION_ID, TURNKEY_API_PUBLIC_KEY, TURNKEY_API_PRIVATE_KEY} from "@env"
import { ApiKeyStamper } from "./ApiKeyStamper";
import { TurnkeyClient } from "@turnkey/http";

const RPID = "passkeyapp.tkhqlabs.xyz"

export default function App() {
  return (
    <View style={styles.container}>
      <Text style={styles.title}>Passkey + Turnkey</Text>
      <Button title='Sign Up' onPress={onPasskeyCreate}></Button>
      <Button title='Sign In & get your ID' onPress={onPasskeySignature}></Button>
      <StatusBar style="auto" />
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#fff',
    alignItems: 'center',
    justifyContent: 'center',
  },
  title: {
    fontSize: 24,
    fontWeight: '600',
    margin: 42,
  },
});


async function onPasskeyCreate() {
  if (!isSupported()) {
    alert("Passkeys are not supported on this device")
  }

  try {
    const authenticatorParams = await createPasskey({
      // This doesn't matter much, it will be the name of the authenticator persisted on the Turnkey side.
      // Won't be visible by default.
      authenticatorName: "New Passkey",
      rp: {
        id: RPID,
        name: "Passkey App",
      },
      user: {
        id: "new-id",
        name: "Newest Passkey",
        displayName: "Newest Passkey",
      },
    })
    console.log("passkey registration succeeded: ", authenticatorParams);
    const response = await createSubOrganization(authenticatorParams);
    console.log("created sub-org", response)
    alert(`Sub-org created! Your ID: ${response.activity.result.createSubOrganizationResultV4?.subOrganizationId}`);
  } catch(e) {
    console.error("error during passkey creation", e);
  }
}

async function onPasskeySignature() {
  try {
    const stamper = await new PasskeyStamper({
      rpId: RPID,
    });
    const client = new TurnkeyClient({baseUrl: "https://api.turnkey.com"}, stamper);
    const getWhoamiResult = await client.getWhoami({
      organizationId: TURNKEY_ORGANIZATION_ID
    })
    console.log("passkey authentication succeeded: ", getWhoamiResult);
    alert(`Successfully logged into sub-organization ${getWhoamiResult.organizationId}`)
  } catch(e) {
    console.error("error during passkey signature", e);
  }
}

async function createSubOrganization(authenticatorParams: Awaited<ReturnType<typeof createPasskey>>) {
  const stamper = new ApiKeyStamper({
    apiPublicKey: TURNKEY_API_PUBLIC_KEY,
    apiPrivateKey: TURNKEY_API_PRIVATE_KEY,
  });
  const client = new TurnkeyClient({baseUrl: "https://api.turnkey.com"}, stamper);

  const data = await client.createSubOrganization({
    type: "ACTIVITY_TYPE_CREATE_SUB_ORGANIZATION_V4",
    timestampMs: String(Date.now()),
    organizationId: TURNKEY_ORGANIZATION_ID,
    parameters: {
      subOrganizationName: `Sub-organization at ${String(Date.now())}`,
      rootQuorumThreshold: 1,
      rootUsers: [
        {
          userName: "Root end-user",
          apiKeys: [],
          authenticators: [authenticatorParams]
        },
      ],
    }
  });
  return data
}

/**
 * Simple util to convert a base64-encoded string to base64url
 */
function base64Tobase64url(s: string): string {
  return s.replace(/\+/g, "-").replace(/\//g, "_").replace(/=/g, "")
}
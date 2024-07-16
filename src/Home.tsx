import React, { useCallback, useState, useEffect } from "react";
import { 
  StyleSheet, 
  TextInput, 
  View, 
  Text,
  Button
} from "react-native";
import { useSnowball } from './useAccount';

export default function Home() {
  const snowball = useSnowball()
  const passkeyAuth = snowball.auth.passkey
  const wallet = passkeyAuth.wallet
  const [email, setEmail] = useState("ericlewis777+1@gmail.com")
  const [code, setCode] = useState("")
  const [otpSent, setOtpSent] = useState(false);
  const [isSendingOtp, setIsSendingOtp] = useState(false);
  const [isVerifyingOtp, setIsVerifyingOtp] = useState(false);

  const sendOtp = useCallback(async () => {
    setIsSendingOtp(true);
    await passkeyAuth.sendOtp({ email });
    setOtpSent(true);
    setIsSendingOtp(false);
  }, [passkeyAuth, email]);

  const verifyOtp = useCallback(async () => {
    setIsVerifyingOtp(true);
    await passkeyAuth.verifyOtp({ code });
    await passkeyAuth.createPasskey({
      name: 'demo',
    });
    setIsVerifyingOtp(false);
  }, [passkeyAuth, code]);

  return (
    <View style={styles.container}>
      {wallet ? (
        <View>
          <Text>Logged in successfully!</Text>
          <Text>Wallet Address: {wallet?.account?.address}</Text>
        </View>
      ) : (
        <>
          <TextInput
            style={styles.input}
            placeholder="Enter your email"
            value={email}
            onChangeText={setEmail}
            keyboardType="email-address"
            autoCapitalize="none"
          />
          {otpSent ? (
            <View style={styles.otpContainer}>
              <TextInput
                style={styles.input}
                placeholder="Enter OTP"
                value={code}
                onChangeText={setCode}
                keyboardType="numeric"
              />
              <Button title="Verify OTP" onPress={verifyOtp} disabled={code.length < 6 || isVerifyingOtp} />
            </View>
          ) : (
            <Button title="Send OTP" onPress={sendOtp} disabled={isSendingOtp} />
          )}
        </>
      )}
    </View>
  )
}

const styles = StyleSheet.create({
  safeArea: {
    flex: 1,
    backgroundColor: "#f5f5f5",
  },
  container: {
    padding: 20,
  },
  input: {
    height: 40,
    borderColor: 'gray',
    borderWidth: 1,
    marginBottom: 10,
    paddingHorizontal: 10,
    borderRadius: 5,
  },
  otpContainer: {
    marginTop: 10,
  },
});
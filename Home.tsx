import React, { useCallback, useState, useEffect } from "react";
import { StatusBar } from "expo-status-bar";
import { Button, StyleSheet, Text, TextInput, View, FlatList } from "react-native";
import { useAccount } from './useAccount'; // Update this path
import { AssetTransfersResult } from "alchemy-sdk";

export default function Home() {
  const { provider, walletAddress, isLoggedIn, login, signup, sendTransaction, getTransactions, getBalance } = useAccount();
  const [address, setAddress] = useState<string>("0x4481cD4231c27f1fE64df32604a33Bdb1F6248Ea");
  const [amount, setAmount] = useState<string>("0.0");
  const [transactions, setTransactions] = useState<any[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [balance, setBalance] = useState<string>("0");

  const handleLogin = useCallback(async () => {
    try {
      await login();
    } catch (error) {
      console.error("Login failed:", error);
      alert("Login failed. Please try again.");
    }
  }, [login]);

  const handleSignup = useCallback(async () => {
    try {
      await signup();
    } catch (error) {
      console.error("Signup failed:", error);
      alert("Signup failed. Please try again.");
    }
  }, [signup]);

  const handleSendTransaction = useCallback(async () => {
    if (provider) {
      try {
        await sendTransaction(address, amount);
        alert("Transaction sent successfully!");
        // Refresh balance / transactions after sending
        fetchBalance();
        fetchTransactions();
      } catch (error) {
        console.error("Transaction failed:", error);
        alert("Transaction failed. Please try again.");
      }
    } else {
      alert("You need to sign in first");
    }
  }, [provider, sendTransaction, address, amount]);

  const fetchTransactions = useCallback(async () => {
    if (walletAddress) {
      setIsLoading(true);
      try {
        const txs = await getTransactions(); // Fetch sent transactions
        setTransactions(txs);
      } catch (error) {
        console.error("Error fetching transactions:", error);
        alert("Failed to fetch transactions. Please try again.");
      } finally {
        setIsLoading(false);
      }
    }
  }, [walletAddress, getTransactions]);

  const fetchBalance = useCallback(async () => {
    if (walletAddress) {
      try {
        const newBalance = await getBalance();
        setBalance(newBalance);
      } catch (error) {
        console.error("Error fetching balance:", error);
        alert("Failed to fetch balance. Please try again.");
      }
    }
  }, [walletAddress, getBalance]);

  useEffect(() => {
    if (isLoggedIn) {
      fetchBalance();
      fetchTransactions();
    }
  }, [isLoggedIn, fetchBalance, fetchTransactions]);

  const renderTransaction = ({ item }: { item: AssetTransfersResult }) => (
    <View style={styles.transaction}>
      <Text style={styles.transactionType}>
        {item.from.toLowerCase() === walletAddress?.toLowerCase() ? 'Sent' : 'Received'}
      </Text>
      <Text>
        {item.from.toLowerCase() === walletAddress?.toLowerCase() ? `To: ${item.to}` : `From: ${item.from}`}
      </Text>
      <Text>Value: {item.value} {item.asset}</Text>
      <Text>Block: {item.blockNum}</Text>
    </View>
  );

  return (
    <View style={styles.container}>      
      {!provider ? (
        <>
          <Button title="Sign Up" onPress={handleSignup} />
          <Button title="Sign In" onPress={handleLogin} />
        </>
      ) : (
        <>
          <Text>Wallet Address: {walletAddress}</Text>
          <Text style={styles.balance}>Balance: {balance} ETH</Text>
          <TextInput
            style={styles.input}
            placeholder="Recipient address"
            value={address}
            onChangeText={setAddress}
          />
          <TextInput
            style={styles.input}
            placeholder="Amount"
            value={amount}
            onChangeText={setAmount}
            keyboardType="numeric"
          />
          <Button title="Send Transaction" onPress={handleSendTransaction} />
          
          <Text style={styles.subtitle}>Recent Transactions</Text>
          {isLoading ? (
            <Text>Loading transactions...</Text>
          ) : (
            <FlatList
              data={transactions}
              renderItem={renderTransaction}
              keyExtractor={(item) => item.hash}
              style={styles.list}
            />
          )}
        </>
      )}
      
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
    padding: 20,
  },
  title: {
    fontSize: 24,
    fontWeight: "600",
    marginBottom: 20,
  },
  subtitle: {
    fontSize: 18,
    fontWeight: "600",
    marginTop: 20,
    marginBottom: 10,
  },
  input: {
    width: '100%',
    height: 40,
    borderColor: 'gray',
    borderWidth: 1,
    marginBottom: 10,
    paddingHorizontal: 10,
  },
  list: {
    width: '100%',
    marginTop: 10,
  },
  transaction: {
    padding: 10,
    borderBottomWidth: 1,
    borderBottomColor: '#ccc',
  },
  transactionType: {
    fontWeight: 'bold',
    marginBottom: 5,
  },
  balance: {
    fontSize: 18,
    fontWeight: "bold",
    marginVertical: 10,
  },
});
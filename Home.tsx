import React, { useCallback, useState, useEffect } from "react";
import { 
  StyleSheet, 
  Text, 
  TextInput, 
  View, 
  Alert, 
  ActivityIndicator, 
  TouchableOpacity,
  Clipboard,
  ScrollView,
  SafeAreaView,
  RefreshControl
} from "react-native";
import { StatusBar } from "expo-status-bar";
import { useAccount } from './useAccount';
import { AssetTransfersResult } from "alchemy-sdk";
import { Ionicons } from '@expo/vector-icons';

const truncateAddress = (address: string) => {
  return `${address.slice(0, 6)}...${address.slice(-4)}`;
};

const formatEthValue = (value: string) => {
  return parseFloat(value).toFixed(6);
};

const TransactionItem = ({ item, walletAddress }: { item: AssetTransfersResult; walletAddress: string | null }) => (
  <View style={styles.transactionItem}>
    <View style={styles.transactionIcon}>
      {item.from.toLowerCase() === walletAddress?.toLowerCase() ? (
        <Ionicons name="arrow-up" size={24} color="red" />
      ) : (
        <Ionicons name="arrow-down" size={24} color="green" />
      )}
    </View>
    <View style={styles.transactionDetails}>
      <Text style={styles.transactionType}>
        {item.from.toLowerCase() === walletAddress?.toLowerCase() ? 'Sent' : 'Received'}
      </Text>
      <Text>
        {item.from.toLowerCase() === walletAddress?.toLowerCase() ? `To: ${truncateAddress(item.to as any)}` : `From: ${truncateAddress(item.from)}`}
      </Text>
      <Text>Value: {formatEthValue(item.value as any)} {item.asset}</Text>
      <Text>Block: {item.blockNum}</Text>
    </View>
  </View>
);

export default function Home() {
  const { provider, walletAddress, isLoggedIn, isLoading, login, signup, sendTransaction, getTransactions, getBalance } = useAccount();
  const [address, setAddress] = useState<string>("0x4481cD4231c27f1fE64df32604a33Bdb1F6248Ea");
  const [amount, setAmount] = useState<string>("0.0");
  const [transactions, setTransactions] = useState<AssetTransfersResult[]>([]);
  const [isFetchingTransactions, setIsFetchingTransactions] = useState(false);
  const [balance, setBalance] = useState<string>("0");
  const [isFetchingBalance, setIsFetchingBalance] = useState(false);
  const [refreshing, setRefreshing] = useState(false);
  const [isSendingTransaction, setIsSendingTransaction] = useState(false);

  const handleLogin = useCallback(async () => {
    try {
      await login();
    } catch (error) {
      console.error("Login failed:", error);
      Alert.alert("Login Failed", "Please try again.");
    }
  }, [login]);

  const handleSignup = useCallback(async () => {
    try {
      await signup();
    } catch (error) {
      console.error("Signup failed:", error);
      Alert.alert("Signup Failed", "Please try again.");
    }
  }, [signup]);

  const handleSendTransaction = useCallback(async () => {
    if (provider) {
      setIsSendingTransaction(true);
      try {
        await sendTransaction(address, amount);
        setAmount("0.0");
        Alert.alert("Success", "Transaction sent successfully!");
        fetchBalance();
        fetchTransactions();
      } catch (error) {
        console.error("Transaction failed:", error);
        Alert.alert("Transaction Failed", "Please try again.");
      } finally {
        setIsSendingTransaction(false);
      }
    } else {
      Alert.alert("Error", "You need to sign in first");
    }
  }, [provider, sendTransaction, address, amount]);

  const fetchTransactions = useCallback(async () => {
    if (walletAddress) {
      setIsFetchingTransactions(true);
      try {
        const txs = await getTransactions();
        setTransactions(txs);
      } catch (error) {
        console.error("Error fetching transactions:", error);
        Alert.alert("Error", "Failed to fetch transactions. Please try again.");
      } finally {
        setIsFetchingTransactions(false);
      }
    }
  }, [walletAddress, getTransactions]);

  const fetchBalance = useCallback(async () => {
    if (walletAddress) {
      setIsFetchingBalance(true);
      try {
        const newBalance = await getBalance();
        setBalance(newBalance);
      } catch (error) {
        console.error("Error fetching balance:", error);
        Alert.alert("Error", "Failed to fetch balance. Please try again.");
      } finally {
        setIsFetchingBalance(false);
      }
    }
  }, [walletAddress, getBalance]);

  const onRefresh = useCallback(async () => {
    setRefreshing(true);
    await Promise.all([fetchBalance(), fetchTransactions()]);
    setRefreshing(false);
  }, [fetchBalance, fetchTransactions]);

  useEffect(() => {
    if (isLoggedIn) {
      fetchBalance();
      fetchTransactions();
    }
  }, [isLoggedIn, fetchBalance, fetchTransactions]);

  const copyToClipboard = (text: string) => {
    Clipboard.setString(text);
    Alert.alert("Copied", "Address copied to clipboard");
  };

  if (isLoading) {
    return (
      <View style={[styles.container, styles.centerContent]}>
        <ActivityIndicator size="large" />
      </View>
    );
  }

  return (
    <SafeAreaView style={styles.safeArea}>
      <StatusBar style="auto" />
      <ScrollView 
        style={styles.scrollView}
        contentContainerStyle={styles.scrollViewContent}
        refreshControl={
          <RefreshControl refreshing={refreshing} onRefresh={onRefresh} />
        }
      >
        {!provider ? (
          <View style={styles.authContainer}>
            <Text style={styles.title}>Welcome to Passkeys + TurnKey + Alchemy</Text>
            <TouchableOpacity style={styles.button} onPress={handleSignup}>
              <Text style={styles.buttonText}>Sign Up</Text>
            </TouchableOpacity>
            <TouchableOpacity style={styles.button} onPress={handleLogin}>
              <Text style={styles.buttonText}>Sign In</Text>
            </TouchableOpacity>
          </View>
        ) : (
          <>
            <View style={styles.card}>
              <Text style={styles.cardTitle}>Wallet Address</Text>
              <TouchableOpacity onPress={() => copyToClipboard(walletAddress || '')}>
                <Text style={styles.address}>{truncateAddress(walletAddress || '')}</Text>
              </TouchableOpacity>
              <View style={styles.balanceContainer}>
                <Text style={styles.balanceLabel}>Balance:</Text>
                {isFetchingBalance ? (
                  <ActivityIndicator size="small" color="#6200EE" />
                ) : (
                  <Text style={styles.balanceValue}>{formatEthValue(balance)} ETH</Text>
                )}
              </View>
            </View>

            <View style={styles.card}>
              <Text style={styles.cardTitle}>Send Transaction</Text>
              <TextInput
                style={styles.input}
                placeholder="Recipient address"
                value={address}
                onChangeText={setAddress}
                editable={!isSendingTransaction}
              />
              <TextInput
                style={styles.input}
                placeholder="Amount (ETH)"
                value={amount}
                onChangeText={setAmount}
                keyboardType="numeric"
                editable={!isSendingTransaction}
              />
              {isSendingTransaction ? (
                <View style={styles.loadingContainer}>
                  <ActivityIndicator size="small" color="#6200EE" />
                  <Text style={styles.loadingText}>Submitting transaction...</Text>
                </View>
              ) : (
                <TouchableOpacity 
                  style={styles.sendButton} 
                  onPress={handleSendTransaction}
                  disabled={!address || !amount || amount === "0.0"}
                >
                  <Text style={styles.buttonText}>Send Transaction</Text>
                </TouchableOpacity>
              )}
            </View>
            
            <View style={styles.card}>
              <Text style={styles.cardTitle}>Recent Transactions</Text>
              {isFetchingTransactions ? (
                <View style={styles.loadingTransactions}>
                  <ActivityIndicator size="large" color="#6200EE" />
                  <Text>Loading transactions...</Text>
                </View>
              ) : transactions.length > 0 ? (
                transactions.map((item) => (
                  <TransactionItem key={item.hash} item={item} walletAddress={walletAddress} />
                ))
              ) : (
                <Text style={styles.noTransactions}>No transactions found.</Text>
              )}
            </View>
          </>
        )}
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safeArea: {
    flex: 1,
    backgroundColor: "#f5f5f5",
  },
  scrollView: {
    flex: 1,
  },
  scrollViewContent: {
    padding: 20,
  },
  container: {
    flex: 1,
  },
  centerContent: {
    justifyContent: 'center',
    alignItems: 'center',
  },
  authContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    minHeight: 400,  // Ensure minimum height for smaller screens
  },
  title: {
    fontSize: 24,
    fontWeight: "700",
    marginBottom: 30,
    textAlign: 'center',
  },
  card: {
    backgroundColor: '#ffffff',
    borderRadius: 10,
    padding: 20,
    marginBottom: 20,
    shadowColor: "#000",
    shadowOffset: {
      width: 0,
      height: 2,
    },
    shadowOpacity: 0.23,
    shadowRadius: 2.62,
    elevation: 4,
  },
  cardTitle: {
    fontSize: 18,
    fontWeight: "600",
    marginBottom: 10,
  },
  address: {
    fontSize: 16,
    color: '#6200EE',
    marginBottom: 10,
  },
  balanceContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 10,
  },
  balanceLabel: {
    fontSize: 16,
    marginRight: 10,
  },
  balanceValue: {
    fontSize: 18,
    fontWeight: "bold",
  },
  input: {
    width: '100%',
    height: 40,
    borderColor: '#ddd',
    borderWidth: 1,
    borderRadius: 5,
    marginBottom: 10,
    paddingHorizontal: 10,
  },
  button: {
    backgroundColor: '#6200EE',
    padding: 15,
    borderRadius: 5,
    alignItems: 'center',
    marginVertical: 10,
    width: '100%',
  },
  loadingContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    marginTop: 10,
  },
  loadingText: {
    marginLeft: 10,
    color: '#6200EE',
    fontSize: 14,
  },
  sendButton: {
    backgroundColor: '#6200EE',
    padding: 15,
    borderRadius: 5,
    alignItems: 'center',
    marginTop: 10,
  },
  buttonText: {
    color: '#ffffff',
    fontSize: 16,
    fontWeight: '600',
  },
  transactionItem: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 10,
    borderBottomWidth: 1,
    borderBottomColor: '#eee',
  },
  transactionIcon: {
    marginRight: 10,
  },
  transactionDetails: {
    flex: 1,
  },
  transactionType: {
    fontWeight: 'bold',
    marginBottom: 5,
  },
  loadingTransactions: {
    alignItems: 'center',
    justifyContent: 'center',
    padding: 20,
  },
  noTransactions: {
    textAlign: 'center',
    marginTop: 20,
    fontSize: 16,
    color: '#666',
  },
});
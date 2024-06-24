import "fastestsmallesttextencoderdecoder";
import "react-native-get-random-values"
import "./src/Base64";

import React from "react";
import { NavigationContainer } from "@react-navigation/native";
import { createNativeStackNavigator } from "@react-navigation/native-stack";
import HomeScreen from "./src/Home";
import { AccountProvider } from "./src/useAccount";

const Stack = createNativeStackNavigator();

function App() {
  return (
    <AccountProvider>
      <NavigationContainer>
        <Stack.Navigator initialRouteName="Passkeys + TurnKey + Alchemy">
          <Stack.Screen name="Passkeys + TurnKey + Alchemy" component={HomeScreen} />
        </Stack.Navigator>
      </NavigationContainer>
    </AccountProvider>
  );
}

export default App;

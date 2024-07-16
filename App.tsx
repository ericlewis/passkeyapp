import "fastestsmallesttextencoderdecoder";
import "react-native-get-random-values"
import "./src/Base64";

import React from "react";
import { NavigationContainer } from "@react-navigation/native";
import { createNativeStackNavigator } from "@react-navigation/native-stack";
import HomeScreen from "./src/Home";

const Stack = createNativeStackNavigator();

function App() {
  return (
    <NavigationContainer>
      <Stack.Navigator initialRouteName="Passkeys + TurnKey + Alchemy">
        <Stack.Screen name="Passkeys + TurnKey + Alchemy" component={HomeScreen} />
      </Stack.Navigator>
    </NavigationContainer>
  );
}

export default App;

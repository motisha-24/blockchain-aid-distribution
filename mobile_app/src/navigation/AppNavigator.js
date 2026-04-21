import { ActivityIndicator, View } from "react-native";
import { NavigationContainer } from "@react-navigation/native";
import { createNativeStackNavigator } from "@react-navigation/native-stack";
import { useAuth } from "../context/AuthContext";
import BeneficiariesScreen from "../screens/BeneficiariesScreen";
import BeneficiaryDetailScreen from "../screens/BeneficiaryDetailScreen";
import DashboardScreen from "../screens/DashboardScreen";
import LoginScreen from "../screens/LoginScreen";
import QueueDiagnosticsScreen from "../screens/QueueDiagnosticsScreen";
import UnlockScreen from "../screens/UnlockScreen";

const Stack = createNativeStackNavigator();

function SplashScreen() {
  return (
    <View style={{ flex: 1, alignItems: "center", justifyContent: "center" }}>
      <ActivityIndicator size="large" />
    </View>
  );
}

export default function AppNavigator() {
  const { isReady, isLoggedIn, biometricEnabled, isUnlocked } = useAuth();

  if (!isReady) {
    return <SplashScreen />;
  }

  return (
    <NavigationContainer>
      <Stack.Navigator>
        {!isLoggedIn ? (
          <Stack.Screen
            name="Login"
            component={LoginScreen}
            options={{ headerShown: false }}
          />
        ) : biometricEnabled && !isUnlocked ? (
          <Stack.Screen
            name="Unlock"
            component={UnlockScreen}
            options={{ headerShown: false }}
          />
        ) : (
          <>
            <Stack.Screen name="Dashboard" component={DashboardScreen} />
            <Stack.Screen name="Beneficiaries" component={BeneficiariesScreen} />
            <Stack.Screen
              name="QueueDiagnostics"
              component={QueueDiagnosticsScreen}
              options={{ title: "Queue Diagnostics" }}
            />
            <Stack.Screen
              name="BeneficiaryDetail"
              component={BeneficiaryDetailScreen}
              options={{ title: "Beneficiary Profile" }}
            />
          </>
        )}
      </Stack.Navigator>
    </NavigationContainer>
  );
}

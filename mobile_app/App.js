import { StatusBar } from "expo-status-bar";
import { SafeAreaProvider } from "react-native-safe-area-context";
import { AuthProvider } from "./src/context/AuthContext";
import { DataProvider } from "./src/context/DataContext";
import AppNavigator from "./src/navigation/AppNavigator";

export default function App() {
  return (
    <SafeAreaProvider>
      <AuthProvider>
        <DataProvider>
          <StatusBar style="dark" />
          <AppNavigator />
        </DataProvider>
      </AuthProvider>
    </SafeAreaProvider>
  );
}

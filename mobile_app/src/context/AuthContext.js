import { AppState, createContext, useContext, useEffect, useMemo, useState } from "react";
import { login as loginApi } from "../api/endpoints";
import {
  clearUser,
  getBiometricEnabled,
  getUser,
  saveBiometricEnabled,
  saveUser,
} from "../storage/localStore";
import { deleteToken, getToken, saveToken } from "../storage/secure";
import { canUseBiometric, requestBiometricUnlock } from "../utils/biometric";

const AuthContext = createContext(null);

export function AuthProvider({ children }) {
  const [user, setUser] = useState(null);
  const [isReady, setIsReady] = useState(false);
  const [biometricEnabled, setBiometricEnabled] = useState(true);
  const [isUnlocked, setIsUnlocked] = useState(true);

  useEffect(() => {
    async function bootstrap() {
      const [token, cachedUser, biometricPref] = await Promise.all([
        getToken(),
        getUser(),
        getBiometricEnabled(),
      ]);
      setBiometricEnabled(Boolean(biometricPref));
      if (token && cachedUser) {
        setUser(cachedUser);
        if (biometricPref) {
          setIsUnlocked(false);
        }
      }
      setIsReady(true);
    }
    bootstrap();
  }, []);

  useEffect(() => {
    if (!user || !biometricEnabled) {
      return undefined;
    }
    const hasAppStateListener =
      Boolean(AppState) && typeof AppState.addEventListener === "function";
    if (!hasAppStateListener) {
      return undefined;
    }
    const sub = AppState.addEventListener("change", (state) => {
      if (state !== "active") {
        setIsUnlocked(false);
      }
    });
    return () => {
      if (sub && typeof sub.remove === "function") {
        sub.remove();
      }
    };
  }, [user, biometricEnabled]);

  const value = useMemo(
    () => ({
      user,
      isReady,
      isLoggedIn: Boolean(user),
      biometricEnabled,
      isUnlocked,
      async login(username, password) {
        const data = await loginApi({ username, password });
        if (!data.token) {
          throw new Error("No auth token returned by server");
        }
        const role = String(data.role || "").toUpperCase();
        if (role !== "NGO") {
          throw new Error(
            "Mobile access is restricted to NGO officers only. Please use an NGO account."
          );
        }
        const authUser = { username, role: role || "NGO" };
        const biometricAvailable = await canUseBiometric();
        await Promise.all([
          saveToken(data.token),
          saveUser(authUser),
          saveBiometricEnabled(biometricAvailable),
        ]);
        setBiometricEnabled(biometricAvailable);
        setUser(authUser);
        // Keep session unlocked immediately after successful login.
        // It will lock when app goes to background/inactive.
        setIsUnlocked(true);
        return data;
      },
      async unlock() {
        if (!biometricEnabled) {
          setIsUnlocked(true);
          return { success: true };
        }
        const result = await requestBiometricUnlock();
        setIsUnlocked(Boolean(result.success));
        return result;
      },
      async logout() {
        await Promise.all([deleteToken(), clearUser()]);
        setUser(null);
        setIsUnlocked(true);
      },
    }),
    [user, isReady, biometricEnabled, isUnlocked]
  );

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth() {
  const ctx = useContext(AuthContext);
  if (!ctx) {
    throw new Error("useAuth must be used inside AuthProvider");
  }
  return ctx;
}

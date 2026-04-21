import * as LocalAuthentication from "expo-local-authentication";

export async function canUseBiometric() {
  const [hasHardware, isEnrolled] = await Promise.all([
    LocalAuthentication.hasHardwareAsync(),
    LocalAuthentication.isEnrolledAsync(),
  ]);
  return hasHardware && isEnrolled;
}

export async function requestBiometricUnlock() {
  return LocalAuthentication.authenticateAsync({
    promptMessage: "Unlock AidChain Mobile",
    fallbackLabel: "Use device passcode",
    cancelLabel: "Cancel",
    disableDeviceFallback: false,
  });
}

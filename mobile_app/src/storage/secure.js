import * as SecureStore from "expo-secure-store";
import { STORAGE_KEYS } from "../config/env";

export async function saveToken(token) {
  await SecureStore.setItemAsync(STORAGE_KEYS.TOKEN, token);
}

export async function getToken() {
  return SecureStore.getItemAsync(STORAGE_KEYS.TOKEN);
}

export async function deleteToken() {
  await SecureStore.deleteItemAsync(STORAGE_KEYS.TOKEN);
}

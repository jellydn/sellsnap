import { authClient } from "./auth";

export function useSession() {
  return authClient.useSession();
}

export function signOut() {
  return authClient.signOut();
}

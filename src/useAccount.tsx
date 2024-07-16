import { useState, useEffect } from "react";
import { LocalStorage } from "./LocalStorage";
import { EmbeddedAuth } from "./EmbeddedAuth";
import { Snowball, SnowballChain } from "@snowballtools/js-sdk";

const storage = new LocalStorage();
const apiKey = process.env.EXPO_PUBLIC_SNOWBALL_API_KEY;
const initialChain = SnowballChain.sepolia;

const snowball = Snowball.withAuth({
  passkey: EmbeddedAuth.configure({ auth: { email: true } }),
}).create({
  apiKey,
  initialChain,
  ssrMode: false,
  storage,
});

export function useSnowball() {
  const [state, setState] = useState(100) // Value doesn't matter

  useEffect(() => {
    snowball.initUserSessions();
    
    // Subscribe and directly return the unsubscribe function
    return snowball.subscribe(() => {
      setState(state + 1) // Trigger re-render
    });
  }, [state])

  return snowball
}
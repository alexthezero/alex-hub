import { drizzle } from "drizzle-orm/d1";
import { getAppBindings } from "./request-bindings";

export function getDb() {
  return drizzle(getAppBindings().DB);
}

import { AsyncLocalStorage } from "node:async_hooks";

export type AppBindings = {
  DB: D1Database;
};

type BindingGlobal = typeof globalThis & {
  __alexHubBindings?: AsyncLocalStorage<AppBindings>;
};

const bindingGlobal = globalThis as BindingGlobal;
const storage = bindingGlobal.__alexHubBindings ?? new AsyncLocalStorage<AppBindings>();
bindingGlobal.__alexHubBindings = storage;

export function runWithAppBindings<T>(bindings: AppBindings, callback: () => T): T {
  return storage.run(bindings, callback);
}

export function getAppBindings(): AppBindings {
  const bindings = storage.getStore();
  if (!bindings?.DB) throw new Error("Database binding is unavailable for this request.");
  return bindings;
}

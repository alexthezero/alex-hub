import { headers } from "next/headers";
import PersonalHub from "./personal-hub";

export const dynamic = "force-dynamic";

async function getDisplayName() {
  const requestHeaders = await headers();
  const encodedName = requestHeaders.get("oai-authenticated-user-full-name");
  const encoding = requestHeaders.get(
    "oai-authenticated-user-full-name-encoding",
  );

  if (encodedName && encoding === "percent-encoded-utf-8") {
    try {
      return decodeURIComponent(encodedName).split(" ")[0] || "Alex";
    } catch {
      return "Alex";
    }
  }

  return "Alex";
}

export default async function Home() {
  return <PersonalHub displayName={await getDisplayName()} />;
}

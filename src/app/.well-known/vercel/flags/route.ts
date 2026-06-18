import { verifyAccess } from "flags";
import { getProviderData } from "flags/next";
import { NextResponse } from "next/server";

export async function GET(request: Request) {
  const access = await verifyAccess(request.headers.get("Authorization"));
  if (!access) return NextResponse.json(null, { status: 401 });

  return NextResponse.json(
    getProviderData({
      NEXT_PUBLIC_DISCOVERY_BADGES: {
        key: "NEXT_PUBLIC_DISCOVERY_BADGES",
        options: [
          { label: "Off", value: false },
          { label: "On", value: true },
        ],
        origin:
          "https://vercel.com/sairams-projects-d50d7437/anvilry/flag/NEXT_PUBLIC_DISCOVERY_BADGES",
        description:
          "Show the ★ N/5 discovered exploration badge (bottom-right)",
        defaultValue: false,
      },
    }),
  );
}

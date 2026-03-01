import { NextResponse } from "next/server";

/**
 * Returnerar API-URL från servern (Vercel: sätt API_URL i Environment Variables, för Production).
 */
export async function GET() {
  const raw =
    process.env.API_URL ||
    process.env.NEXT_PUBLIC_API_URL ||
    "";
  const url = raw.trim().replace(/\/$/, "") || "http://localhost:5236";
  const isVercel = !!process.env.VERCEL;
  const missingInProduction = isVercel && !raw.trim();
  return NextResponse.json({
    apiUrl: url,
    ...(missingInProduction && {
      _warning: "API_URL är inte satt i Vercel. Lägg till den under Settings → Environment Variables och välj Production.",
    }),
  });
}

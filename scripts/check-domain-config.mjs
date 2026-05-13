const sentinel = "__DOMAIN_NOT_CONFIGURED__";
const value = process.env.VITE_PUBLIC_SITE_URL?.trim() || sentinel;

if (value === sentinel) {
  console.error(
    `Publishing domain is not configured. Set VITE_PUBLIC_SITE_URL, for example: VITE_PUBLIC_SITE_URL=https://quantum-color.theos.me`,
  );
  process.exit(1);
}

try {
  const url = new URL(value);
  if (url.protocol !== "https:" && !url.hostname.includes("localhost")) {
    throw new Error("Public site URL must use https outside localhost.");
  }
} catch (error) {
  console.error(`Invalid VITE_PUBLIC_SITE_URL: ${value}`);
  if (error instanceof Error) {
    console.error(error.message);
  }
  process.exit(1);
}

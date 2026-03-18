export type MailgunEnv = {
  apiKey: string;
  domain: string;
  from: string;
  baseUrl: string;
};

export function getMailgunEnv(): MailgunEnv {
  const apiKey = process.env.MAILGUN_API_KEY?.trim();
  const domain = process.env.MAILGUN_DOMAIN?.trim();
  const from = process.env.MAILGUN_FROM?.trim();
  const baseUrl = process.env.MAILGUN_BASE_URL?.trim() || "https://api.mailgun.net";

  if (!apiKey || !domain || !from) {
    throw new Error(
      "Missing Mailgun env vars. Set MAILGUN_API_KEY, MAILGUN_DOMAIN and MAILGUN_FROM."
    );
  }

  return {
    apiKey,
    domain,
    from,
    baseUrl,
  };
}

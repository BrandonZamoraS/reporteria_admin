import { getMailgunEnv } from "@/lib/mailgun/env";

export type MailgunAttachment = {
  filename: string;
  contentType: string;
  content: Buffer | Uint8Array | ArrayBuffer;
};

export type SendMailgunMessageParams = {
  to: string[];
  subject: string;
  text: string;
  html?: string;
  attachments?: MailgunAttachment[];
};

function toArrayBuffer(content: MailgunAttachment["content"]): ArrayBuffer {
  if (content instanceof ArrayBuffer) {
    return content;
  }

  return Uint8Array.from(content).buffer;
}

export async function sendMailgunMessage(params: SendMailgunMessageParams): Promise<void> {
  const env = getMailgunEnv();
  const formData = new FormData();

  formData.append("from", env.from);
  params.to.forEach((recipient) => formData.append("to", recipient));
  formData.append("subject", params.subject);
  formData.append("text", params.text);

  if (params.html) {
    formData.append("html", params.html);
  }

  for (const attachment of params.attachments ?? []) {
    formData.append(
      "attachment",
      new Blob([toArrayBuffer(attachment.content)], { type: attachment.contentType }),
      attachment.filename
    );
  }

  const authToken = Buffer.from(`api:${env.apiKey}`).toString("base64");
  const response = await fetch(`${env.baseUrl}/v3/${env.domain}/messages`, {
    method: "POST",
    headers: {
      Authorization: `Basic ${authToken}`,
    },
    body: formData,
  });

  if (!response.ok) {
    const message = await response.text();
    throw new Error(`Mailgun error: ${message || response.statusText}`);
  }
}

import type { CommunicationChannel } from "./rbac";

export interface MessageTemplate {
  key: string;
  channel: CommunicationChannel;
  name: string;
  subject: string;
  body: string;
  placeholders: string[];
}

/**
 * Substitutes every {name} placeholder with its value. Unknown placeholders
 * are left as-is so a missing value is visible rather than silently blank —
 * mirrors domain.RenderMessageTemplate on the backend.
 */
export function renderTemplate(
  body: string,
  data: Record<string, string>,
): string {
  return body.replace(/\{(\w+)\}/g, (match, name: string) =>
    name in data ? data[name] : match,
  );
}

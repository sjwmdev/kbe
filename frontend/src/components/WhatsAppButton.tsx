import { MessageCircle } from "lucide-react";
import { buildWhatsAppLink } from "../lib/whatsapp";

interface WhatsAppButtonProps {
  productName: string;
}

export function WhatsAppButton({ productName }: WhatsAppButtonProps) {
  return (
    <a
      href={buildWhatsAppLink(productName)}
      target="_blank"
      rel="noopener noreferrer"
      className="flex w-full items-center justify-center gap-2 rounded-full bg-brand-accent px-6 py-4 text-base font-bold text-white shadow-lg shadow-brand-accent/30 transition hover:bg-brand-accent-dark sm:w-auto sm:px-10"
    >
      <MessageCircle size={22} />
      Wasiliana Nasi kwa WhatsApp
    </a>
  );
}

export interface Role {
  id: string;
  name: string;
  description: string;
  created_at: string;
  updated_at: string;
}

export interface Permission {
  id: string;
  module: string;
  action: string;
  key: string;
}

export type CommunicationChannel = "dashboard" | "email" | "whatsapp";

export const COMMUNICATION_CHANNEL_LABELS: Record<CommunicationChannel, string> = {
  dashboard: "Arifa za Dashibodi",
  email: "Barua Pepe",
  whatsapp: "WhatsApp",
};

export interface AdminUser {
  id: string;
  username: string;
  name: string;
  email: string;
  phone: string;
  default_communication_channel: CommunicationChannel;
  role_id?: string;
  role_name: string;
  is_active: boolean;
  must_change_password: boolean;
  created_at: string;
}

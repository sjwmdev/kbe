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

export interface AdminUser {
  id: string;
  username: string;
  name: string;
  email: string;
  role_id?: string;
  role_name: string;
  is_active: boolean;
  must_change_password: boolean;
  created_at: string;
}

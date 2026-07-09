export interface AuditLog {
  id: string;
  username: string;
  method: string;
  path: string;
  status_code: number;
  duration_ms: number;
  ip_address: string;
  created_at: string;
}

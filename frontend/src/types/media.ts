export interface MediaFolder {
  id: string;
  name: string;
  created_at: string;
}

export interface MediaAsset {
  id: string;
  folder_id: string | null;
  folder_name?: string;
  image_url: string;
  original_filename: string;
  size_bytes: number;
  width: number;
  height: number;
  in_use_count: number;
  created_at: string;
}

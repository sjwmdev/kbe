export interface SiteSettings {
  whatsapp_number: string;
  contact_email: string;
  contact_address: string;
  instagram_url: string;
  facebook_url: string;
  company_name: string;
  logo_light_url: string;
  logo_dark_url: string;
  brand_accent_color: string;
  brand_accent_color_dark: string;
  updated_at: string;
}

export type StaticPageSlug = "about" | "contact" | "privacy" | "terms";

export interface StaticPage {
  slug: StaticPageSlug;
  title: string;
  body: string;
  updated_at: string;
}

export interface SliderPoster {
  id: string;
  image_url: string;
  link_category: string;
  display_order: number;
  is_active: boolean;
  created_at: string;
}

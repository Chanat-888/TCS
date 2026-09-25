export type ListingCategory = "new" | "deck" | "rare";
export type ListingStatus = "active" | "sold" | "cancelled" | "expired";
export type OrderStatus =
  | "PENDING_PAYMENT"
  | "PAID_HELD"
  | "SHIPPED"
  | "DELIVERED"
  | "COMPLETED"
  | "DISPUTED"
  | "CANCELLED"
  | "REFUNDED";
export type PaymentMethod = "promptpay" | "card";
export type DisputeReason = "condition" | "wrong" | "authenticity" | "other" | "not_received";
export type DisputeDecision = "refund" | "release";

export interface Profile {
  id: string;
  display_name: string;
  avatar_initial: string;
  avatar_url: string | null;
  bio: string;
  phone: string | null;
  verified: boolean;
  bank_name_matched: boolean;
  is_admin: boolean;
  tier: string | null;
  created_at: string;
}

export interface Listing {
  id: string;
  seller_id: string;
  name: string;
  set_name: string;
  category: ListingCategory;
  rarity: string;
  condition: string;
  description: string;
  description_edited_at: string | null;
  photo_front_url: string | null;
  photo_back_url: string | null;
  photos_locked: boolean;
  start_price: number;
  buy_now_price: number | null;
  current_price: number;
  /** Absent on rows read before migration 0015 is applied; treat as 100. */
  bid_increment?: number;
  ends_at: string;
  status: ListingStatus;
  created_at: string;
}

export interface Bid {
  id: string;
  listing_id: string;
  bidder_id: string;
  amount: number;
  created_at: string;
}

export interface Order {
  id: string;
  order_code: string;
  listing_id: string;
  buyer_id: string;
  seller_id: string;
  amount: number;
  status: OrderStatus;
  payment_method: PaymentMethod | null;
  shipping_recipient: string | null;
  shipping_phone: string | null;
  shipping_address: string | null;
  shipping_province: string | null;
  shipping_postcode: string | null;
  /** Absent on rows read before migration 0010 is applied; treat as "ship". */
  delivery_method?: "ship" | "meetup";
  payment_deadline_at: string | null;
  paid_at: string | null;
  courier: string | null;
  tracking_number: string | null;
  shipped_at: string | null;
  delivered_at: string | null;
  unboxing_video_url: string | null;
  video_uploaded_at: string | null;
  auto_approve_at: string | null;
  approved_at: string | null;
  completed_at: string | null;
  cancelled_at: string | null;
  created_at: string;
}

export interface Dispute {
  id: string;
  order_id: string;
  opened_by: string;
  reason: DisputeReason;
  description: string;
  evidence_photo_urls: string[];
  decision: DisputeDecision | null;
  resolution_note: string | null;
  decided_at: string | null;
  created_at: string;
}

export interface Review {
  id: string;
  order_id: string;
  rater_id: string;
  ratee_id: string;
  rating: number;
  tags: string[];
  comment: string | null;
  listing_name: string;
  created_at: string;
}

export interface Message {
  id: string;
  order_id: string;
  sender_id: string;
  body: string;
  created_at: string;
}

export type WantedPostStatus = "active" | "closed";

export interface WantedPost {
  id: string;
  poster_id: string;
  name: string;
  set_name: string;
  category: ListingCategory;
  max_price: number;
  note: string;
  status: WantedPostStatus;
  created_at: string;
}

export interface WantedPostMessage {
  id: string;
  wanted_post_id: string;
  responder_id: string;
  sender_id: string;
  body: string;
  created_at: string;
}

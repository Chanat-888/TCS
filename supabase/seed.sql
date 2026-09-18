-- Dev/demo seed data. Fixed UUIDs so app code (DEV_USER_ID) can reference
-- them directly. DragonForge doubles as the stub session's "me" AND as
-- is_admin=true, since this is a single-dev-account stub-auth phase (see
-- PRODUCT.md "Open/undecided product facts" — real auth is not built yet).
-- Money amounts here are seed/dev data, not real transactions or marketing claims.

-- ---------- profiles ----------
insert into profiles (id, display_name, avatar_initial, bio, verified, bank_name_matched, is_admin, tier, created_at) values
  ('a0000000-0000-0000-0000-000000000001', 'DragonForge', 'DF', 'สายมังกร Vanguard โดยเฉพาะ — บูสเตอร์ใหม่ทุกซีรีส์ การ์ด SP/RRR มือหนึ่ง แพ็คถ่ายวิดีโอทุกออเดอร์ก่อนส่ง', true, true, true, 'ผู้ขายอันดับต้น', '2026-03-02'),
  ('a0000000-0000-0000-0000-000000000002', 'CardVault TH', 'CV', 'ร้านการ์ด Vanguard มือสอง/มือหนึ่ง คัดสภาพก่อนลงทุกใบ', true, false, false, null, '2026-01-15'),
  ('a0000000-0000-0000-0000-000000000003', 'SakuraTCG', 'SK', 'นำเข้าการ์ดหายากจากญี่ปุ่น', true, false, false, null, '2026-02-01'),
  ('a0000000-0000-0000-0000-000000000004', 'BangkokVanguard', 'BV', 'เด็คพร้อมเล่นราคาเป็นกันเอง', false, false, false, null, '2026-04-10'),
  ('a0000000-0000-0000-0000-000000000005', 'นัท ส.', 'น', '', false, false, false, null, '2026-03-20'),
  ('a0000000-0000-0000-0000-000000000006', 'กันต์ พ.', 'ก', '', false, false, false, null, '2026-04-01'),
  ('a0000000-0000-0000-0000-000000000007', 'วิว จ.', 'ว', '', false, false, false, null, '2026-04-15');

-- ---------- active listings (browse grid) ----------
insert into listings (id, seller_id, name, set_name, category, rarity, condition, description, photo_front_url, photo_back_url, start_price, buy_now_price, current_price, ends_at, status, created_at) values
  ('b0000000-0000-0000-0000-000000000001', 'a0000000-0000-0000-0000-000000000001', 'Dragonic Overlord SP — Vanguard DZ-BT ชุดใหม่', 'Vanguard DZ-BT01', 'new', 'SP', 'สภาพสมบูรณ์ (Near Mint)', 'SP อัดฟอยล์เต็มแผ่น จากบูสเตอร์ Vanguard DZ-BT ชุดใหม่ แกะจากกล่องแล้วเก็บใส่สลีฟทันที ไม่มีรอยขีดข่วน มุมการ์ดคมทุกด้าน ถ่ายวิดีโอตอนแพ็คให้ดูก่อนส่งทุกออเดอร์', null, null, 1000, null, 4200, now() + interval '42 minutes', 'active', now() - interval '2 days'),
  ('b0000000-0000-0000-0000-000000000002', 'a0000000-0000-0000-0000-000000000002', 'Blaster Blade Liberator RRR', 'Vanguard DZ-BT02', 'deck', 'RRR', 'สภาพดีมาก (Excellent)', 'มือหนึ่ง แกะจากกล่องเก็บใส่สลีฟทันที', null, null, 1850, 1850, 1850, now() + interval '6 hours', 'active', now() - interval '1 days'),
  ('b0000000-0000-0000-0000-000000000003', 'a0000000-0000-0000-0000-000000000003', 'Amaterasu SP Foil', 'Vanguard DZ-BT01', 'rare', 'SP', 'สภาพสมบูรณ์ (Near Mint)', 'นำเข้าจากญี่ปุ่น สภาพสมบูรณ์', null, null, 3000, null, 6900, now() + interval '2 hours 15 minutes', 'active', now() - interval '3 days'),
  ('b0000000-0000-0000-0000-000000000004', 'a0000000-0000-0000-0000-000000000004', 'Starter Deck: Shadow Paladin พร้อมเล่น', 'Vanguard Starter Deck', 'deck', 'DECK', 'สภาพดี (Good)', 'เด็คพร้อมเล่น ครบ 50 ใบ', null, null, 650, 650, 650, now() + interval '3 days', 'active', now() - interval '2 days'),
  ('b0000000-0000-0000-0000-000000000005', 'a0000000-0000-0000-0000-000000000002', 'Ultimate Raizer RRR', 'Vanguard DZ-BT01', 'new', 'RRR', 'สภาพสมบูรณ์ (Near Mint)', 'จากบูสเตอร์ใหม่ สภาพสมบูรณ์', null, null, 500, null, 980, now() + interval '5 hours', 'active', now() - interval '1 days'),
  ('b0000000-0000-0000-0000-000000000006', 'a0000000-0000-0000-0000-000000000001', 'Gancelot SP', 'Vanguard DZ-BT01', 'rare', 'SP', 'สภาพสมบูรณ์ (Near Mint)', 'SP อัดฟอยล์เต็มแผ่น เก็บรักษาอย่างดี', null, null, 1500, null, 3300, now() + interval '13 minutes', 'active', now() - interval '3 days'),
  ('b0000000-0000-0000-0000-000000000007', 'a0000000-0000-0000-0000-000000000001', 'Great Silver Wolf Garmore', 'Vanguard DZ-BT01', 'new', 'RRR', 'สภาพสมบูรณ์ (Near Mint)', 'จากบูสเตอร์ใหม่ มุมคมทุกด้าน', null, null, 1200, null, 2100, now() + interval '1 hour 40 minutes', 'active', now() - interval '2 days'),
  ('b0000000-0000-0000-0000-000000000008', 'a0000000-0000-0000-0000-000000000004', 'Blaster Blade Seeker', 'Vanguard DZ-BT02', 'rare', 'RR', 'สภาพดีมาก (Excellent)', 'มือหนึ่ง สภาพดีมาก', null, null, 700, null, 1200, now() + interval '3 hours 20 minutes', 'active', now() - interval '1 days'),
  ('b0000000-0000-0000-0000-000000000009', 'a0000000-0000-0000-0000-000000000002', 'Starter Deck: Nova Grappler', 'Vanguard Starter Deck', 'deck', 'DECK', 'สภาพดี (Good)', 'เด็คพร้อมเล่น ครบชุด', null, null, 600, 600, 600, now() + interval '4 days', 'active', now() - interval '2 days'),
  ('b0000000-0000-0000-0000-000000000010', 'a0000000-0000-0000-0000-000000000003', 'CEO Amaterasu', 'Vanguard DZ-BT01', 'rare', 'SP', 'สภาพสมบูรณ์ (Near Mint)', 'นำเข้าจากญี่ปุ่น หายาก', null, null, 5000, null, 8500, now() + interval '5 minutes 30 seconds', 'active', now() - interval '4 days');

-- bid history on the flagship listing (Dragonic Overlord SP)
insert into bids (listing_id, bidder_id, amount, created_at) values
  ('b0000000-0000-0000-0000-000000000001', 'a0000000-0000-0000-0000-000000000006', 3400, now() - interval '41 minutes'),
  ('b0000000-0000-0000-0000-000000000001', 'a0000000-0000-0000-0000-000000000005', 3700, now() - interval '28 minutes'),
  ('b0000000-0000-0000-0000-000000000001', 'a0000000-0000-0000-0000-000000000006', 4000, now() - interval '14 minutes'),
  ('b0000000-0000-0000-0000-000000000001', 'a0000000-0000-0000-0000-000000000007', 4100, now() - interval '6 minutes'),
  ('b0000000-0000-0000-0000-000000000001', 'a0000000-0000-0000-0000-000000000005', 4200, now() - interval '2 minutes');

-- ---------- settled listings backing seeded orders (not shown in active browse grid) ----------
insert into listings (id, seller_id, name, set_name, category, rarity, condition, description, start_price, current_price, ends_at, status, created_at) values
  ('b0000000-0000-0000-0000-000000000101', 'a0000000-0000-0000-0000-000000000002', 'Phantom Blaster Dragon', 'Vanguard BT-09', 'rare', 'SP', 'สภาพสมบูรณ์ (Near Mint)', 'มือหนึ่ง สภาพสมบูรณ์', 1500, 2400, now() - interval '3 days', 'sold', now() - interval '10 days'),
  ('b0000000-0000-0000-0000-000000000102', 'a0000000-0000-0000-0000-000000000001', 'Vermillion Gatling Claw', 'Vanguard DZ-BT01', 'rare', 'RRR', 'สภาพสมบูรณ์ (Near Mint)', 'แกะจากกล่องแล้วเก็บใส่สลีฟทันที', 1800, 2800, now() - interval '2 days', 'sold', now() - interval '9 days'),
  ('b0000000-0000-0000-0000-000000000103', 'a0000000-0000-0000-0000-000000000001', 'Blaster Dark', 'Vanguard DZ-BT01', 'rare', 'RR', 'สภาพดีมาก (Excellent)', 'สภาพดีมาก มุมคมทุกด้าน', 900, 1500, now() - interval '5 days', 'sold', now() - interval '12 days'),
  ('b0000000-0000-0000-0000-000000000104', 'a0000000-0000-0000-0000-000000000001', 'Dragonic Overlord R', 'Vanguard BT-01', 'rare', 'R', 'สภาพสมบูรณ์ (Near Mint)', 'สภาพสมบูรณ์ เก็บรักษาอย่างดี', 400, 700, now() - interval '4 days', 'sold', now() - interval '15 days'),
  ('b0000000-0000-0000-0000-000000000105', 'a0000000-0000-0000-0000-000000000001', 'Machining Army', 'Vanguard BT-03', 'rare', 'RR', 'สภาพดี (Good)', 'สภาพดี ใช้งานได้ปกติ', 300, 550, now() - interval '9 days', 'sold', now() - interval '20 days'),
  ('b0000000-0000-0000-0000-000000000106', 'a0000000-0000-0000-0000-000000000001', 'Gancelot', 'Vanguard BT-01', 'new', 'R', 'สภาพสมบูรณ์ (Near Mint)', 'จากบูสเตอร์ สภาพสมบูรณ์', 250, 450, now() - interval '16 days', 'sold', now() - interval '25 days'),
  ('b0000000-0000-0000-0000-000000000107', 'a0000000-0000-0000-0000-000000000001', 'Vowing Sword, Bors', 'Vanguard BT-01', 'rare', 'RR', 'สภาพสมบูรณ์ (Near Mint)', 'สภาพสมบูรณ์ มุมคมทุกด้าน', 350, 700, now() - interval '6 days', 'sold', now() - interval '13 days');

-- ---------- orders ----------

-- Order 1: me (DragonForge) is the BUYER, still owes payment -> exercises tcs-checkout
insert into orders (id, order_code, listing_id, buyer_id, seller_id, amount, status, payment_deadline_at, created_at) values
  ('c0000000-0000-0000-0000-000000000001', 'TCS-260918-0001', 'b0000000-0000-0000-0000-000000000101', 'a0000000-0000-0000-0000-000000000001', 'a0000000-0000-0000-0000-000000000002', 2400, 'PENDING_PAYMENT', now() + interval '23 hours 59 minutes', now() - interval '5 minutes');

-- Order 2: me (DragonForge) is the BUYER, delivered, awaiting unboxing video + decision -> exercises tcs-order
insert into orders (id, order_code, listing_id, buyer_id, seller_id, amount, status, payment_method, shipping_recipient, shipping_phone, shipping_address, shipping_province, shipping_postcode, paid_at, courier, tracking_number, shipped_at, delivered_at) values
  ('c0000000-0000-0000-0000-000000000002', 'TCS-260916-0847', 'b0000000-0000-0000-0000-000000000102', 'a0000000-0000-0000-0000-000000000001', 'a0000000-0000-0000-0000-000000000002', 2800, 'DELIVERED', 'promptpay', 'สมชาย ใจดี', '0812345678', '123 ถนนสุขุมวิท แขวงคลองตัน เขตคลองเตย', 'กรุงเทพมหานคร', '10110', now() - interval '2 days', 'Flash Express', 'TH0234998877XX', now() - interval '1 days', now() - interval '3 hours');

insert into messages (order_id, sender_id, body, created_at) values
  ('c0000000-0000-0000-0000-000000000002', 'a0000000-0000-0000-0000-000000000002', 'แพ็คแน่นหนาแล้วนะครับ ห่อกันกระแทก 2 ชั้น ขอบคุณที่อุดหนุนครับ', now() - interval '18 hours'),
  ('c0000000-0000-0000-0000-000000000002', 'a0000000-0000-0000-0000-000000000001', 'ได้รับแล้วครับ กำลังถ่ายวิดีโอแกะกล่องอยู่', now() - interval '2 hours');

-- Order 3: me (DragonForge) is the SELLER, just paid, needs to ship -> exercises tcs-order-seller
insert into orders (id, order_code, listing_id, buyer_id, seller_id, amount, status, paid_at, created_at) values
  ('c0000000-0000-0000-0000-000000000003', 'TCS-260917-0512', 'b0000000-0000-0000-0000-000000000103', 'a0000000-0000-0000-0000-000000000005', 'a0000000-0000-0000-0000-000000000001', 1500, 'PAID_HELD', now() - interval '2 days', now() - interval '2 days');

insert into messages (order_id, sender_id, body, created_at) values
  ('c0000000-0000-0000-0000-000000000003', 'a0000000-0000-0000-0000-000000000005', 'สวัสดีครับ รบกวนแพ็คแน่นๆ หน่อยนะครับ กลัวการ์ดช้ำ', now() - interval '1 days 6 hours'),
  ('c0000000-0000-0000-0000-000000000003', 'a0000000-0000-0000-0000-000000000001', 'ได้เลยครับ แพ็คใส่ท็อปโหลดเดอร์ + กันกระแทก 2 ชั้นให้แน่นอนครับ', now() - interval '1 days 5 hours');

-- Order 4: me (DragonForge) is the SELLER, buyer disputed -> exercises tcs-admin-dispute (me also is_admin)
insert into orders (id, order_code, listing_id, buyer_id, seller_id, amount, status, paid_at, courier, tracking_number, shipped_at, delivered_at, unboxing_video_url, video_uploaded_at, created_at) values
  ('c0000000-0000-0000-0000-000000000004', 'TCS-260915-0847', 'b0000000-0000-0000-0000-000000000107', 'a0000000-0000-0000-0000-000000000006', 'a0000000-0000-0000-0000-000000000001', 700, 'DISPUTED', now() - interval '5 days', 'Flash Express', 'TH0234998877XX', now() - interval '4 days', now() - interval '3 days', 'unboxing-dz-bt01.mp4', now() - interval '3 hours', now() - interval '5 days');

insert into disputes (order_id, opened_by, reason, description, created_at) values
  ('c0000000-0000-0000-0000-000000000004', 'a0000000-0000-0000-0000-000000000006', 'condition', 'การ์ดที่ได้รับมีรอยขีดข่วนที่มุมขวาล่างซึ่งไม่เห็นในรูปประกาศขายเลยครับ เทียบกับรูปที่ลงไว้แล้วชัดเจนว่าเป็นคนละสภาพกัน อยากให้แอดมินช่วยตรวจสอบให้หน่อยครับ', now() - interval '3 hours');

insert into messages (order_id, sender_id, body, created_at) values
  ('c0000000-0000-0000-0000-000000000004', 'a0000000-0000-0000-0000-000000000006', 'สวัสดีครับ รบกวนแพ็คแน่นๆ หน่อยนะครับ กลัวการ์ดช้ำ', now() - interval '5 days'),
  ('c0000000-0000-0000-0000-000000000004', 'a0000000-0000-0000-0000-000000000001', 'ได้เลยครับ แพ็คใส่ท็อปโหลดเดอร์ + กันกระแทก 2 ชั้นให้แน่นอนครับ', now() - interval '5 days'),
  ('c0000000-0000-0000-0000-000000000004', 'a0000000-0000-0000-0000-000000000006', 'ได้รับแล้วครับ กำลังถ่ายวิดีโอแกะกล่องอยู่', now() - interval '3 days');

-- Orders 5-7: completed + reviewed, backing DragonForge's review list on tcs-profile
insert into orders (id, order_code, listing_id, buyer_id, seller_id, amount, status, paid_at, completed_at, created_at) values
  ('c0000000-0000-0000-0000-000000000005', 'TCS-260915-0201', 'b0000000-0000-0000-0000-000000000104', 'a0000000-0000-0000-0000-000000000005', 'a0000000-0000-0000-0000-000000000001', 700, 'COMPLETED', now() - interval '4 days', now() - interval '3 days', now() - interval '6 days'),
  ('c0000000-0000-0000-0000-000000000006', 'TCS-260911-0114', 'b0000000-0000-0000-0000-000000000105', 'a0000000-0000-0000-0000-000000000006', 'a0000000-0000-0000-0000-000000000001', 550, 'COMPLETED', now() - interval '8 days', now() - interval '7 days', now() - interval '10 days'),
  ('c0000000-0000-0000-0000-000000000007', 'TCS-260904-0088', 'b0000000-0000-0000-0000-000000000106', 'a0000000-0000-0000-0000-000000000007', 'a0000000-0000-0000-0000-000000000001', 450, 'COMPLETED', now() - interval '15 days', now() - interval '14 days', now() - interval '17 days');

insert into reviews (order_id, rater_id, ratee_id, rating, tags, comment, listing_name, created_at) values
  ('c0000000-0000-0000-0000-000000000005', 'a0000000-0000-0000-0000-000000000005', 'a0000000-0000-0000-0000-000000000001', 5, '{แพ็คดี,ตรงปก}', 'แพ็คดีมาก มีวิดีโอแกะกล่องให้ดูตรงกับรูปที่ลงประกาศทุกจุด ส่งไวด้วย', 'Dragonic Overlord R', now() - interval '3 days'),
  ('c0000000-0000-0000-0000-000000000006', 'a0000000-0000-0000-0000-000000000006', 'a0000000-0000-0000-0000-000000000001', 4, '{ตอบแชทไว}', 'การ์ดสภาพดีตามที่บอก ตอบแชทไวดี แค่พัสดุช้าไปหน่อยเพราะช่วงหยุดยาว', 'Machining Army', now() - interval '7 days'),
  ('c0000000-0000-0000-0000-000000000007', 'a0000000-0000-0000-0000-000000000007', 'a0000000-0000-0000-0000-000000000001', 5, '{ตรงปก,ราคาคุ้มค่า}', 'ซื้อ SP มาราคาดี ได้ของตรงปก เก็บรักษาดีมาก แนะนำร้านนี้เลย', 'Gancelot', now() - interval '14 days');

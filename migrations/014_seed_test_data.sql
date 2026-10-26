-- =============================================================================
-- 014_seed_test_data.sql
-- Seed data for testing in Supabase SQL Editor
-- Creates a pilot cluster (Indore Vijay Nagar), anchor vendors, slots, and items
-- =============================================================================

-- 1. Pilot Cluster: Indore Vijay Nagar (2 km radius)
INSERT INTO clusters (id, name, city, state, centre_point, radius_meters, is_active)
VALUES (
    'a1b2c3d4-e5f6-7a8b-9c0d-1e2f3a4b5c6d',
    'Indore Vijay Nagar Cluster 1',
    'Indore',
    'Madhya Pradesh',
    ST_SetSRID(ST_MakePoint(75.8943, 22.7533), 4326)::geography,
    2000,
    true
) ON CONFLICT (name) DO NOTHING;

-- 2. Delivery Slots (Morning 7-10 am, Evening 5-8 pm)
INSERT INTO delivery_slots (id, cluster_id, name, slot_type, start_time, end_time, order_cutoff_time, max_orders_capacity, is_active)
VALUES 
(
    'b2c3d4e5-f6a7-8b9c-0d1e-2f3a4b5c6d7e',
    'a1b2c3d4-e5f6-7a8b-9c0d-1e2f3a4b5c6d',
    'Morning Delivery (7:00 AM - 10:00 AM)',
    'morning',
    '07:00:00',
    '10:00:00',
    '06:00:00',
    60,
    true
),
(
    'c3d4e5f6-a7b8-9c0d-1e2f-3a4b5c6d7e8f',
    'a1b2c3d4-e5f6-7a8b-9c0d-1e2f3a4b5c6d',
    'Evening Delivery (5:00 PM - 8:00 PM)',
    'evening',
    '17:00:00',
    '20:00:00',
    '16:00:00',
    60,
    true
) ON CONFLICT DO NOTHING;

-- 3. Anchor Vendors
INSERT INTO vendors (id, cluster_id, shop_name, owner_name, phone, category, address_text, fssai_license_no, score, is_open, is_active)
VALUES
(
    'd4e5f6a7-b8c9-0d1e-2f3a-4b5c6d7e8f9a',
    'a1b2c3d4-e5f6-7a8b-9c0d-1e2f3a4b5c6d',
    'Patidar Fresh Sabzi Mandi',
    'Ramesh Patidar',
    '9893011111',
    'vegetables',
    'Shop 12, Main Mandi Road, Vijay Nagar, Indore',
    '11422001000123',
    4.90,
    true,
    true
),
(
    'e5f6a7b8-c9d0-1e2f-3a4b-5c6d7e8f9a0b',
    'a1b2c3d4-e5f6-7a8b-9c0d-1e2f3a4b5c6d',
    'Apna Fruit Bhandar',
    'Kailash Sharma',
    '9893022222',
    'fruits',
    'Plot 4, Scheme 54, Vijay Nagar, Indore',
    '11422001000456',
    4.85,
    true,
    true
),
(
    'f6a7b8c9-d0e1-2f3a-4b5c-6d7e8f9a0b1c',
    'a1b2c3d4-e5f6-7a8b-9c0d-1e2f3a4b5c6d',
    'Malwa Shuddh Dairy',
    'Surendra Yadav',
    '9893033333',
    'dairy',
    'G-8, Sector B, Vijay Nagar, Indore',
    '11422001000789',
    4.95,
    true,
    true
) ON CONFLICT (phone) DO NOTHING;

-- 4. Catalogue Items for Patidar Fresh Sabzi Mandi (Vegetables)
INSERT INTO catalogue_items (vendor_id, category_id, name_en, name_hi, unit, step_quantity, price_paise, mandi_band_min_paise, mandi_band_max_paise, is_in_stock)
VALUES
(
    'd4e5f6a7-b8c9-0d1e-2f3a-4b5c6d7e8f9a',
    '11111111-1111-1111-1111-111111111101',
    'Fresh Desi Tomato (Hybrid)',
    'ताजा टमाटर (हाइब्रिड)',
    '1 kg',
    1.0,
    3200, -- ₹32.00
    2500,
    3800,
    true
),
(
    'd4e5f6a7-b8c9-0d1e-2f3a-4b5c6d7e8f9a',
    '11111111-1111-1111-1111-111111111101',
    'Indore Jyoti Potato (Aloo)',
    'इंदौर ज्योति आलू',
    '1 kg',
    1.0,
    2800, -- ₹28.00
    2200,
    3400,
    true
),
(
    'd4e5f6a7-b8c9-0d1e-2f3a-4b5c6d7e8f9a',
    '11111111-1111-1111-1111-111111111101',
    'Nashik Red Onion (Pyaaz)',
    'लाल प्याज (नासिक)',
    '1 kg',
    1.0,
    3500, -- ₹35.00
    3000,
    4200,
    true
),
(
    'd4e5f6a7-b8c9-0d1e-2f3a-4b5c6d7e8f9a',
    '11111111-1111-1111-1111-111111111101',
    'Fresh Palak (Spinach Bunch)',
    'ताजा पालक की गड्डी',
    '250 g',
    1.0,
    1500, -- ₹15.00
    1200,
    2000,
    true
),
(
    'd4e5f6a7-b8c9-0d1e-2f3a-4b5c6d7e8f9a',
    '11111111-1111-1111-1111-111111111101',
    'Green Coriander (Dhaniya)',
    'हरा धनिया',
    '100 g',
    1.0,
    1000, -- ₹10.00
    800,
    1500,
    true
);

-- 5. Catalogue Items for Apna Fruit Bhandar (Fruits)
INSERT INTO catalogue_items (vendor_id, category_id, name_en, name_hi, unit, step_quantity, price_paise, mandi_band_min_paise, mandi_band_max_paise, is_in_stock)
VALUES
(
    'e5f6a7b8-c9d0-1e2f-3a4b-5c6d7e8f9a0b',
    '11111111-1111-1111-1111-111111111102',
    'Robusta Banana (Kela)',
    'पका केला (दर्जन)',
    '1 dozen',
    1.0,
    4500, -- ₹45.00
    3800,
    5500,
    true
),
(
    'e5f6a7b8-c9d0-1e2f-3a4b-5c6d7e8f9a0b',
    '11111111-1111-1111-1111-111111111102',
    'Shimla Royal Apple (Seb)',
    'शिमला रॉयल सेब',
    '1 kg',
    1.0,
    12000, -- ₹120.00
    10000,
    15000,
    true
),
(
    'e5f6a7b8-c9d0-1e2f-3a4b-5c6d7e8f9a0b',
    '11111111-1111-1111-1111-111111111102',
    'Sweet Papaya (Papita)',
    'मीठा पपीता',
    '1 pc (~1 kg)',
    1.0,
    5000, -- ₹50.00
    4000,
    6500,
    true
);

-- 6. Catalogue Items for Malwa Shuddh Dairy (Dairy)
INSERT INTO catalogue_items (vendor_id, category_id, name_en, name_hi, unit, step_quantity, price_paise, mandi_band_min_paise, mandi_band_max_paise, is_in_stock)
VALUES
(
    'f6a7b8c9-d0e1-2f3a-4b5c-6d7e8f9a0b1c',
    '11111111-1111-1111-1111-111111111103',
    'Fresh Malai Paneer',
    'ताजा मलाई पनीर',
    '200 g',
    1.0,
    8500, -- ₹85.00
    7500,
    9500,
    true
),
(
    'f6a7b8c9-d0e1-2f3a-4b5c-6d7e8f9a0b1c',
    '11111111-1111-1111-1111-111111111103',
    'Pure Cow Milk Pouch',
    'शुद्ध गाय का दूध पाउच',
    '500 ml',
    1.0,
    3000, -- ₹30.00
    2800,
    3400,
    true
),
(
    'f6a7b8c9-d0e1-2f3a-4b5c-6d7e8f9a0b1c',
    '11111111-1111-1111-1111-111111111103',
    'Fresh Dahi (Curd)',
    'ताजा दही',
    '400 g',
    1.0,
    4000, -- ₹40.00
    3500,
    4500,
    true
);

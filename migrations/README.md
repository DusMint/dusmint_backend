# Dusmint Database Migrations

This folder contains the complete, production-ready PostgreSQL database schema and serverless backend RPCs for the **Dusmint** platform, distributed across modular, manageable files designed to be executed sequentially in the **Supabase SQL Editor**.

## Execution Order

Run each file in the Supabase SQL Editor in the exact numeric order below:

| Sequence | Migration File | Description | Dependencies |
|:---:|:---|:---|:---|
| **01** | `001_extensions.sql` | PostGIS, uuid-ossp, pgcrypto, pg_trgm extensions | *None* |
| **02** | `002_users_and_auth.sql` | Customer profiles (extends Supabase Auth), addresses, trust tiers, RLS | `001` |
| **03** | `003_clusters_and_geography.sql` | 2 km radius service clusters with PostGIS points & spatial indexes | `001` |
| **04** | `004_vendors.sql` | Anchor vendor profiles, documents, bank/UPI, vendor performance scores | `001`, `003` |
| **05** | `005_catalogue.sql` | Categories, items, daily mandi price bands, vernacular search indexes | `001`, `004` |
| **06** | `006_slots.sql` | Morning (7-10am) & Evening (5-8pm) slots with capacity and cutoffs | `003` |
| **07** | `007_orders.sql` | Orders, multi-vendor splits (`order_vendor_parts`), order items, status lifecycle | `002`, `004`, `005`, `006` |
| **08** | `008_payments.sql` | Cashfree payments, refunds, dynamic UOD QR support, webhook audit | `002`, `007` |
| **09** | `009_claims.sql` | Weight/quality claims, scan-to-open 30-min window, auto-approval thresholds | `002`, `007` |
| **10** | `010_payouts_and_settlements.sql` | Vendor daily settlement ledger and automated payout records | `004`, `007` |
| **11** | `011_delivery_tasks_and_fleet.sql` | Partner app rider assignment, bag pickup verification, delivery OTP | `003`, `007` |
| **12** | `012_notifications_and_audit.sql` | Multi-channel dispatch log (FCM, MSG91 SMS, WhatsApp) & audit trail | *Base tables* |
| **13** | `013_functions_and_triggers.sql` | Serviceability geo-checker, order code generator, trust tier evaluator | `001-012` |
| **14** | `014_place_order_atomic_rpc.sql` | Serverless ACID order placement RPC (`place_order_atomic`), multi-vendor auto-split, OTP | `007`, `011` |
| **15** | `015_customer_orders_views_and_rpc.sql` | High-speed aggregated JSON functions (`get_customer_orders_json`, `get_order_details_json`) | `007`, `011` |
| **16** | `016_order_lifecycle_and_seals.sql` | Seal scan verification (`verify_order_seal`), cancellation, and live GPS rider tracking | `007`, `011` |
| **17** | `017_supabase_realtime_and_rls.sql` | Supabase Realtime publication & granular Row-Level Security (RLS) policies | `007`, `011`, `014` |
| **18** | `018_performance_indexes.sql` | Sub-millisecond composite B-Tree indexes for orders, items, and tracking | `002-011` |

## How to Run in Supabase

1. Open your project dashboard at [supabase.com](https://supabase.com).
2. Click on the **SQL Editor** tab (left sidebar).
3. Create a new query.
4. Copy and paste the contents of `001_extensions.sql` and click **Run**.
5. Repeat for each file sequentially from `002` to `018`.
6. Verify under **Database -> Tables** and **Database -> Functions** that all tables, enums, and RPC functions are created properly.

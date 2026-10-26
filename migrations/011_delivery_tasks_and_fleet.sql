-- =============================================================================
-- 011_delivery_tasks_and_fleet.sql
-- Delivery tasks, runner assignments, bag tracking and doorstep handoff
-- Partner app interacts with this table via Dusmint Partner API endpoints
-- =============================================================================

CREATE TYPE delivery_task_status AS ENUM (
    'unassigned',
    'assigned',
    'accepted_by_rider',
    'en_route_to_vendor',
    'arrived_at_vendor',
    'bags_collected',
    'out_for_delivery',
    'arrived_at_customer',
    'delivered',
    'delivery_failed',
    'cancelled'
);

-- Delivery partners / riders reference table
CREATE TABLE delivery_partners (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    partner_app_rider_id TEXT UNIQUE NOT NULL,
    full_name TEXT NOT NULL,
    phone TEXT NOT NULL UNIQUE,
    vehicle_type TEXT NOT NULL DEFAULT 'motorcycle' CHECK (vehicle_type IN ('motorcycle', 'scooter', 'bicycle', 'ev')),
    vehicle_reg_no TEXT,
    cluster_id UUID REFERENCES clusters(id),
    current_location GEOGRAPHY(POINT, 4326),
    is_active BOOLEAN NOT NULL DEFAULT true,
    is_online BOOLEAN NOT NULL DEFAULT false,
    rating NUMERIC(3,2) NOT NULL DEFAULT 5.00,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Delivery tasks per customer order
CREATE TABLE delivery_tasks (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    order_id UUID NOT NULL REFERENCES orders(id) ON DELETE CASCADE,
    cluster_id UUID NOT NULL REFERENCES clusters(id),
    rider_id UUID REFERENCES delivery_partners(id),
    
    status delivery_task_status NOT NULL DEFAULT 'unassigned',
    batch_run_id UUID, -- For multi-order batched rider loops
    
    -- Verification codes
    delivery_otp_hash TEXT NOT NULL, -- bcrypt hash of the 4-digit OTP
    otp_attempt_count INTEGER NOT NULL DEFAULT 0,
    
    -- Timestamp tracking for SLA & guarantee compliance
    assigned_at TIMESTAMPTZ,
    accepted_at TIMESTAMPTZ,
    first_vendor_arrival_at TIMESTAMPTZ,
    last_bag_pickup_at TIMESTAMPTZ,
    out_for_delivery_at TIMESTAMPTZ,
    customer_arrival_at TIMESTAMPTZ,
    delivered_at TIMESTAMPTZ,
    failed_at TIMESTAMPTZ,
    failure_reason TEXT,
    
    -- Final drop location proof
    drop_location GEOGRAPHY(POINT, 4326),
    drop_photo_url TEXT,
    
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Bag pickup confirmation logs per vendor part
CREATE TABLE bag_pickup_verifications (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    delivery_task_id UUID NOT NULL REFERENCES delivery_tasks(id) ON DELETE CASCADE,
    order_vendor_part_id UUID NOT NULL REFERENCES order_vendor_parts(id) ON DELETE CASCADE,
    rider_id UUID NOT NULL REFERENCES delivery_partners(id),
    scanned_seal_qr TEXT NOT NULL,
    is_seal_valid BOOLEAN NOT NULL DEFAULT true,
    scanned_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    scan_location GEOGRAPHY(POINT, 4326)
);

CREATE INDEX idx_delivery_tasks_order_id ON delivery_tasks(order_id);
CREATE INDEX idx_delivery_tasks_rider_id ON delivery_tasks(rider_id);
CREATE INDEX idx_delivery_tasks_status ON delivery_tasks(status);
CREATE INDEX idx_delivery_tasks_cluster_id ON delivery_tasks(cluster_id);

CREATE TRIGGER update_delivery_partners_updated_at BEFORE UPDATE ON delivery_partners
    FOR EACH ROW EXECUTE PROCEDURE update_updated_at_column();

CREATE TRIGGER update_delivery_tasks_updated_at BEFORE UPDATE ON delivery_tasks
    FOR EACH ROW EXECUTE PROCEDURE update_updated_at_column();

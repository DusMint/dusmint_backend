-- =============================================================================
-- 013_functions_and_triggers.sql
-- Core business logic stored procedures and automated triggers
-- Run this after all base tables are created
-- =============================================================================

-- 1. Cluster Serviceability Checker Function
-- Given a user lat/lng, finds the nearest cluster and verifies if it is within radius
CREATE OR REPLACE FUNCTION check_cluster_serviceability(
    p_lat DOUBLE PRECISION,
    p_lng DOUBLE PRECISION
)
RETURNS TABLE (
    cluster_id UUID,
    cluster_name TEXT,
    city TEXT,
    distance_meters DOUBLE PRECISION,
    is_serviceable BOOLEAN
) AS $$
DECLARE
    v_user_point GEOGRAPHY(POINT, 4326);
BEGIN
    v_user_point := ST_SetSRID(ST_MakePoint(p_lng, p_lat), 4326)::geography;
    
    RETURN QUERY
    SELECT 
        c.id AS cluster_id,
        c.name AS cluster_name,
        c.city,
        ST_Distance(c.centre_point, v_user_point) AS distance_meters,
        (ST_Distance(c.centre_point, v_user_point) <= c.radius_meters AND c.is_active = true) AS is_serviceable
    FROM clusters c
    WHERE c.is_active = true
    ORDER BY c.centre_point <-> v_user_point
    LIMIT 1;
END;
$$ LANGUAGE plpgsql STABLE;

-- 2. Human-readable Order Code Generator Function
-- Generates codes like ORD-261026-0042
CREATE OR REPLACE FUNCTION generate_order_code()
RETURNS TRIGGER AS $$
DECLARE
    date_prefix TEXT;
    seq_number INTEGER;
BEGIN
    date_prefix := 'ORD-' || TO_CHAR(NOW(), 'YYMMDD') || '-';
    
    SELECT COUNT(*) + 1 INTO seq_number
    FROM orders
    WHERE created_at >= DATE_TRUNC('day', NOW());
    
    NEW.order_code := date_prefix || LPAD(seq_number::TEXT, 4, '0');
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER trigger_set_order_code
    BEFORE INSERT ON orders
    FOR EACH ROW
    WHEN (NEW.order_code IS NULL OR NEW.order_code = '')
    EXECUTE PROCEDURE generate_order_code();

-- 3. Trust Tier Promotion Trigger
-- Automatically upgrades customers to Tier 2 (unlocking UOD) after 3 successfully delivered orders
CREATE OR REPLACE FUNCTION evaluate_customer_trust_tier()
RETURNS TRIGGER AS $$
DECLARE
    delivered_count INTEGER;
    total_claims INTEGER;
BEGIN
    IF NEW.status = 'delivered' AND OLD.status <> 'delivered' THEN
        SELECT COUNT(*) INTO delivered_count
        FROM orders
        WHERE user_id = NEW.user_id AND status = 'delivered';
        
        SELECT COUNT(*) INTO total_claims
        FROM claims
        WHERE user_id = NEW.user_id AND status = 'approved';
        
        -- Tier 1 -> Tier 2 rule: >= 3 successful orders and < 2 claims
        IF delivered_count >= 3 AND total_claims < 2 THEN
            UPDATE users
            SET trust_tier = 2,
                updated_at = NOW()
            WHERE id = NEW.user_id AND trust_tier < 2;
        END IF;
    END IF;
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER trigger_customer_trust_tier
    AFTER UPDATE ON orders
    FOR EACH ROW
    EXECUTE PROCEDURE evaluate_customer_trust_tier();

-- 4. Order Vendor Parts Completion Evaluator
-- When all vendor parts are marked 'ready_for_pickup', automatically advance order to 'ready_for_pickup'
CREATE OR REPLACE FUNCTION evaluate_order_packing_completion()
RETURNS TRIGGER AS $$
DECLARE
    remaining_unpacked INTEGER;
BEGIN
    SELECT COUNT(*) INTO remaining_unpacked
    FROM order_vendor_parts
    WHERE order_id = NEW.order_id 
      AND status NOT IN ('ready_for_pickup', 'picked_up');
      
    IF remaining_unpacked = 0 THEN
        UPDATE orders
        SET status = 'ready_for_pickup',
            updated_at = NOW()
        WHERE id = NEW.order_id AND status IN ('confirmed', 'packing');
    END IF;
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER trigger_vendor_part_status_change
    AFTER UPDATE OF status ON order_vendor_parts
    FOR EACH ROW
    WHEN (NEW.status = 'ready_for_pickup')
    EXECUTE PROCEDURE evaluate_order_packing_completion();

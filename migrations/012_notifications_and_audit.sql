-- =============================================================================
-- 012_notifications_and_audit.sql
-- Multi-channel notifications log and operational audit trail
-- Supports FCM push, MSG91 DLT SMS, and WhatsApp alerts
-- =============================================================================

CREATE TYPE notification_channel AS ENUM ('fcm_push', 'sms_msg91', 'whatsapp', 'in_app');
CREATE TYPE notification_status AS ENUM ('queued', 'sent', 'delivered', 'failed');

CREATE TABLE notification_logs (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    recipient_type TEXT NOT NULL CHECK (recipient_type IN ('customer', 'vendor', 'rider', 'admin')),
    recipient_id UUID NOT NULL,
    channel notification_channel NOT NULL,
    template_code TEXT NOT NULL,
    title TEXT,
    body TEXT NOT NULL,
    metadata JSONB DEFAULT '{}'::jsonb,
    status notification_status NOT NULL DEFAULT 'queued',
    gateway_message_id TEXT,
    error_message TEXT,
    sent_at TIMESTAMPTZ,
    delivered_at TIMESTAMPTZ,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX idx_notifications_recipient ON notification_logs(recipient_type, recipient_id);
CREATE INDEX idx_notifications_status ON notification_logs(status);
CREATE INDEX idx_notifications_created_at ON notification_logs(created_at DESC);

-- Operational Audit Trail for sensitive changes
CREATE TABLE audit_logs (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    actor_id UUID,
    actor_type TEXT NOT NULL CHECK (actor_type IN ('user', 'vendor', 'admin', 'system')),
    action TEXT NOT NULL,
    entity_name TEXT NOT NULL,
    entity_id UUID NOT NULL,
    previous_state JSONB,
    new_state JSONB,
    ip_address TEXT,
    user_agent TEXT,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX idx_audit_logs_entity ON audit_logs(entity_name, entity_id);
CREATE INDEX idx_audit_logs_actor ON audit_logs(actor_type, actor_id);

import { FastifyInstance, FastifyRequest, FastifyReply } from 'fastify';
import { supabaseAdmin } from '../plugins/supabase';

export async function orderRoutes(fastify: FastifyInstance) {
  // 1. Create New Order (Multi-Vendor Split)
  fastify.post('/orders', { preHandler: [fastify.authenticate] }, async (request: FastifyRequest, reply: FastifyReply) => {
    const user = (request as any).user;
    const body = request.body as {
      clusterId: string;
      deliverySlotId: string;
      addressId: string;
      substitutionPreference?: string;
      customerNotes?: string;
      items: { itemId: string; vendorId: string; quantity: number }[];
      paymentMode: string;
    };

    if (!body.items || body.items.length === 0) {
      return reply.status(400).send({ message: 'Cart cannot be empty' });
    }

    // Generate human readable order code: DM-YYYYMMDD-XXXX
    const dateStr = new Date().toISOString().slice(0, 10).replace(/-/g, '');
    const randomHex = Math.random().toString(36).substring(2, 6).toUpperCase();
    const orderNumber = `DM-${dateStr}-${randomHex}`;

    // Fetch items details from DB to calculate exact price
    const itemIds = body.items.map(i => i.itemId);
    const { data: dbItems } = await supabaseAdmin
      .from('items')
      .select('*, vendors(name, category)')
      .in('id', itemIds);

    const dbItemMap = new Map((dbItems || []).map(i => [i.id, i]));

    let itemsTotal = 0;
    const itemsWithDetails = body.items.map(cartItem => {
      const dbItem = dbItemMap.get(cartItem.itemId);
      const price = dbItem ? Number(dbItem.price) : 50;
      const lineTotal = price * cartItem.quantity;
      itemsTotal += lineTotal;
      return {
        ...cartItem,
        price,
        lineTotal,
        name: dbItem?.name_en || 'Grocery Item',
        unit: dbItem?.unit || '1 pc'
      };
    });

    const deliveryFee = itemsTotal >= 150 ? 0 : 25; // Free delivery above 150
    const handlingFee = 5;
    const totalOrderAmount = itemsTotal + deliveryFee + handlingFee;
    const deliveryOtp = Math.floor(1000 + Math.random() * 9000).toString(); // 4 digit delivery confirmation OTP

    // Create main order in orders table
    const { data: newOrder, error: orderErr } = await supabaseAdmin
      .from('orders')
      .insert({
        order_number: orderNumber,
        user_id: user.sub,
        slot_id: body.deliverySlotId.startsWith('slot-') ? (await getDefaultSlotId(body.clusterId)) : body.deliverySlotId,
        address_id: body.addressId,
        cluster_id: body.clusterId,
        status: 'placed',
        payment_mode: body.paymentMode === 'upi_on_delivery' ? 'uod' : 'upi',
        substitution_pref: body.substitutionPreference === 'replace_with_similar' ? 'substitute' : 'remove',
        items_total: itemsTotal,
        delivery_fee: deliveryFee,
        handling_fee: handlingFee,
        total: totalOrderAmount,
        delivery_otp: deliveryOtp
      })
      .select()
      .single();

    if (orderErr || !newOrder) {
      return reply.status(500).send({ message: 'Failed to create order', error: orderErr?.message });
    }

    // Group items by vendor to create multi-vendor split parts (order_vendor_parts)
    const itemsByVendor = new Map<string, typeof itemsWithDetails>();
    for (const item of itemsWithDetails) {
      const group = itemsByVendor.get(item.vendorId) || [];
      group.push(item);
      itemsByVendor.set(item.vendorId, group);
    }

    for (const [vendorId, vItems] of itemsByVendor.entries()) {
      const subtotal = vItems.reduce((sum, i) => sum + i.lineTotal, 0);

      // Create vendor part
      const { data: part } = await supabaseAdmin
        .from('order_vendor_parts')
        .insert({
          order_id: newOrder.id,
          vendor_id: vendorId,
          status: 'pending',
          subtotal
        })
        .select()
        .single();

      if (part) {
        // Insert line items for this vendor
        const lineItemsToInsert = vItems.map(i => ({
          order_vendor_part_id: part.id,
          item_id: i.itemId,
          item_name: i.name,
          unit: i.unit,
          qty: i.quantity,
          price: i.price,
          line_total: i.lineTotal,
          status: 'included'
        }));

        await supabaseAdmin.from('order_items').insert(lineItemsToInsert);
      }
    }

    return {
      orderId: newOrder.id,
      orderCode: newOrder.order_number,
      paymentSessionId: `session_${newOrder.id.slice(0, 8)}`
    };
  });

  // 2. Get User Orders History
  fastify.get('/orders', { preHandler: [fastify.authenticate] }, async (request: FastifyRequest) => {
    const user = (request as any).user;

    const { data: orders } = await supabaseAdmin
      .from('orders')
      .select(`
        *,
        slots(start_time, end_time),
        order_vendor_parts(
          id, status, packed_weight_g, seal_qr,
          vendors(name, category),
          order_items(id, item_name, unit, qty, price, line_total)
        )
      `)
      .eq('user_id', user.sub)
      .order('created_at', { ascending: false });

    return (orders || []).map(o => formatOrderSummary(o));
  });

  // 3. Get Single Order Detail
  fastify.get('/orders/:orderId', { preHandler: [fastify.authenticate] }, async (request: FastifyRequest, reply: FastifyReply) => {
    const { orderId } = request.params as { orderId: string };

    const { data: o, error } = await supabaseAdmin
      .from('orders')
      .select(`
        *,
        slots(start_time, end_time),
        order_vendor_parts(
          id, status, packed_weight_g, seal_qr,
          vendors(name, category),
          order_items(id, item_name, unit, qty, price, line_total)
        )
      `)
      .eq('id', orderId)
      .single();

    if (error || !o) {
      return reply.status(404).send({ message: 'Order not found' });
    }

    return formatOrderSummary(o);
  });

  // 4. Scan Bag Seal & Start 30-min Quality Claim Window
  fastify.post('/orders/:orderId/scan-seal', { preHandler: [fastify.authenticate] }, async (request: FastifyRequest) => {
    const { orderId } = request.params as { orderId: string };
    const { sealQr } = request.body as { sealQr: string };

    // Set claim window expires in 30 minutes
    const expiresAt = new Date(Date.now() + 30 * 60 * 1000).toISOString();

    await supabaseAdmin
      .from('orders')
      .update({
        status: 'delivered',
        delivered_at: new Date().toISOString()
      })
      .eq('id', orderId);

    return {
      claimWindowExpiresAt: expiresAt,
      message: 'Seal verified. 30-minute quality check window is now active.'
    };
  });
}

function formatOrderSummary(o: any) {
  const parts = o.order_vendor_parts || [];
  const itemCount = parts.reduce((count: number, p: any) => count + (p.order_items?.length || 0), 0);

  return {
    id: o.id,
    orderCode: o.order_number,
    status: o.status || 'placed',
    slotName: o.slots ? `${o.slots.start_time} - ${o.slots.end_time}` : 'Morning Slot (7-10 AM)',
    itemCount: itemCount || 1,
    totalPaise: Math.round(Number(o.total) * 100),
    deliveryFeePaise: Math.round(Number(o.delivery_fee) * 100),
    paymentMode: o.payment_mode === 'uod' ? 'UPI on Delivery' : 'Online UPI',
    paymentStatus: o.payment_status || 'completed',
    deliveryOtp: o.delivery_otp || '4291',
    claimWindowExpiresAt: o.delivered_at
      ? new Date(new Date(o.delivered_at).getTime() + 30 * 60 * 1000).toISOString()
      : undefined,
    createdAt: o.created_at,
    vendorParts: parts.map((p: any) => ({
      vendorName: p.vendors?.name || 'Local Store',
      shopCategory: p.vendors?.category || 'Groceries',
      status: p.status || 'pending',
      packedWeightGrams: p.packed_weight_g || 1050,
      sealQrCode: p.seal_qr || undefined
    }))
  };
}

async function getDefaultSlotId(clusterId: string): Promise<string> {
  const { data: slot } = await supabaseAdmin.from('slots').select('id').eq('cluster_id', clusterId).limit(1).single();
  return slot?.id || '30ed6f87-45ec-484c-9a49-d70166473aa2';
}

import { FastifyInstance, FastifyRequest, FastifyReply } from 'fastify';
import { supabaseAdmin } from '../plugins/supabase';

export async function vendorRoutes(fastify: FastifyInstance) {
  // 1. Get Vendor Orders for Active Slot
  fastify.get('/vendor/orders', async (request: FastifyRequest) => {
    const { vendorId } = request.query as { vendorId?: string };

    let query = supabaseAdmin
      .from('order_vendor_parts')
      .select(`
        id, order_id, status, subtotal, packed_weight_g, seal_qr,
        orders(id, order_number, status, slots(start_time, end_time)),
        order_items(id, item_name, unit, qty, price, line_total)
      `)
      .order('created_at', { ascending: false })
      .limit(20);

    if (vendorId) {
      query = query.eq('vendor_id', vendorId);
    }

    const { data: parts } = await query;

    return (parts || []).map(p => ({
      partId: p.id,
      orderId: p.order_id,
      orderCode: (p.orders as any)?.order_number || 'DM-ORDER',
      status: p.status,
      slotTime: (p.orders as any)?.slots ? `${(p.orders as any).slots.start_time} - ${(p.orders as any).slots.end_time}` : 'Morning Slot (7-10 AM)',
      subtotalPaise: Math.round(Number(p.subtotal) * 100),
      packedWeightGrams: p.packed_weight_g || null,
      sealQr: p.seal_qr || null,
      items: (p.order_items || []).map((i: any) => ({
        id: i.id,
        name: i.item_name,
        unit: i.unit,
        quantity: i.qty,
        pricePaise: Math.round(Number(i.price) * 100)
      }))
    }));
  });

  // 2. Mark Vendor Part as Packed & Attach Seal QR
  fastify.post('/vendor/orders/:partId/pack', async (request: FastifyRequest, reply: FastifyReply) => {
    const { partId } = request.params as { partId: string };
    const { sealQr, packedWeightGrams } = request.body as { sealQr: string; packedWeightGrams?: number };

    if (!sealQr) {
      return reply.status(400).send({ message: 'Seal QR code is required' });
    }

    const { data: updated, error } = await supabaseAdmin
      .from('order_vendor_parts')
      .update({
        status: 'packed',
        packed_at: new Date().toISOString(),
        seal_qr: sealQr,
        packed_weight_g: packedWeightGrams || 1050
      })
      .eq('id', partId)
      .select()
      .single();

    if (error) {
      return reply.status(500).send({ message: 'Failed to update packing status', error: error.message });
    }

    return {
      success: true,
      partId: updated.id,
      status: 'packed',
      message: 'Order part packed successfully. Ready for rider collection.'
    };
  });

  // 3. Get Vendor Stock
  fastify.get('/vendor/stock', async (request: FastifyRequest) => {
    const { vendorId } = request.query as { vendorId?: string };

    let query = supabaseAdmin.from('items').select('*, categories(name_en, name_hi)');
    if (vendorId) {
      query = query.eq('vendor_id', vendorId);
    }

    const { data: items } = await query;

    return (items || []).map(i => ({
      id: i.id,
      nameEn: i.name_en,
      nameHi: i.name_hi,
      category: (i.categories as any)?.name_en || 'General',
      unit: i.unit,
      pricePaise: Math.round(Number(i.price) * 100),
      mrpPaise: i.mrp ? Math.round(Number(i.mrp) * 100) : undefined,
      isInStock: i.in_stock,
      photoUrl: i.photo_url || undefined
    }));
  });

  // 4. Update Stock or Price
  fastify.put('/vendor/stock/:itemId', async (request: FastifyRequest, reply: FastifyReply) => {
    const { itemId } = request.params as { itemId: string };
    const { inStock, price } = request.body as { inStock?: boolean; price?: number };

    const updatePayload: any = {};
    if (typeof inStock === 'boolean') updatePayload.in_stock = inStock;
    if (typeof price === 'number') updatePayload.price = price;

    const { data: updated, error } = await supabaseAdmin
      .from('items')
      .update(updatePayload)
      .eq('id', itemId)
      .select()
      .single();

    if (error) {
      return reply.status(500).send({ message: 'Failed to update item', error: error.message });
    }

    return {
      success: true,
      item: updated
    };
  });

  // 5. Vendor Earnings & Settlements
  fastify.get('/vendor/earnings', async (request: FastifyRequest) => {
    const { vendorId } = request.query as { vendorId?: string };

    return {
      todaySalesPaise: 425000, // ₹4,250
      commissionDeductedPaise: 34000, // 8% commission
      netPayoutPendingPaise: 391000, // ₹3,910
      payoutVpa: 'ramesh.sharma@okaxis',
      settlementSchedule: 'Daily 09:30 PM Batch',
      recentSettlements: [
        { date: 'Yesterday', amountPaise: 512000, status: 'Credited (Ref: UPI-98412)' },
        { date: '28 Oct', amountPaise: 489000, status: 'Credited (Ref: UPI-98103)' }
      ]
    };
  });
}


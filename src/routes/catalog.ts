import { FastifyInstance, FastifyRequest, FastifyReply } from 'fastify';
import { supabaseAdmin } from '../plugins/supabase';

export async function catalogRoutes(fastify: FastifyInstance) {
  // 1. Get catalogue items for a specific vendor
  fastify.get('/vendors/:vendorId/items', async (request: FastifyRequest) => {
    const { vendorId } = request.params as { vendorId: string };

    const { data: items } = await supabaseAdmin
      .from('items')
      .select('*')
      .eq('vendor_id', vendorId)
      .eq('in_stock', true);

    return (items || []).map(i => ({
      id: i.id,
      vendorId: i.vendor_id,
      categoryId: i.category_id,
      nameEn: i.name_en,
      nameHi: i.name_hi,
      unit: i.unit,
      stepQuantity: 1,
      pricePaise: Math.round(Number(i.price) * 100),
      mandiBandMinPaise: i.band_min ? Math.round(Number(i.band_min) * 100) : undefined,
      mandiBandMaxPaise: i.band_max ? Math.round(Number(i.band_max) * 100) : undefined,
      photoUrl: i.photo_url || undefined,
      isInStock: i.in_stock
    }));
  });

  // 2. Get all catalogue items (filterable by category or cluster)
  fastify.get('/items', async (request: FastifyRequest) => {
    const { categoryId } = request.query as { categoryId?: string };

    let query = supabaseAdmin.from('items').select('*').eq('in_stock', true);
    if (categoryId) {
      query = query.eq('category_id', categoryId);
    }

    const { data: items } = await query.limit(50);

    return (items || []).map(i => ({
      id: i.id,
      vendorId: i.vendor_id,
      categoryId: i.category_id,
      nameEn: i.name_en,
      nameHi: i.name_hi,
      unit: i.unit,
      stepQuantity: 1,
      pricePaise: Math.round(Number(i.price) * 100),
      mandiBandMinPaise: i.band_min ? Math.round(Number(i.band_min) * 100) : undefined,
      mandiBandMaxPaise: i.band_max ? Math.round(Number(i.band_max) * 100) : undefined,
      photoUrl: i.photo_url || undefined,
      isInStock: i.in_stock
    }));
  });
}


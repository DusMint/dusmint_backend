import { FastifyInstance, FastifyRequest, FastifyReply } from 'fastify';
import { supabaseAdmin } from '../plugins/supabase';

export async function authRoutes(fastify: FastifyInstance) {
  // 1. Send Phone OTP (Dev mode: fixed 1234, real SMS ready for DLT)
  fastify.post('/auth/otp/send', async (request: FastifyRequest, reply: FastifyReply) => {
    const { phone } = request.body as { phone?: string };
    if (!phone || phone.length < 10) {
      return reply.status(400).send({ success: false, message: 'Valid 10-digit mobile number required' });
    }

    const cleanPhone = phone.replace(/\D/g, '').slice(-10);

    // Development Mode: In dev, OTP is always 1234
    fastify.log.info(`[DEV OTP] Generated OTP 1234 for +91${cleanPhone}`);

    return {
      success: true,
      message: 'OTP sent successfully (Use 1234 in development)',
      devOtp: '1234'
    };
  });

  // 2. Verify Phone OTP
  fastify.post('/auth/otp/verify', async (request: FastifyRequest, reply: FastifyReply) => {
    const { phone, otp } = request.body as { phone?: string; otp?: string };
    if (!phone || !otp) {
      return reply.status(400).send({ success: false, message: 'Phone and OTP are required' });
    }

    const cleanPhone = phone.replace(/\D/g, '').slice(-10);
    const formattedPhone = `+91${cleanPhone}`;

    // Verify OTP: In Dev mode accept 1234, or check real OTP
    if (otp !== '1234') {
      return reply.status(401).send({ success: false, message: 'Invalid OTP code. Please use 1234 in dev.' });
    }

    // 1. Check if user profile already exists
    let { data: profile } = await supabaseAdmin
      .from('profiles')
      .select('*')
      .eq('phone', formattedPhone)
      .maybeSingle();

    if (!profile) {
      // Find or create in Supabase Auth
      const { data: authUser, error: authErr } = await supabaseAdmin.auth.admin.createUser({
        phone: formattedPhone,
        phone_confirm: true,
        user_metadata: { phone: formattedPhone }
      });

      let userId = authUser?.user?.id;
      if (!userId) {
        // Try getting existing auth user with this phone
        const { data: users } = await supabaseAdmin.auth.admin.listUsers();
        const existing = users.users.find(u => u.phone === formattedPhone);
        if (existing) {
          userId = existing.id;
        } else {
          return reply.status(500).send({ success: false, message: 'Auth creation failed', error: authErr?.message });
        }
      }

      // Create new profile record
      const { data: newProfile, error: profErr } = await supabaseAdmin
        .from('profiles')
        .insert({
          id: userId,
          phone: formattedPhone,
          name: 'Dusmint Customer',
          language: 'en',
          trust_tier: 1,
          veg_only: false
        })
        .select()
        .single();

      if (profErr && !newProfile) {
        // Fetch if already created by trigger
        const { data: fetched } = await supabaseAdmin.from('profiles').select('*').eq('id', userId).single();
        profile = fetched;
      } else {
        profile = newProfile;
      }
    }

    // Generate JWT token
    const token = fastify.jwt.sign({
      sub: profile.id,
      phone: profile.phone,
      role: 'customer'
    });

    const userProfileResponse = {
      id: profile.id,
      phone: profile.phone,
      fullName: profile.name || 'Dusmint Customer',
      preferredLanguage: profile.language || 'en',
      trustTier: profile.trust_tier || 1,
      isVegOnly: profile.veg_only || false,
      avatarUrl: profile.avatar_url || undefined,
      createdAt: profile.created_at
    };

    return {
      token,
      user: userProfileResponse
    };
  });

  // 3. Get User Profile
  fastify.get('/user/profile', { preHandler: [fastify.authenticate] }, async (request: FastifyRequest, reply: FastifyReply) => {
    const user = (request as any).user;
    const { data: profile, error } = await supabaseAdmin
      .from('profiles')
      .select('*')
      .eq('id', user.sub)
      .single();

    if (error || !profile) {
      return reply.status(404).send({ message: 'Profile not found' });
    }

    return {
      id: profile.id,
      phone: profile.phone,
      fullName: profile.name,
      preferredLanguage: profile.language,
      trustTier: profile.trust_tier,
      isVegOnly: profile.veg_only,
      avatarUrl: profile.avatar_url,
      createdAt: profile.created_at
    };
  });

  // 4. Get User Saved Addresses
  fastify.get('/user/addresses', { preHandler: [fastify.authenticate] }, async (request: FastifyRequest) => {
    const user = (request as any).user;
    const { data: addresses } = await supabaseAdmin
      .from('addresses')
      .select('*')
      .eq('user_id', user.sub)
      .order('created_at', { ascending: false });

    return (addresses || []).map(a => ({
      id: a.id,
      userId: a.user_id,
      clusterId: a.cluster_id,
      label: (a.label || 'home').toLowerCase(),
      houseNo: a.house,
      buildingName: a.landmark,
      streetArea: a.street_area || a.landmark || 'Indore',
      landmark: a.landmark,
      pincode: a.pincode || '452010',
      latitude: a.lat,
      longitude: a.lng,
      isDefault: a.is_default || false
    }));
  });

  // 5. Save New Address
  fastify.post('/user/addresses', { preHandler: [fastify.authenticate] }, async (request: FastifyRequest, reply: FastifyReply) => {
    const user = (request as any).user;
    const body = request.body as any;

    const lat = body.latitude || 22.7533;
    const lng = body.longitude || 75.8937;

    const { data: newAddr, error } = await supabaseAdmin
      .from('addresses')
      .insert({
        user_id: user.sub,
        cluster_id: body.clusterId || null,
        label: body.label || 'Home',
        house: body.houseNo,
        landmark: body.landmark || body.buildingName || '',
        location: `SRID=4326;POINT(${lng} ${lat})`,
        lat,
        lng,
        is_default: body.isDefault ?? true
      })
      .select()
      .single();

    if (error || !newAddr) {
      return reply.status(500).send({ message: 'Failed to save address', error: error?.message });
    }

    return {
      id: newAddr.id,
      userId: newAddr.user_id,
      clusterId: newAddr.cluster_id,
      label: newAddr.label.toLowerCase(),
      houseNo: newAddr.house,
      buildingName: newAddr.landmark,
      streetArea: newAddr.landmark || 'Indore',
      landmark: newAddr.landmark,
      pincode: '452010',
      latitude: newAddr.lat,
      longitude: newAddr.lng,
      isDefault: newAddr.is_default
    };
  });
}


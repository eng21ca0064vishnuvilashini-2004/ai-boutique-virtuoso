import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const { userId } = await req.json();
    
    const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
    const supabaseKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
    const lovableApiKey = Deno.env.get('LOVABLE_API_KEY')!;
    
    const supabase = createClient(supabaseUrl, supabaseKey);

    // Get user's browsing history
    const { data: history } = await supabase
      .from('browsing_history')
      .select('products(id, name, category_id, price)')
      .eq('user_id', userId)
      .order('viewed_at', { ascending: false })
      .limit(20);

    // Get user's order history
    const { data: orders } = await supabase
      .from('order_items')
      .select('products(id, name, category_id, price), orders!inner(user_id)')
      .eq('orders.user_id', userId);

    // Get all products
    const { data: allProducts } = await supabase
      .from('products')
      .select('id, name, slug, category_id, price, description');

    if (!history || !allProducts) {
      return new Response(
        JSON.stringify({ recommendations: [] }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Prepare context for AI
    const viewedProducts = history.map((h: any) => h.products).filter(Boolean);
    const purchasedProducts = orders?.map((o: any) => o.products).filter(Boolean) || [];
    
    // Use AI to generate personalized recommendations
    const prompt = `Based on the following user behavior, recommend 5 products from the available catalog.
    
Viewed Products: ${viewedProducts.map((p: any) => `${p.name} ($${p.price})`).join(', ')}
Purchased Products: ${purchasedProducts.map((p: any) => `${p.name} ($${p.price})`).join(', ')}

Available Products: ${allProducts.map((p: any) => `${p.id}: ${p.name} ($${p.price}) - ${p.description}`).join('\n')}

Return recommendations as JSON array with format: [{"product_id": "uuid", "reason": "why this product"}]`;

    const aiResponse = await fetch('https://ai.gateway.lovable.dev/v1/chat/completions', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${lovableApiKey}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        model: 'google/gemini-2.5-flash',
        messages: [
          {
            role: 'system',
            content: 'You are a fashion recommendation expert. Analyze user behavior and suggest products that match their style and preferences. Return only valid JSON.',
          },
          { role: 'user', content: prompt }
        ],
      }),
    });

    const aiData = await aiResponse.json();
    const aiRecommendations = JSON.parse(
      aiData.choices[0].message.content.replace(/```json\n?|\n?```/g, '')
    );

    // Enrich recommendations with product details
    const enrichedRecommendations = aiRecommendations.map((rec: any) => {
      const product = allProducts.find((p: any) => p.id === rec.product_id);
      return {
        ...rec,
        product_name: product?.name,
        product_slug: product?.slug,
        product_price: product?.price,
      };
    });

    // Store recommendations
    for (const rec of enrichedRecommendations) {
      await supabase.from('product_recommendations').upsert({
        user_id: userId,
        product_id: rec.product_id,
        reason: rec.reason,
        score: 90,
      });
    }

    return new Response(
      JSON.stringify({ recommendations: enrichedRecommendations }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  } catch (error) {
    console.error('Recommendation error:', error);
    return new Response(
      JSON.stringify({ error: error instanceof Error ? error.message : 'Unknown error' }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
});

import express from 'express';
import cors from 'cors';
import dotenv from 'dotenv';
import { createWinery, ensureWinery } from './controllers/auth.controller';
import Stripe from 'stripe';
import { supabase } from './lib/supabase';

dotenv.config();

const app = express();
const stripe = new Stripe(process.env.STRIPE_SECRET_KEY!);
const port = process.env.PORT || 3001;

// Mapeamento de IDs de Preço para Nomes de Plano (Sincronizado com o Front)
const PRICE_TO_PLAN: Record<string, string> = {
  [process.env.STRIPE_PRICE_VINHEDO || ""]: "Viticultura",
  [process.env.STRIPE_PRICE_RESERVA || ""]: "Business",
  [process.env.STRIPE_PRICE_GRAND_CRU || ""]: "Sommelier",
};

app.use(cors());
// Webhook Route (MUST use express.raw for Stripe signature verification)
app.post('/api/webhook/stripe', express.raw({ type: 'application/json' }), async (req: any, res: any) => {
  const sig = req.headers['stripe-signature'];

  let event;
  try {
    event = stripe.webhooks.constructEvent(req.body, sig, process.env.STRIPE_WEBHOOK_SECRET!);
  } catch (err: any) {
    console.error(`❌ Erro no Webhook: ${err.message}`);
    return res.status(400).send(`Webhook Error: ${err.message}`);
  }

  // Lógica para lidar com os eventos do Stripe
  try {
    if (event.type === 'checkout.session.completed' || event.type === 'customer.subscription.updated') {
    const session = event.data.object as any;
    const customerId = session.customer;
    const subscriptionId = session.subscription;
    
    // Pegar o ID do Preço (Price ID)
    let priceId = "";
    if (event.type === 'checkout.session.completed') {
      const lineItems = await stripe.checkout.sessions.listLineItems(session.id);
      priceId = lineItems.data[0]?.price?.id || "";
    } else {
      priceId = session.items.data[0].price.id;
    }

    // Identificar a vinícola (Tentar Session Metadata -> Subscription Metadata -> Customer Metadata)
    let wineryId = session.metadata?.wineryId;
    
    if (!wineryId && session.subscription) {
      const sub = await stripe.subscriptions.retrieve(session.subscription as string);
      wineryId = sub.metadata?.wineryId;
    }

    if (!wineryId) {
      const customer = await stripe.customers.retrieve(customerId) as any;
      wineryId = customer.metadata?.wineryId;
    }

    const planName = PRICE_TO_PLAN[priceId] || "Viticultura";
    console.log(`🔍 Webhook Debug: wineryId=${wineryId}, priceId=${priceId}, planName=${planName}`);

    if (wineryId) {
      console.log(`🚀 Atualizando plano para a vinícola ${wineryId} (Plano: ${planName})`);
      
      const { error } = await supabase
        .from('wineries')
        .update({
          stripe_customer_id: customerId,
          stripe_subscription_id: subscriptionId,
          stripe_price_id: priceId,
          plan_type: 'premium',
          plan_name: planName // Salvando o nome por extenso!
        })
        .eq('id', wineryId);

      if (error) {
        console.error('❌ Erro ao atualizar Supabase:', error.message);
      } else {
        console.log(`✅ Plano ${planName} atualizado com sucesso via Supabase Webhook`);
      }
    }
  }
    
    // Processar cancelamentos
    if (event.type === 'customer.subscription.deleted') {
      const subscription = event.data.object as any; // Cast to any to avoid Stripe namespace issues during build
      
      const { data: wineries } = await supabase
        .from('wineries')
        .select('id')
        .eq('stripe_subscription_id', subscription.id);
        
      const wineryId = wineries?.[0]?.id;

      if (wineryId) {
        await supabase
          .from('wineries')
          .update({
            stripe_price_id: null,
            stripe_subscription_id: null,
            plan_type: 'basic'
          })
          .eq('id', wineryId);
          
        console.log(`❌ Assinatura cancelada para a vinícola ${wineryId} via Supabase Webhook`);
      }
    }

    res.json({ received: true });
  } catch (error) {
    console.error('Erro no webhook:', error);
    res.status(500).send('Webhook handler failed');
  }
});

app.use(express.json());

// Health check
app.get('/health', (req: any, res: any) => {
  res.json({ status: 'ok' });
});

// Auth Routes
app.post('/auth/create-winery', createWinery);
app.post('/auth/ensure-winery', ensureWinery);

// Stripe Checkout Route
app.post('/api/checkout/create-session', async (req: any, res: any) => {
  const { priceId, userId, wineryId, returnUrl } = req.body;
  
  if (!priceId) {
    return res.status(400).json({ error: 'priceId is required' });
  }

  try {
    console.log(`🛒 Criando sessão para Winery: ${wineryId}, User: ${userId}`);
    const successUrl = returnUrl ? `${returnUrl}?session_id={CHECKOUT_SESSION_ID}&success=true` : process.env.STRIPE_SUCCESS_URL!;
    const cancelUrl = returnUrl || process.env.STRIPE_CANCEL_URL!;

    const session = await stripe.checkout.sessions.create({
      line_items: [
        {
          price: priceId,
          quantity: 1,
        },
      ],
      mode: 'subscription',
      success_url: successUrl,
      cancel_url: cancelUrl,
      client_reference_id: userId,
      metadata: {
        userId: userId || null,
        wineryId: wineryId || null
      },
      subscription_data: {
        metadata: {
          wineryId: wineryId || null,
          userId: userId || null
        }
      }
    });

    res.json({ url: session.url });
  } catch (error: any) {
    console.error('Stripe error:', error);
    res.status(500).json({ error: error.message });
  }
});

// Route to fetch plans from Stripe
app.get('/api/checkout/plans', async (req: any, res: any) => {
  try {
    const priceIds = [
      process.env.VITE_STRIPE_PRICE_VINHEDO || process.env.STRIPE_PRICE_VINHEDO,
      process.env.VITE_STRIPE_PRICE_RESERVA || process.env.STRIPE_PRICE_RESERVA,
      process.env.VITE_STRIPE_PRICE_GRAND_CRU || process.env.STRIPE_PRICE_GRAND_CRU
    ].filter(Boolean) as string[];

    console.log('[Stripe] Buscando detalhes para os IDs:', priceIds);

    if (priceIds.length === 0) {
      return res.status(400).json({ error: 'No price IDs configured in .env' });
    }

    const plans = await Promise.all(
      priceIds.map(async (id) => {
        const price = await stripe.prices.retrieve(id, {
          expand: ['product'],
        });
        const product = price.product as any;
        
        return {
          priceId: price.id,
          name: product.name,
          price: (price.unit_amount || 0) / 100,
          desc: product.description || "",
        };
      })
    );

    res.json(plans);
  } catch (error: any) {
    console.error('Error fetching plans from Stripe:', error);
    res.status(500).json({ error: error.message });
  }
});

// Verify Session Route (para o frontend processar os dados e salvar no Supabase)
app.post('/api/checkout/verify-session', async (req: any, res: any) => {
  const { session_id } = req.body;
  if (!session_id) return res.status(400).json({ error: 'session_id is required' });

  try {
    const session = await stripe.checkout.sessions.retrieve(session_id);
    
    if (session.payment_status === 'paid') {
      const lineItems = await stripe.checkout.sessions.listLineItems(session.id);
      const priceId = lineItems.data[0]?.price?.id;
      
      let planName = "Viticultura";
      let planPrice = 129;

      if (priceId === process.env.VITE_STRIPE_PRICE_RESERVA || priceId === process.env.STRIPE_PRICE_RESERVA) {
        planName = "Business";
        planPrice = 349;
      } else if (priceId === process.env.VITE_STRIPE_PRICE_GRAND_CRU || priceId === process.env.STRIPE_PRICE_GRAND_CRU) {
        planName = "Sommelier";
        planPrice = 849;
      }

      return res.json({ 
        success: true, 
        priceId,
        planName,
        planPrice,
        subscriptionId: session.subscription,
        customerId: session.customer
      });
    }
    
    res.json({ success: false, status: session.payment_status });
  } catch (error: any) {
    console.error('Error verifying session:', error);
    res.status(500).json({ error: error.message });
  }
});

// Exemplo de rota de Produtos
app.get('/products', async (req, res) => {
  const { wineryId } = req.query;
  
  if (!wineryId) {
    return res.status(400).json({ error: 'wineryId is required' });
  }

  try {
    const { data: products, error } = await supabase
      .from('products')
      .select('*')
      .eq('winery_id', wineryId as string);

    if (error) throw error;
    res.json(products);
  } catch (error) {
    res.status(500).json({ error: 'Failed to fetch products' });
  }
});

// WhatsApp Bulk Send Route
app.post('/api/whatsapp/send-bulk-feedback', async (req: any, res: any) => {
  const { eventTitle, bookings, baseUrl } = req.body;
  
  const apiUrl = process.env.EVOLUTION_API_URL;
  const apiKey = process.env.EVOLUTION_API_KEY;
  const instance = process.env.EVOLUTION_INSTANCE_NAME;

  console.log(`[WhatsApp] Iniciando disparo em massa para: ${eventTitle}`);

  if (!apiUrl || !apiKey || !instance) {
    console.error('[WhatsApp] Configurações ausentes no .env');
    return res.status(500).json({ error: 'WhatsApp configuration missing on server' });
  }

  const results = [];

  for (const booking of bookings) {
    if (!booking.customer_phone) {
      results.push({ customer: booking.customer_name, status: 'skipped', reason: 'no phone' });
      continue;
    }

    const cleanPhone = booking.customer_phone.replace(/\D/g, '');
    const feedbackLink = `${baseUrl}/feedback/${booking.id}`;
    const message = `Olá ${booking.customer_name}! Foi um prazer receber você na nossa experiência de ${eventTitle}. O que você achou? Avalie aqui: ${feedbackLink}`;

    try {
      const response = await fetch(`${apiUrl}/message/sendText/${instance}`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'apikey': apiKey
        },
        body: JSON.stringify({
          number: `55${cleanPhone}`,
          text: message,
          delay: 1200,
          linkPreview: true
        })
      });

      const data = await response.json();
      console.log(`[WhatsApp] Mensagem enviada para ${booking.customer_name}`);
      results.push({ customer: booking.customer_name, status: 'sent', data });
    } catch (error) {
      console.error(`[WhatsApp] Erro ao enviar para ${booking.customer_name}:`, error);
      results.push({ customer: booking.customer_name, status: 'error', error });
    }
  }

  res.json({ success: true, results });
});

app.listen(port, () => {
  console.log(`🚀 Backend Vintech rodando em http://localhost:${port}`);
});

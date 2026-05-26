import { Request, Response } from 'express';
import { supabase } from '../lib/supabase';

export const createWinery = async (req: Request, res: Response) => {
  const { wineryName } = req.body;

  if (!wineryName) {
    return res.status(400).json({ error: 'Nome da Vinícola é obrigatório.' });
  }

  try {
    const slug = wineryName.toLowerCase().replace(/ /g, '-') + '-' + Math.random().toString(36).substring(2, 7);
    
    const { data, error } = await supabase
      .from('wineries')
      .insert([
        { 
          name: wineryName, 
          slug,
          plan_type: 'basic', // Começa no básico
          trial_started_at: new Date().toISOString() // Inicia o Trial de 15 dias
        }
      ])
      .select()
      .single();

    if (error) throw error;

    res.status(201).json({ wineryId: data.id });
  } catch (error: any) {
    console.error('Erro no createWinery:', error.message);
    res.status(500).json({ error: 'Erro ao criar vinícola: ' + error.message });
  }
};

/**
 * Garante que o usuário autenticado tenha um profile vinculado a uma vinícola.
 * Idempotente: se já existir winery_id, apenas retorna. Caso contrário, cria
 * uma vinícola (com trial de 15 dias) e vincula ao profile.
 *
 * Recupera contas em que o trigger de signup não gravou o winery_id — sem isso
 * o profile fica com winery_id null e toda a interface trava em loading infinito.
 */
export const ensureWinery = async (req: Request, res: Response) => {
  const token = req.headers.authorization?.replace('Bearer ', '');
  if (!token) return res.status(401).json({ error: 'Token de autenticação ausente.' });

  // Valida o JWT com a service-role key e descobre quem é o usuário.
  const { data: { user }, error: userError } = await supabase.auth.getUser(token);
  if (userError || !user) {
    return res.status(401).json({ error: 'Token inválido.' });
  }

  try {
    const { data: profile } = await supabase
      .from('profiles')
      .select('id, winery_id, full_name')
      .eq('id', user.id)
      .single();

    // Já vinculado: nada a fazer.
    if (profile?.winery_id) {
      return res.json({ wineryId: profile.winery_id, created: false });
    }

    const baseName =
      profile?.full_name?.trim() ||
      (user.user_metadata as any)?.full_name ||
      user.email?.split('@')[0] ||
      'Minha';
    const wineryName = `${baseName}'s Winery`;
    const slug =
      wineryName.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '') +
      '-' + Math.random().toString(36).substring(2, 7);

    const { data: winery, error: wineryError } = await supabase
      .from('wineries')
      .insert([{
        name: wineryName,
        slug,
        plan_type: 'basic',
        trial_started_at: new Date().toISOString(),
      }])
      .select()
      .single();

    if (wineryError) throw wineryError;

    // Vincula (upsert cobre o caso raro do profile ainda não existir).
    const { error: linkError } = await supabase
      .from('profiles')
      .upsert(
        {
          id: user.id,
          winery_id: winery.id,
          full_name: profile?.full_name ?? (user.user_metadata as any)?.full_name ?? null,
        },
        { onConflict: 'id' }
      );

    if (linkError) throw linkError;

    return res.json({ wineryId: winery.id, created: true });
  } catch (error: any) {
    console.error('Erro no ensureWinery:', error.message);
    return res.status(500).json({ error: 'Erro ao vincular vinícola: ' + error.message });
  }
};

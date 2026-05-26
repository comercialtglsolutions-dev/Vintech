import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/lib/supabase";
import { useAuth } from "@/contexts/AuthContext";
import { startOfMonth, endOfMonth, addMonths, differenceInCalendarDays, addDays } from "date-fns";

export interface PlanLimits {
  name: string;
  maxUsers: number;
  maxOrders: number;
  priceId: string;
  expiresAt?: string | null;
  isTrial?: boolean;
  trialDaysLeft?: number;
}

export const PLAN_CONFIGS: Record<string, PlanLimits> = {
  "Viticultura": {
    name: "Viticultura",
    maxUsers: 3,
    maxOrders: 500,
    priceId: import.meta.env.VITE_STRIPE_PRICE_VINHEDO || "viticultura",
  },
  "Business": {
    name: "Business",
    maxUsers: 7,
    maxOrders: 1000,
    priceId: import.meta.env.VITE_STRIPE_PRICE_RESERVA || "business",
  },
  "Sommelier": {
    name: "Sommelier",
    maxUsers: 999999,
    maxOrders: 999999,
    priceId: import.meta.env.VITE_STRIPE_PRICE_GRAND_CRU || "sommelier",
  },
};

const PRICE_TO_PLAN: Record<string, string> = {
  [import.meta.env.VITE_STRIPE_PRICE_VINHEDO || "viticultura"]: "Viticultura",
  [import.meta.env.VITE_STRIPE_PRICE_RESERVA || "business"]: "Business",
  [import.meta.env.VITE_STRIPE_PRICE_GRAND_CRU || "sommelier"]: "Sommelier",
};

const DEFAULT_PLAN = PLAN_CONFIGS["Viticultura"];

export function usePlanLimits() {
  const { profile } = useAuth();

  return useQuery({
    queryKey: ["plan-limits", profile?.winery_id],
    enabled: !!profile?.winery_id,
    queryFn: async () => {
      if (!profile?.winery_id) throw new Error("No winery");

      // 1. Buscar os DADOS REAIS da vinícola
      const { data: winery, error: wineryError } = await supabase
        .from("wineries")
        .select("stripe_price_id, plan_type, trial_started_at, created_at, plan_name")
        .eq("id", profile.winery_id)
        .single();

      if (wineryError) {
        console.error("[usePlanLimits] Erro ao buscar vinícola:", wineryError.message);
      }

      const priceId = winery?.stripe_price_id;
      const isPaidPlan = !!priceId && priceId !== "viticultura";
      
      // Lógica de Trial (15 dias de calendário a partir do início)
      const trialStart = new Date(winery?.trial_started_at || winery?.created_at || new Date());
      const trialEnd = addDays(trialStart, 15);
      // differenceInCalendarDays ignora horas: no dia 1 retorna 15, não 14.
      const daysLeft = differenceInCalendarDays(trialEnd, new Date());
      const isTrialActive = !isPaidPlan && daysLeft > 0;

      // Determinar o nome do plano (Prioridade para o que está no banco)
      let currentPlanName = winery?.plan_name || "Viticultura";
      let displayName = currentPlanName;
      
      if (isPaidPlan) {
        currentPlanName = winery?.plan_name || PRICE_TO_PLAN[priceId] || "Viticultura";
        displayName = currentPlanName;
      } else if (isTrialActive) {
        currentPlanName = "Business"; // Limites do Business
        displayName = "Período de Teste";
      }

      const config = PLAN_CONFIGS[currentPlanName] || DEFAULT_PLAN;
      
      const limits: PlanLimits = {
        ...config,
        name: displayName, // Usamos o nome de exibição aqui
        isTrial: isTrialActive,
        trialDaysLeft: isTrialActive ? daysLeft : 0,
        expiresAt: isPaidPlan 
          ? addMonths(new Date(), 1).toISOString()
          : (isTrialActive ? trialEnd.toISOString() : null)
      };

      // 2. Contar membros da equipe
      const { count: teamCount } = await supabase
        .from("profiles")
        .select("*", { count: "exact", head: true })
        .eq("winery_id", profile.winery_id);

      // 3. Contar pedidos no mês atual
      const now = new Date();
      const monthStart = startOfMonth(now).toISOString();
      const monthEnd = endOfMonth(now).toISOString();

      const { count: ordersCount } = await supabase
        .from("orders")
        .select("*", { count: "exact", head: true })
        .eq("winery_id", profile.winery_id)
        .gte("created_at", monthStart)
        .lte("created_at", monthEnd);

      return {
        limits,
        usage: {
          teamMembers: teamCount || 0,
          ordersThisMonth: ordersCount || 0,
        },
        canAddUser: (teamCount || 0) < limits.maxUsers,
        canCreateOrder: (ordersCount || 0) < limits.maxOrders,
      };
    },
  });
}

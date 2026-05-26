import { useState, useEffect } from "react";
import { KpiCard } from "@/components/dashboard/KpiCard";
import { DollarSign, TrendingUp, Wine, Users, Download, Loader2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { supabase } from "@/lib/supabase";
import { useAuth } from "@/contexts/AuthContext";
import { format, startOfYear, startOfMonth, subMonths, isWithinInterval, parseISO, eachMonthOfInterval } from "date-fns";
import { ptBR } from "date-fns/locale";
import {
  ResponsiveContainer, LineChart, Line, XAxis, YAxis, Tooltip, CartesianGrid,
  PieChart, Pie, Cell, Legend, BarChart, Bar,
} from "recharts";

const COLORS = ["hsl(350, 55%, 22%)", "hsl(43, 53%, 54%)", "hsl(350, 55%, 45%)", "hsl(43, 60%, 78%)"];

export const AnalyticsPage = () => {
  const { profile, loading: authLoading } = useAuth();
  const [loading, setLoading] = useState(true);
  const [trendData, setTrendData] = useState<any[]>([]);
  const [categoryData, setCategoryData] = useState<any[]>([]);
  const [topProducts, setTopProducts] = useState<any[]>([]);
  const [kpis, setKpis] = useState({
    ytdRevenue: 0,
    momGrowth: 0,
    bottlesSold: 0,
    conversion: 0,
    totalVisitors: 0,
    postVisitPurchases: 0,
    avgTicket: 0
  });

  const fetchData = async () => {
    if (!profile?.winery_id) {
      if (!authLoading) setLoading(false);
      return;
    }
    setLoading(true);
    try {
      // 1. Buscar Histórico de Vendas
      const { data: orders } = await supabase
        .from("orders")
        .select(`*, items:order_items(product_name, quantity, total_price, product_id, products(category))`)
        .eq("winery_id", profile.winery_id);

      // 2. Buscar Histórico de Visitantes
      const { data: bookings } = await supabase
        .from("bookings")
        .select("*")
        .eq("winery_id", profile.winery_id);

      if (orders && bookings) {
        const now = new Date();
        const yearStart = startOfYear(now);
        
        // --- KPI: Receita YTD (Year to Date) ---
        const ytdRevenue = orders
          .filter(o => o.status === 'completed' && parseISO(o.created_at) >= yearStart)
          .reduce((acc, o) => acc + Number(o.total_amount), 0);

        // --- KPI: Garrafas Vendidas ---
        const totalBottles = orders.reduce((acc, o) => 
          acc + o.items.reduce((sum: number, i: any) => sum + i.quantity, 0), 0);

        // --- Histórico de 12 Meses (Grafico Principal) ---
        const last12Months = eachMonthOfInterval({
          start: subMonths(now, 11),
          end: now
        }).map(d => {
          const start = startOfMonth(d);
          const end = format(d, "MMM", { locale: ptBR });
          const interval = { start: startOfMonth(d), end: format(now, "yyyy-MM-dd") === format(d, "yyyy-MM-dd") ? now : d };
          
          const monthRev = orders
            .filter(o => o.status === 'completed' && format(parseISO(o.created_at), 'MM/yyyy') === format(d, 'MM/yyyy'))
            .reduce((acc, o) => acc + Number(o.total_amount), 0);
          
          const monthVis = bookings
            .filter(b => format(parseISO(b.created_at), 'MM/yyyy') === format(d, 'MM/yyyy'))
            .reduce((acc, b) => acc + (b.participants || 0), 0);

          return { mes: end, receita: monthRev / 1000, visitantes: monthVis };
        });

        // --- Top 5 Produtos ---
        const productMap: Record<string, number> = {};
        orders.forEach(o => o.items.forEach((i: any) => {
          productMap[i.product_name] = (productMap[i.product_name] || 0) + i.quantity;
        }));
        const top5 = Object.entries(productMap)
          .sort((a, b) => b[1] - a[1])
          .slice(0, 5)
          .map(([nome, vendas]) => ({ nome, vendas }));

        // --- Categorias ---
        const catMap: Record<string, number> = {};
        orders.forEach(o => o.items.forEach((i: any) => {
          const cat = i.products?.category || "Outros";
          catMap[cat] = (catMap[cat] || 0) + i.quantity;
        }));
        setCategoryData(Object.entries(catMap).map(([name, value]) => ({ name, value })));

        setTrendData(last12Months);
        setTopProducts(top5);
        setKpis({
          ytdRevenue,
          momGrowth: 15.4, // Estático por enquanto
          bottlesSold: totalBottles,
          conversion: 18,
          totalVisitors: bookings.reduce((acc, b) => acc + (b.participants || 0), 0),
          postVisitPurchases: Math.floor(bookings.length * 0.18),
          avgTicket: ytdRevenue / (orders.length || 1)
        });
      }
    } catch (err) {
      console.error("Erro analytics:", err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchData();
  }, [profile, authLoading]);

  if (loading) {
    return (
      <div className="h-[80vh] flex flex-col items-center justify-center gap-4 text-muted-foreground">
        <Loader2 className="h-10 w-10 animate-spin text-wine" />
        <p className="font-display text-lg animate-pulse">Processando inteligência de dados...</p>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <p className="text-xs font-semibold uppercase tracking-[0.2em] text-primary">Insights</p>
          <h1 className="mt-2 font-display text-3xl font-bold tracking-tight md:text-4xl">Analytics</h1>
          <p className="mt-1 text-muted-foreground">KPIs, tendências e relatórios da operação completa.</p>
        </div>
        <div className="flex gap-2">
          <Button variant="outline" onClick={() => window.print()}><Download /> Exportar Relatório</Button>
        </div>
      </div>

      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
        <KpiCard label="Receita YTD" value={kpis.ytdRevenue.toLocaleString("pt-BR", { style: "currency", currency: "BRL", notation: 'compact' })} change={32.4} icon={DollarSign} variant="wine" />
        <KpiCard label="Ticket Médio" value={kpis.avgTicket.toLocaleString("pt-BR", { style: "currency", currency: "BRL" })} change={3.1} icon={TrendingUp} />
        <KpiCard label="Garrafas vendidas" value={kpis.bottlesSold.toLocaleString("pt-BR")} change={18.6} icon={Wine} />
        <KpiCard label="Visitantes Totais" value={kpis.totalVisitors.toString()} change={2.3} icon={Users} />
      </div>

      <div className="grid gap-6 lg:grid-cols-3">
        <div className="rounded-2xl border border-border bg-card p-6 shadow-card lg:col-span-2">
          <h3 className="font-display text-lg font-semibold">Receita & Visitantes — 12 meses</h3>
          <p className="text-xs text-muted-foreground">Receita em R$ mil (Linha Vinho) · Visitantes (Linha Ouro)</p>
          <ResponsiveContainer width="100%" height={320}>
            <LineChart data={trendData} margin={{ top: 20, right: 4, left: -12, bottom: 0 }}>
              <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" vertical={false} />
              <XAxis dataKey="mes" stroke="hsl(var(--muted-foreground))" fontSize={11} tickLine={false} axisLine={false} />
              <YAxis yAxisId="l" stroke="hsl(var(--muted-foreground))" fontSize={11} tickLine={false} axisLine={false} />
              <YAxis yAxisId="r" orientation="right" stroke="hsl(var(--muted-foreground))" fontSize={11} tickLine={false} axisLine={false} />
              <Tooltip contentStyle={{ background: "hsl(var(--card))", border: "1px solid hsl(var(--border))", borderRadius: 8, fontSize: 12 }} />
              <Legend wrapperStyle={{ fontSize: 11 }} />
              <Line yAxisId="l" name="Receita (k)" type="monotone" dataKey="receita" stroke="hsl(var(--primary))" strokeWidth={2.5} dot={{ r: 3 }} activeDot={{ r: 5 }} />
              <Line yAxisId="r" name="Visitantes" type="monotone" dataKey="visitantes" stroke="hsl(var(--gold))" strokeWidth={2.5} dot={{ r: 3 }} activeDot={{ r: 5 }} />
            </LineChart>
          </ResponsiveContainer>
        </div>

        <div className="rounded-2xl border border-border bg-card p-6 shadow-card">
          <h3 className="font-display text-lg font-semibold">Vendas por categoria</h3>
          <p className="text-xs text-muted-foreground">% do volume total</p>
          <ResponsiveContainer width="100%" height={280}>
            <PieChart>
              <Pie data={categoryData} cx="50%" cy="50%" innerRadius={55} outerRadius={90} paddingAngle={3} dataKey="value">
                {categoryData.map((_, i) => <Cell key={i} fill={COLORS[i % COLORS.length]} />)}
              </Pie>
              <Tooltip contentStyle={{ background: "hsl(var(--card))", border: "1px solid hsl(var(--border))", borderRadius: 8, fontSize: 12 }} />
              <Legend wrapperStyle={{ fontSize: 11 }} />
            </PieChart>
          </ResponsiveContainer>
        </div>
      </div>

      <div className="grid gap-6 lg:grid-cols-2">
        <div className="rounded-2xl border border-border bg-card p-6 shadow-card">
          <h3 className="font-display text-lg font-semibold">Top 5 produtos</h3>
          <p className="text-xs text-muted-foreground">Garrafas vendidas · todo o período</p>
          <ResponsiveContainer width="100%" height={280}>
            <BarChart data={topProducts} layout="vertical" margin={{ top: 12, right: 16, left: 10, bottom: 0 }}>
              <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" horizontal={false} />
              <XAxis type="number" stroke="hsl(var(--muted-foreground))" fontSize={11} tickLine={false} axisLine={false} />
              <YAxis type="category" dataKey="nome" stroke="hsl(var(--muted-foreground))" fontSize={11} tickLine={false} axisLine={false} width={140} />
              <Tooltip contentStyle={{ background: "hsl(var(--card))", border: "1px solid hsl(var(--border))", borderRadius: 8, fontSize: 12 }} />
              <Bar dataKey="vendas" fill="hsl(var(--primary))" radius={[0, 6, 6, 0]} />
            </BarChart>
          </ResponsiveContainer>
        </div>

        <div className="rounded-2xl border border-primary/20 bg-wine p-6 text-primary-foreground shadow-elegant">
          <p className="text-xs font-semibold uppercase tracking-wider text-gold">Insight da Operação</p>
          <h3 className="mt-2 font-display text-2xl font-bold">Resumo Enoturismo</h3>
          <p className="mt-3 text-sm text-primary-foreground/75 leading-relaxed">
            Dados baseados no fluxo total de visitantes e comportamento de compra registrado no sistema.
          </p>
          <div className="mt-6 grid grid-cols-3 gap-4 border-t border-primary-foreground/10 pt-6">
            {[
              { v: kpis.totalVisitors.toString(), l: "Visitantes" },
              { v: kpis.postVisitPurchases.toString(), l: "Conversão Est." },
              { v: kpis.avgTicket.toLocaleString("pt-BR", { style: "currency", currency: "BRL", notation: 'compact' }), l: "Ticket Médio" },
            ].map((s) => (
              <div key={s.l}>
                <div className="font-display text-2xl font-bold text-gold">{s.v}</div>
                <div className="mt-1 text-[10px] uppercase tracking-wider text-primary-foreground/55">{s.l}</div>
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
};

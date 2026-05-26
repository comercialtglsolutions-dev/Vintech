import { useState, useEffect } from "react";
import { ShoppingCart, Truck, Sparkles, DollarSign, TrendingUp, Search, MoreVertical, Trash2, Edit3, Loader2, Calendar } from "lucide-react";
import { KpiCard } from "@/components/dashboard/KpiCard";
import { Button } from "@/components/ui/button";
import { SaleSheet } from "@/components/dashboard/SaleSheet";
import { supabase } from "@/lib/supabase";
import { useAuth } from "@/contexts/AuthContext";
import { format } from "date-fns";
import { ptBR } from "date-fns/locale";
import { toast } from "sonner";
import { cn } from "@/lib/utils";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";

const statusColor = (s: string) => {
  switch (s) {
    case 'completed': return "bg-success/10 text-success";
    case 'pending': return "bg-gold/15 text-gold-foreground";
    case 'cancelled': return "bg-destructive/10 text-destructive";
    default: return "bg-muted text-muted-foreground";
  }
};

const statusLabel = (s: string) => {
  switch (s) {
    case 'completed': return "Pago/Concluído";
    case 'pending': return "Pendente";
    case 'cancelled': return "Cancelado";
    default: return s;
  }
};

export const VendasPage = () => {
  const { profile, loading: authLoading } = useAuth();
  const [isSaleSheetOpen, setIsSaleSheetOpen] = useState(false);
  const [orders, setOrders] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [selectedSale, setSelectedSale] = useState<any>(null);

  const fetchData = async () => {
    if (!profile?.winery_id) {
      if (!authLoading) setLoading(false);
      return;
    }
    setLoading(true);
    try {
      const { data, error } = await supabase
        .from("orders")
        .select(`
          *,
          items:order_items(count)
        `)
        .eq("winery_id", profile.winery_id)
        .order("created_at", { ascending: false });

      if (error) throw error;
      setOrders(data || []);
    } catch (err: any) {
      toast.error("Erro ao carregar vendas: " + err.message);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchData();
  }, [profile, authLoading]);

  const handleDelete = async (id: string) => {
    if (!confirm("Tem certeza que deseja excluir esta venda? Isso não afetará o estoque (por enquanto).")) return;
    
    try {
      const { error } = await supabase.from("orders").delete().eq("id", id);
      if (error) throw error;
      toast.success("Venda excluída!");
      fetchData();
    } catch (err: any) {
      toast.error("Erro ao excluir: " + err.message);
    }
  };

  const totalRevenue = orders.reduce((acc, o) => acc + (o.status === 'completed' ? Number(o.total_amount) : 0), 0);
  const pendingRevenue = orders.reduce((acc, o) => acc + (o.status === 'pending' ? Number(o.total_amount) : 0), 0);

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <p className="text-xs font-semibold uppercase tracking-[0.2em] text-primary">Comercial</p>
          <h1 className="mt-2 font-display text-3xl font-bold tracking-tight md:text-4xl">Vendas</h1>
          <p className="mt-1 text-muted-foreground">Pedidos, clientes e controle de caixa da vinícola.</p>
        </div>
        <div className="flex gap-2">
          <Button variant="outline" onClick={fetchData}>
            Atualizar
          </Button>
          <Button variant="hero" onClick={() => { setSelectedSale(null); setIsSaleSheetOpen(true); }}>
            <ShoppingCart className="mr-2 h-4 w-4" /> Novo pedido
          </Button>
        </div>
      </div>

      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
        <KpiCard 
          label="Receita Total" 
          value={totalRevenue.toLocaleString("pt-BR", { style: "currency", currency: "BRL" })} 
          icon={DollarSign} 
          variant="wine" 
        />
        <KpiCard label="Pedidos" value={orders.length.toString()} icon={ShoppingCart} />
        <KpiCard 
          label="Pendente" 
          value={pendingRevenue.toLocaleString("pt-BR", { style: "currency", currency: "BRL" })} 
          icon={TrendingUp} 
          hint="Vendas em aberto"
        />
        <KpiCard label="Itens Vendidos" value={orders.reduce((acc, o) => acc + (o.items?.[0]?.count || 0), 0).toString()} icon={Sparkles} />
      </div>

      <div className="rounded-2xl border border-border bg-card shadow-card">
        <div className="flex items-center justify-between border-b border-border p-6">
          <h3 className="font-display text-lg font-semibold">Histórico de Pedidos</h3>
          <div className="flex gap-1.5">
            <div className="relative">
              <Search className="absolute left-2.5 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-muted-foreground" />
              <input 
                placeholder="Buscar cliente..." 
                className="h-8 rounded-md border border-border bg-secondary/30 pl-8 pr-3 text-xs focus:outline-none focus:ring-1 focus:ring-wine/20 w-[200px]"
              />
            </div>
          </div>
        </div>
        
        <div className="overflow-x-auto">
          {loading ? (
            <div className="flex flex-col items-center justify-center py-20 gap-3 text-muted-foreground">
              <Loader2 className="h-8 w-8 animate-spin text-wine" />
              <p className="text-sm">Carregando histórico...</p>
            </div>
          ) : orders.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-20 text-center opacity-40">
              <ShoppingCart className="h-12 w-12 mb-4" />
              <p className="text-lg font-medium">Nenhuma venda registrada.</p>
              <p className="text-sm">Clique em "Novo pedido" para começar.</p>
            </div>
          ) : (
            <table className="w-full text-sm">
              <thead className="bg-secondary/50 text-left text-xs uppercase tracking-wider text-muted-foreground">
                <tr>
                  <th className="px-6 py-3 font-medium">Data</th>
                  <th className="px-6 py-3 font-medium">Cliente</th>
                  <th className="px-6 py-3 font-medium text-center">Itens</th>
                  <th className="px-6 py-3 font-medium">Valor</th>
                  <th className="px-6 py-3 font-medium">Pagamento</th>
                  <th className="px-6 py-3 font-medium text-center">Status</th>
                  <th className="px-6 py-3 font-medium text-right">Ações</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-border">
                {orders.map((o) => (
                  <tr key={o.id} className="hover:bg-secondary/30 group">
                    <td className="px-6 py-4">
                      <div className="flex items-center gap-2">
                        <Calendar className="h-3.5 w-3.5 text-muted-foreground" />
                        <span className="text-xs">{format(new Date(o.created_at), "dd/MM/yy HH:mm", { locale: ptBR })}</span>
                      </div>
                    </td>
                    <td className="px-6 py-4">
                      <div className="font-medium text-primary">{o.customer_name}</div>
                      <div className="text-[10px] text-muted-foreground">{o.customer_cpf || "Sem CPF"}</div>
                    </td>
                    <td className="px-6 py-4 text-center font-mono text-xs">{o.items?.[0]?.count || 0}</td>
                    <td className="px-6 py-4 font-bold text-wine">
                      {Number(o.total_amount).toLocaleString("pt-BR", { style: "currency", currency: "BRL" })}
                    </td>
                    <td className="px-6 py-4">
                      <span className="text-[10px] uppercase font-semibold tracking-wider text-muted-foreground">
                        {o.payment_method}
                      </span>
                    </td>
                    <td className="px-6 py-4 text-center">
                      <span className={cn("rounded-full px-2.5 py-0.5 text-[10px] font-bold uppercase", statusColor(o.status))}>
                        {statusLabel(o.status)}
                      </span>
                    </td>
                    <td className="px-6 py-4 text-right">
                      <DropdownMenu>
                        <DropdownMenuTrigger asChild>
                          <Button variant="ghost" size="sm" className="h-8 w-8 p-0">
                            <MoreVertical className="h-4 w-4" />
                          </Button>
                        </DropdownMenuTrigger>
                        <DropdownMenuContent align="end" className="bg-card border-border shadow-elegant">
                          <DropdownMenuItem className="gap-2 cursor-pointer" onClick={() => { setSelectedSale(o); setIsSaleSheetOpen(true); }}>
                            <Edit3 className="h-4 w-4" /> Ver Detalhes
                          </DropdownMenuItem>
                          <DropdownMenuItem className="gap-2 text-destructive cursor-pointer" onClick={() => handleDelete(o.id)}>
                            <Trash2 className="h-4 w-4" /> Excluir Venda
                          </DropdownMenuItem>
                        </DropdownMenuContent>
                      </DropdownMenu>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </div>
      </div>

      <SaleSheet 
        open={isSaleSheetOpen} 
        onOpenChange={setIsSaleSheetOpen} 
        onSuccess={fetchData}
        sale={selectedSale}
      />
    </div>
  );
};

import { useState, useEffect } from "react";
import { Plus, Mail, Phone, Shield, MoreVertical, Trash2, Edit3, Loader2, User } from "lucide-react";
import { Button } from "@/components/ui/button";
import { StaffSheet } from "@/components/dashboard/StaffSheet";
import { supabase } from "@/lib/supabase";
import { useAuth } from "@/contexts/AuthContext";
import { toast } from "sonner";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";

const papelColor = (p: string) => {
  switch (p) {
    case 'admin': return "bg-wine text-gold";
    case 'manager': return "bg-gold/20 text-gold-foreground border border-gold/20";
    case 'sommelier': return "bg-primary/10 text-primary border border-primary/20";
    default: return "bg-secondary text-secondary-foreground border border-border";
  }
};

const papelLabel = (p: string) => {
  switch (p) {
    case 'admin': return "Administrador";
    case 'manager': return "Gerente";
    case 'sommelier': return "Sommelier";
    case 'staff': return "Atendimento";
    default: return p;
  }
};

export const EquipePage = () => {
  const { profile, loading: authLoading } = useAuth();
  const [isSheetOpen, setIsSheetOpen] = useState(false);
  const [staff, setStaff] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [selectedMember, setSelectedMember] = useState<any>(null);

  const fetchStaff = async () => {
    if (!profile?.winery_id) {
      if (!authLoading) setLoading(false);
      return;
    }
    setLoading(true);
    try {
      const { data, error } = await supabase
        .from("profiles")
        .select("*")
        .eq("winery_id", profile.winery_id)
        .order("full_name", { ascending: true });

      if (error) throw error;
      setStaff(data || []);
    } catch (err: any) {
      toast.error("Erro ao carregar equipe: " + err.message);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchStaff();
  }, [profile, authLoading]);

  const handleDelete = async (id: string) => {
    if (id === profile?.id) return toast.error("Você não pode excluir seu próprio perfil.");
    if (!confirm("Remover este membro da equipe?")) return;
    
    try {
      const { error } = await supabase.from("profiles").delete().eq("id", id);
      if (error) throw error;
      toast.success("Membro removido.");
      fetchStaff();
    } catch (err: any) {
      toast.error("Erro ao remover: " + err.message);
    }
  };

  const getInitials = (name: string) => {
    return name.split(' ').map(n => n[0]).join('').toUpperCase().substring(0, 2);
  };

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <p className="text-xs font-semibold uppercase tracking-[0.2em] text-primary">Pessoas</p>
          <h1 className="mt-2 font-display text-3xl font-bold tracking-tight md:text-4xl">Equipe</h1>
          <p className="mt-1 text-muted-foreground">Funcionários, papéis e controle de acesso da vinícola.</p>
        </div>
        <div className="flex gap-2">
          <Button variant="outline" onClick={fetchStaff}><Shield className="mr-2 h-4 w-4" /> Atualizar</Button>
          <Button variant="hero" onClick={() => { setSelectedMember(null); setIsSheetOpen(true); }}>
            <Plus className="mr-2 h-4 w-4" /> Novo funcionário
          </Button>
        </div>
      </div>

      <div className="grid gap-3 sm:grid-cols-4">
        {[
          { l: "Total", v: staff.length },
          { l: "Admins", v: staff.filter(s => s.role === 'admin').length },
          { l: "Gerentes", v: staff.filter(s => s.role === 'manager').length },
          { l: "Outros", v: staff.filter(s => s.role !== 'admin' && s.role !== 'manager').length },
        ].map((s) => (
          <div key={s.l} className="rounded-xl border border-border bg-card p-4">
            <div className="text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">{s.l}</div>
            <div className="mt-1 font-display text-2xl font-bold">{s.v}</div>
          </div>
        ))}
      </div>

      {loading ? (
        <div className="flex flex-col items-center justify-center py-20 gap-3 text-muted-foreground">
          <Loader2 className="h-8 w-8 animate-spin text-gold" />
          <p className="text-sm">Carregando equipe...</p>
        </div>
      ) : staff.length === 0 ? (
        <div className="flex flex-col items-center justify-center py-20 text-center opacity-40">
          <User className="h-12 w-12 mb-4" />
          <p className="text-lg font-medium">Nenhum funcionário cadastrado.</p>
          <p className="text-sm">Sua equipe aparecerá aqui.</p>
        </div>
      ) : (
        <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
          {staff.map((m) => (
            <article key={m.id} className="group relative overflow-hidden rounded-2xl border border-border bg-card p-6 shadow-card transition-all hover:-translate-y-0.5 hover:shadow-elegant hover:border-primary/30">
              <div className="flex items-start justify-between">
                <div className="flex h-12 w-12 items-center justify-center rounded-xl bg-wine font-display text-base font-bold text-gold shadow-elegant">
                  {m.full_name ? getInitials(m.full_name) : "?"}
                </div>
                <div className="flex flex-col items-end gap-2">
                  <span className={`rounded-full px-2.5 py-0.5 text-[10px] font-bold uppercase tracking-wider ${papelColor(m.role)}`}>
                    {papelLabel(m.role)}
                  </span>
                  <DropdownMenu>
                    <DropdownMenuTrigger asChild>
                      <Button variant="ghost" size="sm" className="h-8 w-8 p-0 opacity-0 group-hover:opacity-100 transition-opacity">
                        <MoreVertical className="h-4 w-4" />
                      </Button>
                    </DropdownMenuTrigger>
                    <DropdownMenuContent align="end" className="bg-card border-border">
                      <DropdownMenuItem className="gap-2 cursor-pointer" onClick={() => { setSelectedMember(m); setIsSheetOpen(true); }}>
                        <Edit3 className="h-4 w-4" /> Editar Dados
                      </DropdownMenuItem>
                      <DropdownMenuItem className="gap-2 text-destructive cursor-pointer" onClick={() => handleDelete(m.id)}>
                        <Trash2 className="h-4 w-4" /> Remover Membro
                      </DropdownMenuItem>
                    </DropdownMenuContent>
                  </DropdownMenu>
                </div>
              </div>
              <h3 className="mt-4 font-display text-lg font-semibold">{m.full_name || "Sem nome"}</h3>
              <p className="text-[10px] uppercase font-bold tracking-widest text-muted-foreground mt-0.5">
                {m.status === 'active' ? '● Ativo' : '○ Inativo'}
              </p>
              
              <div className="mt-4 space-y-1.5 border-t border-border pt-4 text-xs text-muted-foreground">
                <div className="flex items-center gap-2 truncate">
                  <Mail className="h-3 w-3 shrink-0" />{m.email || "Sem e-mail"}
                </div>
                <div className="flex items-center gap-2">
                  <Phone className="h-3 w-3 shrink-0" />{m.phone || "Sem telefone"}
                </div>
              </div>
            </article>
          ))}
        </div>
      )}

      <StaffSheet 
        open={isSheetOpen} 
        onOpenChange={setIsSheetOpen} 
        onSuccess={fetchStaff}
        staffMember={selectedMember}
      />
    </div>
  );
};

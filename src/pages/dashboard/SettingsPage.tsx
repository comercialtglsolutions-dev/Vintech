import { useState, useEffect } from "react";
import { 
  Building2, 
  MessageSquare, 
  Key, 
  User, 
  Save, 
  Globe, 
  Instagram, 
  MapPin, 
  Wifi, 
  ShieldCheck,
  Loader2,
  CreditCard,
  Zap
} from "lucide-react";
import { useAuth } from "@/contexts/AuthContext";
import { supabase } from "@/lib/supabase";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { toast } from "sonner";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { useSearchParams } from "react-router-dom";
import { addMonths } from "date-fns";

import { usePlanLimits } from "@/hooks/usePlanLimits";

export default function SettingsPage() {
  const { profile, refreshProfile, loading: authLoading } = useAuth();
  const [searchParams, setSearchParams] = useSearchParams();
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [loadingPlan, setLoadingPlan] = useState<string | null>(null);
  const { data: planData, isLoading: isLoadingPlan, refetch: refetchPlan } = usePlanLimits();
  
  const [activeTab, setActiveTab] = useState(searchParams.get("tab") || (searchParams.get("success") ? "assinatura" : "geral"));
  const [showSuccessModal, setShowSuccessModal] = useState(searchParams.get("success") === "true");
  
  // States para os formulários
  const [wineryData, setWineryData] = useState<any>({
    name: "",
    address: "",
    city: "",
    state: "",
    instagram_url: "",
    website_url: "",
  });

  const [whatsappData, setWhatsappData] = useState<any>({
    whatsapp_instance_name: "",
    whatsapp_api_url: "",
    whatsapp_api_key: "",
  });

  const [templates, setTemplates] = useState<any>({
    welcome: "",
    booking_confirm: "",
    feedback_request: "",
  });

  useEffect(() => {
    if (profile?.winery_id) {
      fetchSettings();
    } else if (!authLoading) {
      // Auth resolveu sem vinícola: não deixa a tela presa em loading.
      setLoading(false);
    }
  }, [profile, authLoading]);

  const sessionId = searchParams.get("session_id");

  // Se o modal de sucesso foi acionado e temos um session_id, verificamos com o servidor
  useEffect(() => {
    if (showSuccessModal && sessionId && profile?.winery_id) {
      const verifySession = async () => {
        try {
          const res = await fetch(`${import.meta.env.VITE_API_URL}/api/checkout/verify-session`, {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ session_id: sessionId })
          });
          
          const data = await res.json();
          
          if (data.success) {
            // O Front-end agora é responsável por salvar as informações garantidamente no Supabase
            const { error } = await supabase
              .from('wineries')
              .update({
                stripe_price_id: data.priceId,
                stripe_subscription_id: data.subscriptionId,
                stripe_customer_id: data.customerId,
                plan_type: 'premium'
              })
              .eq('id', profile.winery_id);
              
            if (error) {
              console.error("Erro ao salvar o plano no banco:", error);
            } else {
              console.log("Plano salvo com sucesso no Supabase.");
            }
          }
          
          // Assim que salvo, recarregamos o estado local
          await refetchPlan();
        } catch (error) {
          console.error("Erro ao verificar sessão:", error);
        }
      };
      
      verifySession();
    } else if (showSuccessModal) {
      refetchPlan();
    }
  }, [showSuccessModal, sessionId, refetchPlan, profile?.winery_id]);

  const closeSuccessModal = () => {
    setShowSuccessModal(false);
    searchParams.delete("success");
    searchParams.delete("session_id");
    setSearchParams(searchParams);
  };

  const handleCheckout = async (priceId: string, planName: string) => {
    if (!profile?.id) return;
    
    setLoadingPlan(planName);
    try {
      const response = await fetch(`${import.meta.env.VITE_API_URL}/api/checkout/create-session`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ 
          priceId: priceId,
          userId: profile.id,
          wineryId: profile.winery_id,
          returnUrl: window.location.href.split('?')[0]
        }),
      });

      const data = await response.json();

      if (data.url) {
        window.location.href = data.url;
      } else {
        throw new Error(data.error || "Erro ao criar sessão");
      }
    } catch (error: any) {
      toast.error(error.message || "Erro ao processar pagamento");
      console.error(error);
    } finally {
      setLoadingPlan(null);
    }
  };

  const fetchSettings = async (silent = false) => {
    if (!silent) setLoading(true);
    try {
      const { data, error } = await supabase
        .from("wineries")
        .select("*")
        .eq("id", profile?.winery_id)
        .single();

      if (error) throw error;

      if (data) {
        setWineryData({
          name: data.name || "",
          address: data.address || "",
          city: data.city || "",
          state: data.state || "",
          instagram_url: data.instagram_url || "",
          website_url: data.website_url || "",
        });
        setWhatsappData({
          whatsapp_instance_name: data.whatsapp_instance_name || "",
          whatsapp_api_url: data.whatsapp_api_url || "",
          whatsapp_api_key: data.whatsapp_api_key || "",
        });
        setTemplates(data.message_templates || {
          welcome: "Olá {{name}}! Bem-vindo à {{winery}}.",
          booking_confirm: "Sua reserva para {{event}} em {{date}} está confirmada!",
          feedback_request: "Como foi sua experiência conosco? Adoraríamos seu feedback: {{link}}"
        });
      }
    } catch (error: any) {
      console.error("Erro fetch settings:", error);
    } finally {
      if (!silent) setLoading(false);
    }
  };

  const handleSave = async () => {
    console.log("Tentando salvar dados:", { ...wineryData, ...whatsappData });
    setSaving(true);
    try {
      const { data, error, status } = await supabase
        .from("wineries")
        .update({
          ...wineryData,
          ...whatsappData,
          message_templates: templates
        })
        .eq("id", profile?.winery_id)
        .select();

      console.log("Resposta do Supabase:", { data, error, status });

      if (error) throw error;
      
      toast.success("Configurações salvas com sucesso!");
      await fetchSettings(true); 
      refreshProfile();
    } catch (error: any) {
      console.error("Erro completo ao salvar:", error);
      toast.error("Erro ao salvar: " + error.message);
    } finally {
      setSaving(false);
    }
  };

  if (loading) {
    return (
      <div className="h-[80vh] flex flex-col items-center justify-center gap-4 text-muted-foreground">
        <Loader2 className="h-10 w-10 animate-spin text-wine" />
        <p className="font-display text-lg">Carregando painel de controle...</p>
      </div>
    );
  }

  return (
    <div className="space-y-6 max-w-5xl mx-auto pb-10">
      <div className="flex items-end justify-between">
        <div>
          <p className="text-xs font-semibold uppercase tracking-[0.2em] text-primary">Sistema</p>
          <h1 className="mt-2 font-display text-3xl font-bold tracking-tight md:text-4xl">Configurações</h1>
          <p className="mt-1 text-muted-foreground">Gerencie os dados da sua vinícola e integrações.</p>
        </div>
        {activeTab !== "assinatura" && (
          <Button onClick={handleSave} disabled={saving} className="bg-wine hover:bg-wine/90">
            {saving ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <Save className="mr-2 h-4 w-4" />}
            Salvar Alterações
          </Button>
        )}
      </div>

      <Tabs value={activeTab} onValueChange={setActiveTab} className="space-y-6">
        <TabsList className="bg-secondary/50 p-1 border border-border/50">
          <TabsTrigger value="geral" className="gap-2">
            <Building2 className="h-4 w-4" /> Geral
          </TabsTrigger>
          <TabsTrigger value="whatsapp" className="gap-2">
            <Wifi className="h-4 w-4" /> Integração WhatsApp
          </TabsTrigger>
          <TabsTrigger value="templates" className="gap-2">
            <MessageSquare className="h-4 w-4" /> Mensagens
          </TabsTrigger>
               <TabsTrigger value="conta" className="gap-2">
            <User className="h-4 w-4" /> Minha Conta
          </TabsTrigger>
          <TabsTrigger value="assinatura" className="gap-2">
            <CreditCard className="h-4 w-4" /> Assinatura
          </TabsTrigger>
     
        </TabsList>

        {/* --- ABA GERAL --- */}
        <TabsContent value="geral" className="space-y-4">
          <Card className="border-border/50 shadow-sm bg-card/50 backdrop-blur-sm">
            <CardHeader>
              <CardTitle className="text-xl">Dados da Vinícola</CardTitle>
              <CardDescription>Informações básicas que aparecem nos seus documentos e links.</CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="grid gap-4 md:grid-cols-2">
                <div className="space-y-2">
                  <Label htmlFor="name">Nome da Vinícola</Label>
                  <Input 
                    id="name" 
                    value={wineryData.name} 
                    onChange={(e) => setWineryData({...wineryData, name: e.target.value})}
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="website">Site Oficial</Label>
                  <div className="relative">
                    <Globe className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
                    <Input 
                      id="website" 
                      className="pl-10"
                      placeholder="https://suavinicola.com.br"
                      value={wineryData.website_url} 
                      onChange={(e) => setWineryData({...wineryData, website_url: e.target.value})}
                    />
                  </div>
                </div>
              </div>

              <div className="space-y-2">
                <Label htmlFor="address">Endereço Completo</Label>
                <div className="relative">
                  <MapPin className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
                  <Input 
                    id="address" 
                    className="pl-10"
                    placeholder="Rua, Número, Bairro"
                    value={wineryData.address} 
                    onChange={(e) => setWineryData({...wineryData, address: e.target.value})}
                  />
                </div>
              </div>

              <div className="grid gap-4 md:grid-cols-3">
                <div className="space-y-2 md:col-span-2">
                  <Label htmlFor="city">Cidade</Label>
                  <Input 
                    id="city" 
                    value={wineryData.city} 
                    onChange={(e) => setWineryData({...wineryData, city: e.target.value})}
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="state">Estado (UF)</Label>
                  <Input 
                    id="state" 
                    maxLength={2}
                    placeholder="RS"
                    value={wineryData.state} 
                    onChange={(e) => setWineryData({...wineryData, state: e.target.value.toUpperCase()})}
                  />
                </div>
              </div>

              <div className="space-y-2">
                <Label htmlFor="instagram">Instagram</Label>
                <div className="relative">
                  <Instagram className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
                  <Input 
                    id="instagram" 
                    className="pl-10"
                    placeholder="@suavinicola"
                    value={wineryData.instagram_url} 
                    onChange={(e) => setWineryData({...wineryData, instagram_url: e.target.value})}
                  />
                </div>
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        {/* --- ABA WHATSAPP --- */}
        <TabsContent value="whatsapp" className="space-y-4">
          <Card className="border-border/50 shadow-sm">
            <CardHeader>
              <CardTitle className="text-xl flex items-center gap-2">
                Evolution API <span className="text-[10px] bg-success/10 text-success px-2 py-0.5 rounded-full uppercase">Ativo</span>
              </CardTitle>
              <CardDescription>Configure a API de WhatsApp para disparar automações e feedbacks.</CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="bg-wine/5 border border-wine/20 rounded-lg py-2.5 px-4 flex items-center gap-3">
                <ShieldCheck className="h-4 w-4 text-wine shrink-0" />
                <div className="text-[11px] text-foreground/80 leading-none">
                  <strong className="text-wine mr-1">Importante:</strong> Estas chaves são confidenciais. Elas permitem que o sistema envie mensagens em seu nome. Não as compartilhe com ninguém fora da sua equipe de TI.
                </div>
              </div>

              <div className="space-y-2">
                <Label htmlFor="api_url">URL da API (Evolution)</Label>
                <Input 
                  id="api_url" 
                  placeholder="https://api.suaempresa.com.br"
                  value={whatsappData.whatsapp_api_url} 
                  onChange={(e) => setWhatsappData({...whatsappData, whatsapp_api_url: e.target.value})}
                />
              </div>

              <div className="grid gap-4 md:grid-cols-2">
                <div className="space-y-2">
                  <Label htmlFor="instance">Nome da Instância</Label>
                  <Input 
                    id="instance" 
                    placeholder="Vintech_Winery"
                    value={whatsappData.whatsapp_instance_name} 
                    onChange={(e) => setWhatsappData({...whatsappData, whatsapp_instance_name: e.target.value})}
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="api_key">API Key (Global)</Label>
                  <div className="relative">
                    <Key className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
                    <Input 
                      id="api_key" 
                      type="password"
                      className="pl-10"
                      value={whatsappData.whatsapp_api_key} 
                      onChange={(e) => setWhatsappData({...whatsappData, whatsapp_api_key: e.target.value})}
                    />
                  </div>
                </div>
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        {/* --- ABA TEMPLATES --- */}
        <TabsContent value="templates" className="space-y-4">
          <Card className="border-border/50 shadow-sm">
            <CardHeader>
              <CardTitle className="text-xl">Templates de Mensagens</CardTitle>
              <CardDescription>Personalize o texto das mensagens automáticas do sistema.</CardDescription>
            </CardHeader>
            <CardContent className="space-y-6">
              <div className="space-y-2">
                <Label className="flex justify-between">
                  <span>Mensagem de Boas-vindas</span>
                  <span className="text-[10px] text-muted-foreground">Variáveis: {"{{name}}, {{winery}}"}</span>
                </Label>
                <Textarea 
                  className="min-h-[100px]"
                  value={templates.welcome}
                  onChange={(e) => setTemplates({...templates, welcome: e.target.value})}
                />
              </div>

              <div className="space-y-2">
                <Label className="flex justify-between">
                  <span>Confirmação de Reserva</span>
                  <span className="text-[10px] text-muted-foreground">Variáveis: {"{{name}}, {{event}}, {{date}}"}</span>
                </Label>
                <Textarea 
                  className="min-h-[100px]"
                  value={templates.booking_confirm}
                  onChange={(e) => setTemplates({...templates, booking_confirm: e.target.value})}
                />
              </div>

              <div className="space-y-2">
                <Label className="flex justify-between">
                  <span>Pedido de Avaliação (Feedback)</span>
                  <span className="text-[10px] text-muted-foreground">Variáveis: {"{{name}}, {{link}}"}</span>
                </Label>
                <Textarea 
                  className="min-h-[100px]"
                  value={templates.feedback_request}
                  onChange={(e) => setTemplates({...templates, feedback_request: e.target.value})}
                />
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        {/* --- ABA ASSINATURA E PLANOS --- */}
        <TabsContent value="assinatura" className="space-y-6">
          <Card className="border-border/50 shadow-sm overflow-hidden">
            <div className="bg-wine p-6 text-primary-foreground relative overflow-hidden">
              <div className="absolute top-0 right-0 opacity-10 transform translate-x-1/3 -translate-y-1/3">
                <ShieldCheck className="w-48 h-48" />
              </div>
              <div className="relative z-10">
                <p className="text-gold text-xs font-bold tracking-[0.2em] uppercase mb-1">Status da Conta</p>
                <h2 className="font-display text-3xl font-bold">
                  {isLoadingPlan ? "Carregando..." : planData?.limits.name}
                </h2>
                <p className="opacity-80 text-sm mt-2">
                  {planData?.limits.isTrial ? "Expira em " : "Próxima renovação em "}
                  {
                    planData?.limits?.expiresAt 
                      ? new Date(planData.limits.expiresAt).toLocaleDateString('pt-BR', { day: 'numeric', month: 'long', year: 'numeric' })
                      : new Date(new Date().setMonth(new Date().getMonth() + 1)).toLocaleDateString('pt-BR', { day: 'numeric', month: 'long', year: 'numeric' })
                  }.
                </p>
              </div>
            </div>
            
            <CardContent className="p-6">
              <h3 className="font-semibold mb-6 text-lg flex items-center gap-2">
                <CreditCard className="w-5 h-5 text-primary" />
                Seu consumo este mês
              </h3>
              
              {isLoadingPlan ? (
                <div className="flex items-center justify-center py-6">
                  <Loader2 className="w-8 h-8 animate-spin text-primary" />
                </div>
              ) : (
                <div className="grid md:grid-cols-2 gap-8">
                  {/* Barra de Pedidos */}
                  <div className="bg-muted/30 p-4 rounded-xl border border-border/50">
                    <div className="flex justify-between text-sm mb-3">
                      <span className="font-medium text-foreground">Pedidos Registrados</span>
                      <span className="text-muted-foreground font-mono">
                        {planData?.usage.ordersThisMonth} / {planData?.limits.maxOrders === 999999 ? "∞" : planData?.limits.maxOrders}
                        <span className="text-[10px] uppercase ml-1">
                          ({planData?.limits.maxOrders === 999999 ? "0" : Math.round(((planData?.usage.ordersThisMonth || 0) / (planData?.limits.maxOrders || 1)) * 100)}%)
                        </span>
                      </span>
                    </div>
                    <div className="h-2.5 w-full bg-secondary rounded-full overflow-hidden">
                      <div 
                        className="h-full bg-primary rounded-full transition-all duration-1000" 
                        style={{ width: `${planData?.limits.maxOrders === 999999 ? 0 : Math.min(100, ((planData?.usage.ordersThisMonth || 0) / (planData?.limits.maxOrders || 1)) * 100)}%` }}
                      ></div>
                    </div>
                    <p className="text-xs text-muted-foreground mt-3">
                      Sua capacidade é de {planData?.limits.maxOrders === 999999 ? "pedidos ilimitados" : `${planData?.limits.maxOrders} pedidos por mês`}.
                    </p>
                  </div>

                  {/* Barra de Equipe */}
                  <div className="bg-muted/30 p-4 rounded-xl border border-border/50">
                    <div className="flex justify-between text-sm mb-3">
                      <span className="font-medium text-foreground">Membros da Equipe</span>
                      <span className="text-muted-foreground font-mono">
                        {planData?.usage.teamMembers} / {planData?.limits.maxUsers === 999999 ? "∞" : planData?.limits.maxUsers}
                        <span className="text-[10px] uppercase ml-1">
                          ({planData?.limits.maxUsers === 999999 ? "0" : Math.round(((planData?.usage.teamMembers || 0) / (planData?.limits.maxUsers || 1)) * 100)}%)
                        </span>
                      </span>
                    </div>
                    <div className="h-2.5 w-full bg-secondary rounded-full overflow-hidden">
                      <div 
                        className="h-full bg-gold rounded-full transition-all duration-1000" 
                        style={{ width: `${planData?.limits.maxUsers === 999999 ? 0 : Math.min(100, ((planData?.usage.teamMembers || 0) / (planData?.limits.maxUsers || 1)) * 100)}%` }}
                      ></div>
                    </div>
                    <p className="text-xs text-muted-foreground mt-3">
                      Você tem {planData?.limits.maxUsers === 999999 ? "vagas ilimitadas" : `mais ${(planData?.limits.maxUsers || 0) - (planData?.usage.teamMembers || 0)} vagas`} para equipe neste plano.
                    </p>
                  </div>
                </div>
              )}
            </CardContent>
          </Card>

          <div className="mt-10">
            <h3 className="font-display text-2xl font-bold mb-1">Evolua sua Vinícola</h3>
            <p className="text-sm text-muted-foreground mb-6">Desbloqueie limites maiores e ferramentas premium para escalar suas vendas.</p>
            
            <div className="grid md:grid-cols-3 gap-6">
              
              {/* Viticultura */}
              <Card className={`border-border bg-background transition-colors ${planData?.limits.name === "Viticultura" ? "opacity-60 grayscale-[50%]" : ""}`}>
                <CardContent className="p-6">
                  <div className="text-[10px] font-bold uppercase tracking-wider text-muted-foreground mb-2">Básico</div>
                  <h4 className="font-display text-xl font-bold">Viticultura</h4>
                  <div className="my-4 text-3xl font-bold">R$ 129<span className="text-sm text-muted-foreground font-normal">/mês</span></div>
                  <ul className="text-sm space-y-2 text-muted-foreground mb-8">
                    <li className="flex items-center gap-2"><div className="w-1.5 h-1.5 rounded-full bg-primary"></div> Até 3 membros</li>
                    <li className="flex items-center gap-2"><div className="w-1.5 h-1.5 rounded-full bg-primary"></div> 500 pedidos/mês</li>
                    <li className="flex items-center gap-2"><div className="w-1.5 h-1.5 rounded-full bg-primary"></div> Acesso a tudo</li>
                  </ul>
                  {(!planData?.limits.isTrial && planData?.limits.name === "Viticultura") ? (
                    <Button variant="outline" className="w-full" disabled>Seu Plano Atual</Button>
                  ) : (
                    <Button
                      variant="outline"
                      className="w-full"
                      onClick={() => handleCheckout(import.meta.env.VITE_STRIPE_PRICE_VINHEDO, "Viticultura")}
                      disabled={loadingPlan === "Viticultura"}
                    >
                      {loadingPlan === "Viticultura" && <Loader2 className="w-4 h-4 mr-2 animate-spin" />}
                      Contratar Plano
                    </Button>
                  )}
                </CardContent>
              </Card>

              {/* Business */}
              <Card className={`border-gold bg-wine text-white shadow-elegant relative overflow-hidden transform md:-translate-y-2 transition-transform ${planData?.limits.name === "Business" ? "" : "hover:scale-[1.02]"}`}>
                <div className="absolute top-0 right-0 bg-gold text-wine text-[10px] font-bold uppercase px-3 py-1 rounded-bl-lg">
                  Mais Escolhido
                </div>
                <CardContent className="p-6">
                  <div className="text-[10px] font-bold uppercase tracking-wider text-gold mb-2">Popular</div>
                  <h4 className="font-display text-xl font-bold text-gold">Business</h4>
                  <div className="my-4 text-3xl font-bold text-white">R$ 349<span className="text-sm text-white/60 font-normal">/mês</span></div>
                  <ul className="text-sm space-y-2 text-white/85 mb-8">
                    <li className="flex items-center gap-2"><div className="w-1.5 h-1.5 rounded-full bg-gold"></div> Até 7 membros</li>
                    <li className="flex items-center gap-2"><div className="w-1.5 h-1.5 rounded-full bg-gold"></div> 1.000 pedidos/mês</li>
                    <li className="flex items-center gap-2"><div className="w-1.5 h-1.5 rounded-full bg-gold"></div> Clube de Assinatura</li>
                  </ul>
                  {(!planData?.limits.isTrial && planData?.limits.name === "Business") ? (
                    <Button variant="outline" className="w-full bg-white/10 text-white border-white/20 hover:bg-white/20" disabled>Seu Plano Atual</Button>
                  ) : (
                    <Button
                      className="w-full bg-gold text-wine hover:bg-gold/90 font-bold shadow-lg"
                      onClick={() => handleCheckout(import.meta.env.VITE_STRIPE_PRICE_RESERVA, "Business")}
                      disabled={loadingPlan === "Business"}
                    >
                      {loadingPlan === "Business" ? <Loader2 className="w-4 h-4 mr-2 animate-spin" /> : <Zap className="w-4 h-4 mr-2" />}
                      Contratar Plano
                    </Button>
                  )}
                </CardContent>
              </Card>

              {/* Sommelier */}
              <Card className={`border-border bg-card transition-colors ${planData?.limits.name === "Sommelier" ? "" : "hover:border-primary/30"}`}>
                <CardContent className="p-6">
                  <div className="text-[10px] font-bold uppercase tracking-wider text-muted-foreground mb-2">Premium</div>
                  <h4 className="font-display text-xl font-bold">Sommelier</h4>
                  <div className="my-4 text-3xl font-bold">R$ 849<span className="text-sm text-muted-foreground font-normal">/mês</span></div>
                  <ul className="text-sm space-y-2 text-foreground/80 mb-8">
                    <li className="flex items-center gap-2"><div className="w-1.5 h-1.5 rounded-full bg-primary/50"></div> Equipe ilimitada</li>
                    <li className="flex items-center gap-2"><div className="w-1.5 h-1.5 rounded-full bg-primary/50"></div> Pedidos ilimitados</li>
                    <li className="flex items-center gap-2"><div className="w-1.5 h-1.5 rounded-full bg-primary/50"></div> API customizada</li>
                  </ul>
                  {(!planData?.limits.isTrial && planData?.limits.name === "Sommelier") ? (
                    <Button variant="outline" className="w-full" disabled>Seu Plano Atual</Button>
                  ) : (
                    <Button
                      variant="outline"
                      className="w-full hover:bg-primary/5 hover:text-primary border-primary/20"
                      onClick={() => handleCheckout(import.meta.env.VITE_STRIPE_PRICE_GRAND_CRU, "Sommelier")}
                      disabled={loadingPlan === "Sommelier"}
                    >
                      {loadingPlan === "Sommelier" && <Loader2 className="w-4 h-4 mr-2 animate-spin" />}
                      Contratar Plano
                    </Button>
                  )}
                </CardContent>
              </Card>

            </div>
          </div>

        </TabsContent>

        {/* --- ABA CONTA --- */}
        <TabsContent value="conta" className="space-y-4">
          <Card className="border-border/50 shadow-sm">
            <CardHeader>
              <CardTitle className="text-xl">Meus Dados</CardTitle>
              <CardDescription>Informações do seu perfil de acesso.</CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="flex items-center gap-6 pb-6">
                <div className="h-20 w-20 rounded-full bg-wine/10 flex items-center justify-center text-wine text-2xl font-bold border border-wine/20 overflow-hidden">
                  {profile?.avatar_url ? (
                    <img src={profile.avatar_url} alt={profile.full_name || ""} className="h-full w-full object-cover" />
                  ) : (
                    profile?.full_name?.charAt(0) || "U"
                  )}
                </div>
                <div>
                  <h3 className="font-display text-lg font-bold">{profile?.full_name}</h3>
                  <p className="text-sm text-muted-foreground uppercase tracking-wider">{profile?.role} · {profile?.email}</p>
                </div>
              </div>
              
              <div className="grid gap-4 md:grid-cols-2">
                <div className="space-y-2">
                  <Label>Nome Completo</Label>
                  <Input disabled value={profile?.full_name || ""} />
                </div>
                <div className="space-y-2">
                  <Label>E-mail de Acesso</Label>
                  <Input disabled value={profile?.email || ""} />
                </div>
              </div>
              <p className="text-[10px] text-muted-foreground italic">* Para alterar dados do perfil ou senha, entre em contato com o suporte de TI.</p>
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>

      {/* MODAL DE SUCESSO (OVERLAY) */}
      {showSuccessModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-background/80 backdrop-blur-sm animate-in fade-in duration-300">
          <div className="bg-card border border-border shadow-2xl rounded-2xl p-8 max-w-md w-full relative animate-in zoom-in-95 duration-300">
            <div className="w-16 h-16 bg-green-100 rounded-full flex items-center justify-center mx-auto mb-6 shadow-inner">
              <ShieldCheck className="w-8 h-8 text-green-600" />
            </div>
            <h2 className="text-2xl font-display font-bold text-center mb-2 text-foreground">Pagamento Confirmado!</h2>
            <p className="text-center text-muted-foreground mb-8">
              Parabéns! Seu novo plano Vintech foi ativado com sucesso. Os novos limites já estão desbloqueados na sua conta.
            </p>
            <Button onClick={closeSuccessModal} className="w-full bg-gold text-wine hover:bg-gold/90 font-bold py-6 text-lg">
              Acessar sistema
            </Button>
          </div>
        </div>
      )}
    </div>
  );
}

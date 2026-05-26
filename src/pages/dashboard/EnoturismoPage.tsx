import { Calendar as CalendarIcon, MapPin, Users, Plus, Star, Loader2, Ticket, Settings2, Edit2, Trash2, ChevronRight } from "lucide-react";
import { Button } from "@/components/ui/button";
import { KpiCard } from "@/components/dashboard/KpiCard";
import { useState, useEffect } from "react";
import { Calendar } from "@/components/ui/calendar";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";
import { BookingSheet } from "@/components/dashboard/BookingSheet";
import { EventSheet } from "@/components/dashboard/EventSheet";
import { EventDetailsDialog } from "@/components/dashboard/EventDetailsDialog";
import { ReviewsDialog } from "@/components/dashboard/ReviewsDialog";
import { supabase } from "@/lib/supabase";
import { useAuth } from "@/contexts/AuthContext";
import { format } from "date-fns";
import { ptBR } from "date-fns/locale";
import { cn } from "@/lib/utils";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { toast } from "sonner";

interface Booking {
  id: string;
  customer_name: string;
  participants: number;
  total_price: number;
  created_at: string;
  status: string;
  event: {
    title: string;
    date: string;
  };
}

interface EventData {
  id: string;
  title: string;
  description: string | null;
  date: string;
  capacity: number;
  booked_slots: number;
  price: number;
  status: string;
}

export const EnoturismoPage = () => {
  const { profile, loading: authLoading } = useAuth();
  const [date, setDate] = useState<Date | undefined>(new Date());
  const [isBookingSheetOpen, setIsBookingSheetOpen] = useState(false);
  const [isEventSheetOpen, setIsEventSheetOpen] = useState(false);
  const [isDetailsDialogOpen, setIsDetailsDialogOpen] = useState(false);
  const [selectedEventDetail, setSelectedEventDetail] = useState<EventData | null>(null);
  const [editingEvent, setEditingEvent] = useState<EventData | null>(null);
  
  const [bookings, setBookings] = useState<Booking[]>([]);
  const [events, setEvents] = useState<EventData[]>([]);
  const [reviews, setReviews] = useState<any[]>([]);
  const [averageRating, setAverageRating] = useState(0);
  const [reviewsCount, setReviewsCount] = useState(0);
  const [isReviewsDialogOpen, setIsReviewsDialogOpen] = useState(false);
  const [loading, setLoading] = useState(true);
  const [activeTab, setActiveTab] = useState("agenda");

  const fetchData = async () => {
    if (!profile?.winery_id) {
      if (!authLoading) setLoading(false);
      return;
    }

    try {
      setLoading(true);
      
      // Fetch Bookings
      const { data: bookingsData, error: bookingsError } = await supabase
        .from("bookings")
        .select(`
          id, event_id, customer_name, customer_email, customer_phone, customer_cpf, customer_origin, participants, total_price, created_at, status,
          event:events (title, date)
        `)
        .eq("winery_id", profile.winery_id)
        .order("created_at", { ascending: false });

      if (bookingsError) throw bookingsError;
      setBookings(bookingsData as any || []);

      // Fetch Events
      const { data: eventsData, error: eventsError } = await supabase
        .from("events")
        .select("*")
        .eq("winery_id", profile.winery_id)
        .order("date", { ascending: true });

      if (eventsError) throw eventsError;
      setEvents(eventsData || []);

      // Fetch Reviews for average and details
      const { data: reviewsData } = await supabase
        .from("reviews")
        .select(`
          *,
          booking:bookings (
            customer_name,
            event:events (title)
          )
        `)
        .eq("winery_id", profile.winery_id)
        .order("created_at", { ascending: false });
      
      if (reviewsData && reviewsData.length > 0) {
        setReviews(reviewsData);
        const avg = reviewsData.reduce((acc, r) => acc + r.rating, 0) / reviewsData.length;
        setAverageRating(avg);
        setReviewsCount(reviewsData.length);
      }

      // Update selected event detail if it's open to refresh participants
      if (isDetailsDialogOpen && selectedEventDetail) {
        const updated = eventsData?.find(e => e.id === selectedEventDetail.id);
        if (updated) setSelectedEventDetail(updated);
      }

    } catch (error: any) {
      console.error("Erro ao carregar dados:", error.message);
      toast.error("Erro ao sincronizar dados.");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchData();
  }, [profile?.winery_id, authLoading]);

  const handleOpenDetails = (e: EventData) => {
    setSelectedEventDetail(e);
    setIsDetailsDialogOpen(true);
  };

  const handleDeleteEvent = async (id: string) => {
    if (!confirm("Tem certeza que deseja excluir esta experiência?")) return;
    try {
      const { error } = await supabase.from("events").delete().eq("id", id);
      if (error) throw error;
      toast.success("Experiência excluída!");
      fetchData();
    } catch (error: any) {
      toast.error("Erro ao excluir: " + error.message);
    }
  };

  const totalVisitors = bookings.reduce((acc, b) => acc + b.participants, 0);
  const totalRevenue = bookings.reduce((acc, b) => acc + Number(b.total_price), 0);

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <p className="text-xs font-semibold uppercase tracking-[0.2em] text-primary">Operação</p>
          <h1 className="mt-2 font-display text-3xl font-bold tracking-tight md:text-4xl">Enoturismo</h1>
          <p className="mt-1 text-muted-foreground">Gerencie agendamentos e catálogo de experiências.</p>
        </div>
        <div className="flex gap-2">
          <Popover>
            <PopoverTrigger asChild>
              <Button
                variant={"outline"}
                className={cn(
                  "w-[240px] justify-start text-left font-normal",
                  !date && "text-muted-foreground"
                )}
              >
                <CalendarIcon className="mr-2 h-4 w-4" />
                {date ? format(date, "PPP", { locale: ptBR }) : <span>Selecione uma data</span>}
              </Button>
            </PopoverTrigger>
            <PopoverContent className="w-auto p-0 bg-card border-border shadow-elegant" align="end">
              <Calendar
                mode="single"
                selected={date}
                onSelect={setDate}
                initialFocus
                captionLayout="dropdown-buttons"
                fromYear={2020}
                toYear={2030}
                locale={ptBR}
              />
            </PopoverContent>
          </Popover>
          <Button variant="hero" onClick={() => setIsBookingSheetOpen(true)}>
            <Plus /> Novo agendamento
          </Button>
        </div>
      </div>

      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
        <KpiCard label="Visitantes (Total)" value={totalVisitors.toString()} icon={Users} variant="wine" />
        <KpiCard label="Receita enoturismo" value={totalRevenue.toLocaleString("pt-BR", { style: "currency", currency: "BRL" })} icon={MapPin} />
        <KpiCard label="Experiências Ativas" value={events.filter(e => e.status === "active").length.toString()} icon={Ticket} />
        <div onClick={() => setIsReviewsDialogOpen(true)} className="cursor-pointer transition-transform hover:scale-[1.02] active:scale-[0.98]">
          <KpiCard 
            label="Avaliação média" 
            value={reviewsCount > 0 ? `${averageRating.toFixed(1)} ★` : "---"} 
            icon={Star} 
            hint={reviewsCount > 0 ? `${reviewsCount} avaliações reais` : "Sem avaliações"} 
          />
        </div>
      </div>

      <Tabs value={activeTab} onValueChange={setActiveTab} className="w-full">
        <TabsList className="bg-card border border-border mb-6">
          <TabsTrigger value="agenda" className="px-8">Agenda & Reservas</TabsTrigger>
          <TabsTrigger value="experiencias" className="px-8">Gerenciar Experiências</TabsTrigger>
        </TabsList>

        <TabsContent value="agenda" className="space-y-6">
          <div className="grid gap-6 lg:grid-cols-3">
            <div className="rounded-2xl border border-border bg-card shadow-card lg:col-span-2">
              <div className="border-b border-border p-6 flex justify-between items-center">
                <h3 className="font-display text-lg font-semibold">Agenda de Sessões</h3>
                <span className="text-xs text-muted-foreground">{events.length} sessões encontradas</span>
              </div>
              <div className="divide-y divide-border min-h-[400px]">
                {loading ? (
                  <div className="flex flex-col items-center justify-center py-24 gap-3 text-muted-foreground">
                    <Loader2 className="h-8 w-8 animate-spin text-gold" />
                    <p>Carregando agenda...</p>
                  </div>
                ) : events.length === 0 ? (
                  <div className="flex flex-col items-center justify-center py-24 gap-4 text-center">
                    <div className="flex h-16 w-16 items-center justify-center rounded-full bg-muted">
                      <CalendarIcon className="h-8 w-8 text-muted-foreground" />
                    </div>
                    <div>
                      <h3 className="text-lg font-semibold">Nenhuma sessão programada</h3>
                      <p className="text-sm text-muted-foreground max-w-xs mx-auto">
                        Crie uma experiência no catálogo para começar a receber agendamentos.
                      </p>
                    </div>
                  </div>
                ) : (
                  events.map((e) => {
                    const eventBookings = bookings.filter(b => (b as any).event_id === e.id);
                    
                    return (
                      <div key={e.id} className="transition-all">
                        <div 
                          onClick={() => handleOpenDetails(e)}
                          className="flex flex-wrap items-center gap-4 p-6 cursor-pointer transition-colors hover:bg-secondary/40 group"
                        >
                          <div className="w-20 shrink-0">
                            <div className="text-[10px] uppercase tracking-wider text-muted-foreground">
                              {format(new Date(e.date), "dd MMM", { locale: ptBR })}
                            </div>
                            <div className="font-display text-lg font-bold">
                              {format(new Date(e.date), "HH:mm")}
                            </div>
                          </div>
                          <div className="min-w-0 flex-1">
                            <div className="flex items-center gap-2">
                              <span className={cn(
                                "rounded-full px-2 py-0.5 text-[10px] font-medium uppercase tracking-wider",
                                e.status === "active" ? "bg-success/10 text-success" : 
                                e.status === "completed" ? "bg-gold/10 text-gold border border-gold/20" : 
                                "bg-muted text-muted-foreground"
                              )}>
                                {e.status === "active" ? "Ativo" : 
                                 e.status === "completed" ? "Concluído" : 
                                 "Pendente"}
                              </span>
                            </div>
                            <div className="mt-1 font-medium">{e.title}</div>
                            <div className="mt-0.5 text-xs text-muted-foreground flex items-center gap-1">
                              <Users className="h-3 w-3" /> {e.booked_slots} / {e.capacity} pessoas · {eventBookings.length} reservas
                            </div>
                          </div>
                          <div className="flex items-center gap-4">
                            <div className="text-right hidden sm:block">
                              <div className="text-sm font-bold text-wine">
                                {(eventBookings.reduce((acc, b) => acc + Number(b.total_price), 0)).toLocaleString("pt-BR", { style: "currency", currency: "BRL" })}
                              </div>
                              <div className="text-[10px] uppercase text-muted-foreground">Receita total</div>
                            </div>
                            <div className="flex h-8 w-8 items-center justify-center rounded-full bg-secondary/50 text-muted-foreground opacity-0 group-hover:opacity-100 transition-opacity">
                              <ChevronRight className="h-4 w-4" />
                            </div>
                          </div>
                        </div>
                      </div>
                    );
                  })
                )}
              </div>
            </div>

            <div className="space-y-6">
              <div className="overflow-hidden rounded-2xl border border-border bg-wine p-6 text-primary-foreground relative group">
                <div className="absolute top-0 right-0 p-4 opacity-10 group-hover:opacity-20 transition-opacity">
                  <Star className="h-20 w-20" />
                </div>
                <p className="text-xs font-semibold uppercase tracking-wider text-gold">Destaque da Agenda</p>
                {(() => {
                  const nextActive = events.find(e => e.status !== "completed" && new Date(e.date) >= new Date()) || 
                                   events.find(e => e.status !== "completed");
                  
                  if (!nextActive) {
                    return (
                      <>
                        <h3 className="mt-2 font-display text-2xl font-bold text-white/50">Tudo em dia!</h3>
                        <p className="mt-2 text-sm text-primary-foreground/75 italic">Nenhuma sessão pendente para os próximos dias.</p>
                        <Button variant="hero" size="sm" className="mt-4" onClick={() => setIsEventSheetOpen(true)}>
                          Criar Experiência
                        </Button>
                      </>
                    );
                  }

                  return (
                    <>
                      <h3 className="mt-2 font-display text-2xl font-bold">{nextActive.title}</h3>
                      <p className="mt-2 text-sm text-primary-foreground/75 uppercase tracking-tight font-medium">
                        {format(new Date(nextActive.date), "eeee, dd 'de' MMMM", { locale: ptBR })} às {format(new Date(nextActive.date), "HH:mm")}
                      </p>
                      <p className="mt-1 text-xs text-gold/90 font-medium italic">
                        Ocupação: {nextActive.booked_slots} / {nextActive.capacity} vagas preenchidas
                      </p>
                      <Button 
                        variant="hero" 
                        size="sm" 
                        className="mt-6 shadow-lg bg-gold text-wine hover:bg-gold/90" 
                        onClick={() => handleOpenDetails(nextActive)}
                      >
                        Gerenciar evento
                      </Button>
                    </>
                  );
                })()}
              </div>

              <div className="rounded-2xl border border-border bg-card p-6 shadow-card">
                <h3 className="font-display text-lg font-semibold">Origem dos visitantes</h3>
                <div className="mt-4 space-y-3">
                  {(() => {
                    const total = bookings.length || 1;
                    const counts: Record<string, number> = {};
                    bookings.forEach(b => {
                      const origin = (b as any).customer_origin || "Outros";
                      counts[origin] = (counts[origin] || 0) + 1;
                    });
                    
                    return Object.entries(counts)
                      .sort((a, b) => b[1] - a[1])
                      .slice(0, 5)
                      .map(([label, count]) => {
                        const percentage = Math.round((count / total) * 100);
                        return (
                          <div key={label}>
                            <div className="flex justify-between text-xs">
                              <span className="text-muted-foreground">{label}</span>
                              <span className="font-semibold">{percentage}%</span>
                            </div>
                            <div className="mt-1 h-1.5 w-full rounded-full bg-secondary">
                              <div className="h-full rounded-full bg-gold-gradient" style={{ width: `${percentage}%` }} />
                            </div>
                          </div>
                        );
                      });
                  })()}
                  {bookings.length === 0 && (
                    <p className="text-xs text-muted-foreground italic">Nenhum dado de origem disponível.</p>
                  )}
                </div>
              </div>
            </div>
          </div>
        </TabsContent>

        <TabsContent value="experiencias">
          <div className="rounded-2xl border border-border bg-card shadow-card">
            <div className="border-b border-border p-6 flex flex-wrap items-center justify-between gap-4">
              <div>
                <h3 className="font-display text-lg font-semibold text-primary">Catálogo de Ofertas</h3>
                <p className="text-sm text-muted-foreground">Gerencie seus tours, degustações e workshops.</p>
              </div>
              <Button onClick={() => { setEditingEvent(null); setIsEventSheetOpen(true); }} className="bg-primary text-primary-foreground">
                <Plus className="mr-2 h-4 w-4" /> Adicionar Experiência
              </Button>
            </div>
            
            <div className="p-6">
              <div className="grid gap-6 md:grid-cols-2 lg:grid-cols-3">
                {events.map((e) => (
                  <div key={e.id} className="relative flex flex-col rounded-xl border border-border/50 bg-background/50 p-5 transition-all hover:shadow-lg hover:border-primary/20">
                    <div className="flex justify-between items-start mb-4">
                      <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-wine/10 text-wine">
                        <Settings2 className="h-5 w-5" />
                      </div>
                      <div className="flex gap-2">
                        <Button variant="ghost" size="icon" className="h-8 w-8 text-muted-foreground" onClick={() => { setEditingEvent(e); setIsEventSheetOpen(true); }}>
                          <Edit2 className="h-4 w-4" />
                        </Button>
                        <Button variant="ghost" size="icon" className="h-8 w-8 text-destructive/70" onClick={() => handleDeleteEvent(e.id)}>
                          <Trash2 className="h-4 w-4" />
                        </Button>
                      </div>
                    </div>
                    <h4 className="font-display text-lg font-bold">{e.title}</h4>
                    <p className="mt-1 text-xs text-muted-foreground line-clamp-2 min-h-[32px]">
                      {e.description || "Sem descrição informada."}
                    </p>
                    
                    <div className="mt-4 grid grid-cols-2 gap-3 border-t border-border pt-4">
                      <div>
                        <p className="text-[10px] uppercase text-muted-foreground">Valor por pessoa</p>
                        <p className="text-sm font-bold text-wine">R$ {Number(e.price).toFixed(2)}</p>
                      </div>
                      <div>
                        <p className="text-[10px] uppercase text-muted-foreground">Ocupação</p>
                        <p className="text-sm font-bold">{e.booked_slots} / {e.capacity}</p>
                      </div>
                    </div>
                    
                    <div className="mt-4 flex items-center justify-between">
                      <span className={cn(
                        "rounded-full px-2 py-0.5 text-[10px] font-medium uppercase tracking-wider",
                        e.status === "active" ? "bg-success/10 text-success" : 
                        e.status === "completed" ? "bg-gold/10 text-gold border border-gold/20" : 
                        "bg-muted text-muted-foreground"
                      )}>
                        {e.status === "active" ? "Ativo" : 
                         e.status === "completed" ? "Concluída" : 
                         "Inativo"}
                      </span>
                      <span className="text-[10px] text-muted-foreground">
                        {format(new Date(e.date), "dd/MM/yyyy HH:mm")}
                      </span>
                    </div>
                  </div>
                ))}
                
                {events.length === 0 && !loading && (
                  <div className="col-span-full flex flex-col items-center justify-center py-20 border-2 border-dashed border-border rounded-xl text-muted-foreground">
                    <Plus className="h-10 w-10 mb-2 opacity-20" />
                    <p>Nenhuma experiência cadastrada.</p>
                  </div>
                )}
              </div>
            </div>
          </div>
        </TabsContent>
      </Tabs>

      <BookingSheet 
        open={isBookingSheetOpen} 
        onOpenChange={setIsBookingSheetOpen} 
        onSuccess={fetchData} 
      />
      
      <EventSheet
        open={isEventSheetOpen}
        onOpenChange={setIsEventSheetOpen}
        onSuccess={fetchData}
        event={editingEvent}
      />

      <EventDetailsDialog
        open={isDetailsDialogOpen}
        onOpenChange={setIsDetailsDialogOpen}
        event={selectedEventDetail}
        bookings={bookings.filter(b => (b as any).event_id === selectedEventDetail?.id)}
        onAddParticipant={() => { 
          setIsDetailsDialogOpen(false); 
          setIsBookingSheetOpen(true); 
        }}
        onEditEvent={() => { 
          setIsDetailsDialogOpen(false); 
          setEditingEvent(selectedEventDetail); 
          setIsEventSheetOpen(true); 
        }}
        onRefresh={fetchData}
      />

      <ReviewsDialog
        open={isReviewsDialogOpen}
        onOpenChange={setIsReviewsDialogOpen}
        reviews={reviews}
        averageRating={averageRating}
      />
    </div>
  );
};

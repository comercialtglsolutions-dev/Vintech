import { useState, useEffect } from "react";
import { Wine, Plus, Search, Filter, MoreHorizontal, Loader2, Edit2, Archive, Trash2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { ProductSheet } from "@/components/dashboard/ProductSheet";
import { supabase } from "@/lib/supabase";
import { useAuth } from "@/contexts/AuthContext";
import { toast } from "sonner";
import bottlesImg from "@/assets/bottles.jpg";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { VisuallyHidden } from "@radix-ui/react-visually-hidden";

interface Product {
  id: string;
  name: string;
  variety: string | null;
  vintage: string | null;
  price: number;
  stock_quantity: number;
  image_url: string | null;
  category: string;
  sku: string | null;
  status: string;
}

const statusColor = (stock: number, status: string) => {
  if (status === "active") return "bg-success/10 text-success";
  return "bg-secondary text-secondary-foreground opacity-70";
};

const getStatusLabel = (stock: number, status: string) => {
  if (status === "active") return "Ativo";
  return "Desativado";
};

export const ProductsPage = () => {
  const { profile, loading: authLoading } = useAuth();
  const [isSheetOpen, setIsSheetOpen] = useState(false);
  const [editingProduct, setEditingProduct] = useState<Product | null>(null);
  const [productToDelete, setProductToDelete] = useState<string | null>(null);
  const [selectedImage, setSelectedImage] = useState<string | null>(null);
  const [products, setProducts] = useState<Product[]>([]);
  const [loading, setLoading] = useState(true);
  const [activeTab, setActiveTab] = useState("active");

  const fetchProducts = async () => {
    if (!profile?.winery_id) {
      // Auth já resolveu e ainda não há vinícola: encerra o loading para não
      // travar a tela em spinner infinito.
      if (!authLoading) setLoading(false);
      return;
    }

    try {
      setLoading(true);
      let query = supabase
        .from("products")
        .select("*")
        .eq("winery_id", profile.winery_id);

      if (activeTab === "active") {
        query = query.neq("status", "archived");
      } else {
        query = query.eq("status", "archived");
      }

      const { data, error } = await query.order("created_at", { ascending: false });

      if (error) throw error;
      setProducts(data || []);
    } catch (error: any) {
      console.error("Erro ao carregar produtos:", error.message);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchProducts();
  }, [profile?.winery_id, activeTab, authLoading]);

  const handleEdit = (product: Product) => {
    setEditingProduct(product);
    setIsSheetOpen(true);
  };

  const handleArchive = async (id: string, currentStatus: string) => {
    const newStatus = currentStatus === "archived" ? "active" : "archived";
    try {
      const { error } = await supabase
        .from("products")
        .update({ status: newStatus })
        .eq("id", id);
      
      if (error) throw error;
      toast.success(newStatus === "active" ? "Produto desarquivado!" : "Produto arquivado!");
      fetchProducts();
    } catch (error: any) {
      toast.error("Erro ao alterar status de arquivamento: " + error.message);
    }
  };

  const handleToggleStatus = async (product: Product) => {
    const newStatus = product.status === "inactive" ? "active" : "inactive";
    try {
      const { error } = await supabase
        .from("products")
        .update({ status: newStatus })
        .eq("id", product.id);
      
      if (error) throw error;
      toast.success(newStatus === "active" ? "Produto ativado!" : "Produto desativado!");
      fetchProducts();
    } catch (error: any) {
      toast.error("Erro ao alterar status: " + error.message);
    }
  };

  const handleDelete = async () => {
    if (!productToDelete) return;
    try {
      const { error } = await supabase
        .from("products")
        .delete()
        .eq("id", productToDelete);
      
      if (error) throw error;
      toast.success("Produto excluído permanentemente!");
      fetchProducts();
    } catch (error: any) {
      toast.error("Erro ao excluir: " + error.message);
    } finally {
      setProductToDelete(null);
    }
  };

  const totalStock = products.reduce((acc, p) => acc + p.stock_quantity, 0);
  const totalValue = products.reduce((acc, p) => acc + (p.price * p.stock_quantity), 0);

  return (
    <div className="space-y-6">
      <div className="overflow-hidden rounded-2xl border border-border bg-wine">
        <div className="relative grid gap-4 p-8 md:grid-cols-[1fr_auto] md:items-center">
          <img src={bottlesImg} alt="" className="absolute inset-0 h-full w-full object-cover opacity-15" loading="lazy" />
          <div className="absolute inset-0 bg-gradient-to-r from-primary-deep via-primary-deep/90 to-transparent" />
          <div className="relative">
            <p className="text-xs font-semibold uppercase tracking-[0.2em] text-gold">Catálogo</p>
            <h1 className="mt-2 font-display text-3xl font-bold text-primary-foreground md:text-4xl">Produtos</h1>
            <p className="mt-2 max-w-md text-primary-foreground/70">
              Gerencie rótulos, safras, estoque e fichas técnicas da sua linha de vinhos.
            </p>
          </div>
          <div className="relative flex gap-3">
            <Button 
              variant="hero" 
              size="lg" 
              onClick={() => {
                setEditingProduct(null);
                setIsSheetOpen(true);
              }}
            >
              <Plus /> Novo produto
            </Button>
          </div>
        </div>
      </div>

      <div className="grid gap-3 sm:grid-cols-4">
        {[
          { l: "Total de rótulos", v: products.length.toString() },
          { l: "Em estoque", v: `${totalStock.toLocaleString("pt-BR")} garrafas` },
          { l: "Valor de estoque", v: totalValue.toLocaleString("pt-BR", { style: "currency", currency: "BRL" }) },
          { l: "Categoria principal", v: products.length > 0 ? "Vinhos" : "--" },
        ].map((s) => (
          <div key={s.l} className="rounded-xl border border-border bg-card p-4">
            <div className="text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">{s.l}</div>
            <div className="mt-1 font-display text-xl font-bold">{s.v}</div>
          </div>
        ))}
      </div>

      <div className="flex items-center justify-between">
        <Tabs defaultValue="active" className="w-full max-w-xs" onValueChange={setActiveTab}>
          <TabsList className="bg-card border border-border">
            <TabsTrigger value="active" className="text-xs">Ativos</TabsTrigger>
            <TabsTrigger value="archived" className="text-xs">Arquivados</TabsTrigger>
          </TabsList>
        </Tabs>
      </div>

      <div className="rounded-2xl border border-border bg-card shadow-card">
        <div className="flex flex-wrap items-center gap-3 border-b border-border p-4">
          <div className="relative flex-1 min-w-[200px]">
            <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
            <input placeholder="Buscar produtos…" className="h-9 w-full rounded-md border border-input bg-background pl-9 pr-3 text-sm outline-none focus:border-primary" />
          </div>
          <Button variant="outline" size="sm"><Filter /> Filtros</Button>
        </div>

        <div className="overflow-x-auto">
          {loading ? (
            <div className="flex flex-col items-center justify-center py-20 gap-3 text-muted-foreground">
              <Loader2 className="h-8 w-8 animate-spin text-gold" />
              <p>Carregando catálogo...</p>
            </div>
          ) : products.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-20 gap-4 text-center">
              <div className="flex h-16 w-16 items-center justify-center rounded-full bg-muted">
                <Wine className="h-8 w-8 text-muted-foreground" />
              </div>
              <div>
                <h3 className="text-lg font-semibold">Nenhum produto cadastrado</h3>
                <p className="text-sm text-muted-foreground max-w-xs mx-auto">
                  Comece adicionando seu primeiro rótulo ao catálogo da vinícola.
                </p>
              </div>
              <Button onClick={() => {
                setEditingProduct(null);
                setIsSheetOpen(true);
              }}>Cadastrar Produto</Button>
            </div>
          ) : (
            <table className="w-full text-sm">
              <thead className="bg-secondary/50 text-left text-xs uppercase tracking-wider text-muted-foreground">
                <tr>
                  <th className="px-6 py-3 font-medium">Produto</th>
                  <th className="px-6 py-3 font-medium">Categoria</th>
                  <th className="px-6 py-3 font-medium">Safra</th>
                  <th className="px-6 py-3 font-medium">Estoque</th>
                  <th className="px-6 py-3 font-medium">Preço</th>
                  <th className="px-6 py-3 font-medium">Status</th>
                  <th className="px-6 py-3 font-medium text-right pr-10">Ações</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-border">
                {products.map((p) => (
                  <tr key={p.id} className="hover:bg-secondary/30 group">
                    <td className="px-6 py-4">
                      <div className="flex items-center gap-3">
                        <div 
                          className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg bg-wine text-gold overflow-hidden cursor-zoom-in transition-transform hover:scale-110 active:scale-95 shadow-sm border border-border/50"
                          onClick={() => p.image_url && setSelectedImage(p.image_url)}
                        >
                          {p.image_url ? (
                            <img src={p.image_url} alt={p.name} className="h-full w-full object-cover" />
                          ) : (
                            <Wine className="h-4 w-4" />
                          )}
                        </div>
                        <div>
                          <div className="font-medium">{p.name}</div>
                          <div className="text-xs text-muted-foreground">{p.variety || "Variedade não informada"}</div>
                        </div>
                      </div>
                    </td>
                    <td className="px-6 py-4 text-muted-foreground capitalize">{p.category}</td>
                    <td className="px-6 py-4 font-mono">{p.vintage || "--"}</td>
                    <td className="px-6 py-4">{p.stock_quantity.toLocaleString("pt-BR")}</td>
                    <td className="px-6 py-4 font-semibold">
                      {p.price.toLocaleString("pt-BR", { style: "currency", currency: "BRL" })}
                    </td>
                    <td className="px-6 py-4">
                      <span className={`rounded-full px-2.5 py-0.5 text-xs font-medium ${statusColor(p.stock_quantity, p.status)}`}>
                        {getStatusLabel(p.stock_quantity, p.status)}
                      </span>
                    </td>
                    <td className="px-6 py-4 text-right">
                      <DropdownMenu>
                        <DropdownMenuTrigger asChild>
                          <Button variant="ghost" size="icon" className="h-8 w-8">
                            <MoreHorizontal className="h-4 w-4" />
                          </Button>
                        </DropdownMenuTrigger>
                        <DropdownMenuContent align="end" className="w-40 bg-card border-border">
                          <DropdownMenuLabel>Ações</DropdownMenuLabel>
                          <DropdownMenuSeparator />
                          <DropdownMenuItem onClick={() => handleEdit(p)} className="cursor-pointer">
                            <Edit2 className="mr-2 h-4 w-4 text-blue-500" /> Editar
                          </DropdownMenuItem>
                          <DropdownMenuItem onClick={() => handleToggleStatus(p)} className="cursor-pointer">
                            {p.status === "inactive" ? (
                              <>
                                <Wine className="mr-2 h-4 w-4 text-success" /> Ativar
                              </>
                            ) : (
                              <>
                                <Archive className="mr-2 h-4 w-4 text-muted-foreground" /> Desativar
                              </>
                            )}
                          </DropdownMenuItem>
                          <DropdownMenuItem onClick={() => handleArchive(p.id, p.status)} className="cursor-pointer">
                            {p.status === "archived" ? (
                              <>
                                <Archive className="mr-2 h-4 w-4 text-success" /> Desarquivar
                              </>
                            ) : (
                              <>
                                <Archive className="mr-2 h-4 w-4 text-gold" /> Arquivar
                              </>
                            )}
                          </DropdownMenuItem>
                          <DropdownMenuSeparator />
                          <DropdownMenuItem 
                            onClick={() => setProductToDelete(p.id)}
                            className="cursor-pointer text-destructive focus:text-destructive"
                          >
                            <Trash2 className="mr-2 h-4 w-4" /> Excluir
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

      <ProductSheet 
        open={isSheetOpen} 
        onOpenChange={(open) => {
          setIsSheetOpen(open);
          if (!open) setEditingProduct(null);
        }} 
        product={editingProduct}
        onSuccess={fetchProducts} 
      />

      <AlertDialog open={!!productToDelete} onOpenChange={(open) => !open && setProductToDelete(null)}>
        <AlertDialogContent className="bg-card border-border">
          <AlertDialogHeader>
            <AlertDialogTitle>Você tem certeza?</AlertDialogTitle>
            <AlertDialogDescription>
              Esta ação não pode ser desfeita. O produto será removido permanentemente do catálogo.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancelar</AlertDialogCancel>
            <AlertDialogAction onClick={handleDelete} className="bg-destructive text-destructive-foreground hover:bg-destructive/90">
              Excluir Produto
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      {/* Modal de Visualização da Imagem */}
      <Dialog open={!!selectedImage} onOpenChange={(open) => !open && setSelectedImage(null)}>
        <DialogContent className="max-w-3xl border-none bg-transparent p-0 shadow-none [&>button]:top-8 [&>button]:right-8 [&>button]:bg-white/90 [&>button]:backdrop-blur-sm [&>button]:text-primary [&>button]:hover:bg-white [&>button]:scale-125 [&>button]:transition-all">
          <DialogHeader>
            <VisuallyHidden>
              <DialogTitle>Visualização do Produto</DialogTitle>
            </VisuallyHidden>
          </DialogHeader>
          <div className="relative flex items-center justify-center overflow-hidden rounded-2xl bg-card/80 backdrop-blur-md p-4 border border-border/50 shadow-2xl">
            <img 
              src={selectedImage || ""} 
              alt="Produto Ampliado" 
              className="max-h-[80vh] w-auto rounded-lg object-contain shadow-gold/20 shadow-lg"
            />
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
};

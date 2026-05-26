import { useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { Eye, EyeOff, Mail, Lock, User, Building2, ArrowRight, Sparkles } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Checkbox } from "@/components/ui/checkbox";
import { Logo } from "@/components/Logo";
import { cn } from "@/lib/utils";
import { useAuth } from "@/contexts/AuthContext";
import { supabase } from "@/lib/supabase";
import { toast } from "sonner";
import vineyardImg from "@/assets/vineyard.jpg";

export const RegisterPage = () => {
  const navigate = useNavigate();
  const { signInWithGoogle } = useAuth();
  const [showPassword, setShowPassword] = useState(false);
  const [showConfirm, setShowConfirm] = useState(false);
  const [loading, setLoading] = useState(false);
  const [agreed, setAgreed] = useState(false);
  const [form, setForm] = useState({
    name: "",
    winery: "",
    email: "",
    password: "",
    confirm: "",
  });

  const passwordMatch = form.password === form.confirm || form.confirm === "";
  const canSubmit = agreed && form.name && form.email && form.password && form.confirm && passwordMatch;

  const handleGoogleLogin = async () => {
    try {
      await signInWithGoogle();
    } catch (error: any) {
      toast.error("Erro ao entrar com Google: " + error.message);
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!canSubmit) return;
    setLoading(true);
    try {
      // 1. Criar a Vinícola no Backend PRIMEIRO
      const wineryResponse = await fetch(`${import.meta.env.VITE_API_URL}/auth/create-winery`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ wineryName: form.winery || `${form.name}'s Winery` }),
      });

      if (!wineryResponse.ok) {
        const errorData = await wineryResponse.json();
        throw new Error(errorData.error || 'Erro ao criar vinícola');
      }

      const { wineryId } = await wineryResponse.json();

      // 2. Criar o Usuário no Supabase passando o wineryId nos metadados
      const { error: authError } = await supabase.auth.signUp({
        email: form.email,
        password: form.password,
        options: {
          data: {
            full_name: form.name,
            winery_id: wineryId // O gatilho do Supabase vai ler isso!
          }
        }
      });

      if (authError) throw authError;

      toast.success("Conta criada com sucesso! Verifique seu e-mail para confirmar.");
      navigate("/login");
    } catch (error: any) {
      toast.error("Erro ao criar conta: " + error.message);
    } finally {
      setLoading(false);
    }
  };

  const field = (key: keyof typeof form, value: string) =>
    setForm((prev) => ({ ...prev, [key]: value }));

  return (
    <div className="min-h-svh flex">
      {/* ── Painel Esquerdo (decorativo) ── */}
      <aside className="relative hidden lg:flex lg:w-[52%] flex-col justify-between overflow-hidden p-12">
        <img
          src={vineyardImg}
          alt="Vinhedo ao pôr do sol"
          className="absolute inset-0 h-full w-full object-cover"
        />
        <div className="absolute inset-0 bg-gradient-to-br from-primary-deep/90 via-primary/80 to-primary-deep/95" />
        <div className="absolute inset-0 bg-[radial-gradient(ellipse_at_bottom_left,hsl(var(--gold)/0.18),transparent_60%)]" />

        {/* Logo */}
        <div className="relative z-10">
          <Link to="/">
            <Logo variant="light" />
          </Link>
        </div>

        {/* Copy central */}
        <div className="relative z-10 animate-fade-up">
          <div className="mb-6 inline-flex items-center gap-3">
            <span className="h-px w-8 bg-gold" />
            <span className="text-xs font-medium uppercase tracking-widest text-gold-soft">
              Comece gratuitamente
            </span>
          </div>

          <h2 className="font-display text-4xl font-bold leading-tight tracking-tight text-primary-foreground xl:text-5xl">
            Sua vinícola,
            <span className="block text-gold">elevada ao próximo nível.</span>
          </h2>
          <p className="mt-4 max-w-sm text-base leading-relaxed text-primary-foreground/70">
            Crie sua conta e acesse o sistema completo de gestão: produtos,
            enoturismo, vendas, equipe e analytics.
          </p>

          {/* Benefícios */}
          <ul className="mt-10 space-y-3 border-t border-primary-foreground/10 pt-8">
            {[
              "✓  Teste gratuito por 15 dias, sem cartão de crédito",
              "✓  Migração de dados assistida pela equipe",
              "✓  Suporte premium 24/7 via chat e e-mail",
            ].map((item) => (
              <li key={item} className="text-sm text-primary-foreground/70">
                {item}
              </li>
            ))}
          </ul>
        </div>

        <p className="relative z-10 text-xs text-primary-foreground/40">
          © {new Date().getFullYear()} Vintech. Todos os direitos reservados.
        </p>
      </aside>

      {/* ── Painel Direito (formulário) ── */}
      <main className="flex flex-1 flex-col items-center justify-center bg-background px-6 py-12 sm:px-12 overflow-y-auto">
        {/* Logo mobile */}
        <div className="mb-8 lg:hidden">
          <Link to="/">
            <Logo />
          </Link>
        </div>

        <div className="w-full max-w-md animate-fade-up">
          {/* Cabeçalho */}
          <div className="mb-8">
            <h1 className="font-display text-3xl font-bold tracking-tight text-foreground">
              Criar conta gratuita
            </h1>
            <p className="mt-2 text-sm text-muted-foreground">
              Já tem uma conta?{" "}
              <Link
                to="/login"
                className="font-medium text-primary underline-offset-4 hover:underline"
              >
                Fazer login
              </Link>
            </p>
          </div>

          <form onSubmit={handleSubmit} className="space-y-4">
            {/* Nome completo */}
            <div className="space-y-2">
              <Label htmlFor="name" className="text-sm font-medium text-foreground">
                Nome completo
              </Label>
              <div className="relative">
                <User className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
                <Input
                  id="name"
                  type="text"
                  autoComplete="name"
                  required
                  placeholder="João da Silva"
                  value={form.name}
                  onChange={(e) => field("name", e.target.value)}
                  className="pl-10 h-11 border-input focus-visible:ring-primary"
                />
              </div>
            </div>

            {/* Nome da vinícola */}
            <div className="space-y-2">
              <Label htmlFor="winery" className="text-sm font-medium text-foreground">
                Nome da vinícola{" "}
                <span className="text-muted-foreground font-normal">(opcional)</span>
              </Label>
              <div className="relative">
                <Building2 className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
                <Input
                  id="winery"
                  type="text"
                  placeholder="Vinhedo São Roque"
                  value={form.winery}
                  onChange={(e) => field("winery", e.target.value)}
                  className="pl-10 h-11 border-input focus-visible:ring-primary"
                />
              </div>
            </div>

            {/* Email */}
            <div className="space-y-2">
              <Label htmlFor="email" className="text-sm font-medium text-foreground">
                E-mail
              </Label>
              <div className="relative">
                <Mail className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
                <Input
                  id="email"
                  type="email"
                  autoComplete="email"
                  required
                  placeholder="Endereço de e-mail"
                  value={form.email}
                  onChange={(e) => field("email", e.target.value)}
                  className="pl-10 h-11 border-input focus-visible:ring-primary"
                />
              </div>
            </div>

            {/* Senha */}
            <div className="space-y-2">
              <Label htmlFor="password" className="text-sm font-medium text-foreground">
                Senha
              </Label>
              <div className="relative">
                <Lock className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
                <Input
                  id="password"
                  type={showPassword ? "text" : "password"}
                  autoComplete="new-password"
                  required
                  placeholder="Mínimo 8 caracteres"
                  value={form.password}
                  onChange={(e) => field("password", e.target.value)}
                  className="pl-10 pr-10 h-11 border-input focus-visible:ring-primary"
                />
                <button
                  type="button"
                  onClick={() => setShowPassword((v) => !v)}
                  className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground transition-colors"
                  aria-label={showPassword ? "Ocultar senha" : "Mostrar senha"}
                >
                  {showPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                </button>
              </div>
            </div>

            {/* Confirmar senha */}
            <div className="space-y-2">
              <Label htmlFor="confirm" className="text-sm font-medium text-foreground">
                Confirmar senha
              </Label>
              <div className="relative">
                <Lock className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
                <Input
                  id="confirm"
                  type={showConfirm ? "text" : "password"}
                  autoComplete="new-password"
                  required
                  placeholder="Repita a senha"
                  value={form.confirm}
                  onChange={(e) => field("confirm", e.target.value)}
                  className={cn(
                    "pl-10 pr-10 h-11 border-input focus-visible:ring-primary",
                    !passwordMatch && "border-destructive focus-visible:ring-destructive"
                  )}
                />
                <button
                  type="button"
                  onClick={() => setShowConfirm((v) => !v)}
                  className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground transition-colors"
                  aria-label={showConfirm ? "Ocultar senha" : "Mostrar senha"}
                >
                  {showConfirm ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                </button>
              </div>
              {!passwordMatch && (
                <p className="text-xs text-destructive">As senhas não coincidem.</p>
              )}
            </div>

            {/* Termos */}
            <div className="flex items-start gap-3 pt-1">
              <Checkbox
                id="terms"
                checked={agreed}
                onCheckedChange={(v) => setAgreed(Boolean(v))}
                className="mt-0.5 border-input data-[state=checked]:bg-primary data-[state=checked]:border-primary"
              />
              <Label htmlFor="terms" className="text-sm text-muted-foreground leading-relaxed cursor-pointer">
                Concordo com os{" "}
                <Link to="/terms" className="text-primary underline-offset-4 hover:underline">
                  Termos de Uso
                </Link>{" "}
                e a{" "}
                <Link to="/privacy" className="text-primary underline-offset-4 hover:underline">
                  Política de Privacidade
                </Link>
              </Label>
            </div>

            {/* Botão */}
            <Button
              type="submit"
              variant="hero"
              size="lg"
              className="w-full group mt-2"
              disabled={!canSubmit || loading}
            >
              {loading ? (
                <span className="flex items-center gap-2">
                  <span className="h-4 w-4 animate-spin rounded-full border-2 border-primary-foreground/30 border-t-primary-foreground" />
                  Criando conta…
                </span>
              ) : (
                <span className="flex items-center gap-2">
                  Criar conta gratuitamente
                  <ArrowRight className="h-4 w-4 transition-transform group-hover:translate-x-1" />
                </span>
              )}
            </Button>
          </form>

          {/* Divisor */}
          <div className="relative my-6 flex items-center">
            <div className="flex-1 border-t border-border" />
            <span className="mx-4 text-xs text-muted-foreground">ou continue com</span>
            <div className="flex-1 border-t border-border" />
          </div>

          {/* Social */}
          <Button
            variant="outline"
            size="lg"
            className="w-full gap-3 border-border hover:border-primary/40 hover:bg-primary/5"
            type="button"
            onClick={handleGoogleLogin}
          >
            <svg viewBox="0 0 24 24" className="h-4 w-4" aria-hidden="true">
              <path d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z" fill="#4285F4" />
              <path d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z" fill="#34A853" />
              <path d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l3.66-2.84z" fill="#FBBC05" />
              <path d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z" fill="#EA4335" />
            </svg>
            Registrar com Google
          </Button>
        </div>
      </main>
    </div>
  );
};

import heroImg from "@/assets/vineyard.jpg";
import { Button } from "@/components/ui/button";
import { Link } from "react-router-dom";
import { ArrowRight, Sparkles } from "lucide-react";
import { useRotatingPhrases, type RotatingPhrase } from "@/hooks/useRotatingPhrases";

// Referência estável (fora do componente) para o hook de rotação.
const HERO_PHRASES: RotatingPhrase[] = [
  { lead: "Da vindima", highlight: "à última taça." },
  { lead: "Do campo", highlight: "à nuvem." },
  { lead: "Da uva", highlight: "aos dados." },
  { lead: "Da safra", highlight: "ao faturamento." },
  { lead: "Da adega", highlight: "ao analytics." },
];

export const Hero = () => {
  const { phrase, visible } = useRotatingPhrases(HERO_PHRASES, {
    intervalMs: 3500,
    fadeMs: 500,
  });

  return (
    <section className="relative isolate min-h-[100svh] overflow-hidden">
      <img
        src={heroImg}
        alt="Vinho tinto sendo servido em vinhedo ao pôr do sol"
        className="absolute inset-0 h-full w-full object-cover"
      />
      <div className="absolute inset-0 bg-gradient-to-b from-primary-deep/70 via-primary-deep/60 to-primary-deep/95" />
      <div className="absolute inset-0 bg-[radial-gradient(ellipse_at_top_right,hsl(var(--gold)/0.15),transparent_60%)]" />

      <div className="container relative z-10 flex min-h-[100svh] flex-col justify-center pb-20 pt-32">
        <div className="max-w-3xl animate-fade-up">
          <div className="mb-6 inline-flex items-center gap-3">
            <span className="h-px w-8 bg-gold" />
            <span className="text-xs font-medium uppercase tracking-widest text-gold-soft">
              Sistema Integrado de Gestão Vinícola
            </span>
          </div>

          <h1 className="font-display text-5xl font-bold leading-[1.05] tracking-tight text-primary-foreground text-balance md:text-7xl lg:text-8xl">
            <span
              className={`block transition-opacity duration-500 ${visible ? "opacity-100" : "opacity-0"}`}
            >
              {phrase.lead}
              <span className="block text-gold">{phrase.highlight}</span>
            </span>
          </h1>

          <p className="mt-6 max-w-xl text-lg leading-relaxed text-primary-foreground/75 md:text-xl">
            O sistema completo de gestão para vinícolas modernas. Produtos, enoturismo,
            vendas, equipe e analytics — em uma única plataforma elegante.
          </p>

          <div className="mt-10 flex flex-col gap-3 sm:flex-row sm:items-center">
            <Button asChild variant="hero" size="xl" className="group">
              <Link to="/dashboard">
                Acessar o dashboard
                <ArrowRight className="transition-transform group-hover:translate-x-1" />
              </Link>
            </Button>
            <Button asChild variant="glass" size="xl">
              <a href="#modulos">Conhecer os módulos</a>
            </Button>
          </div>

          <div className="mt-16 grid grid-cols-3 gap-8 border-t border-primary-foreground/10 pt-8 max-w-xl">
            {[
              { value: "5", label: "Módulos integrados" },
              { value: "100%", label: "Multi-tenant" },
              { value: "24/7", label: "Suporte premium" },
            ].map((stat) => (
              <div key={stat.label}>
                <div className="font-display text-3xl font-bold text-gold md:text-4xl">{stat.value}</div>
                <div className="mt-1 text-xs uppercase tracking-wider text-primary-foreground/60">
                  {stat.label}
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>

      <div className="absolute bottom-0 left-0 right-0 h-32 bg-gradient-to-t from-background to-transparent z-[5]" />
    </section>
  );
};

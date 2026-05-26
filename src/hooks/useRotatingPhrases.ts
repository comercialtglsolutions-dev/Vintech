import { useEffect, useState } from "react";

export interface RotatingPhrase {
  /** Primeira linha (cor padrão). */
  lead: string;
  /** Segunda linha (destaque dourado). */
  highlight: string;
}

interface Options {
  /** Tempo que cada frase permanece visível (inclui o fade). */
  intervalMs?: number;
  /** Duração do fade de saída/entrada. */
  fadeMs?: number;
}

/**
 * Alterna entre frases em loop com transição de fade.
 *
 * - Mantém a primeira frase fixa se o usuário pedir menos movimento
 *   (`prefers-reduced-motion`).
 * - Pausa quando a aba não está visível para não desperdiçar ciclos.
 *
 * O array de frases deve ter referência estável (defina fora do componente).
 */
export function useRotatingPhrases(
  phrases: RotatingPhrase[],
  { intervalMs = 3500, fadeMs = 500 }: Options = {},
) {
  const [index, setIndex] = useState(0);
  const [visible, setVisible] = useState(true);

  useEffect(() => {
    if (phrases.length <= 1) return;

    const prefersReduced = window.matchMedia?.(
      "(prefers-reduced-motion: reduce)",
    ).matches;
    if (prefersReduced) return; // mantém a primeira frase fixa

    let fadeTimeout: ReturnType<typeof setTimeout>;

    const tick = () => {
      if (document.hidden) return; // não troca com a aba inativa
      setVisible(false); // fade out da frase atual
      fadeTimeout = setTimeout(() => {
        setIndex((i) => (i + 1) % phrases.length);
        setVisible(true); // fade in da próxima
      }, fadeMs);
    };

    const interval = setInterval(tick, intervalMs);
    return () => {
      clearInterval(interval);
      clearTimeout(fadeTimeout);
    };
  }, [phrases, intervalMs, fadeMs]);

  return { phrase: phrases[index], index, visible };
}

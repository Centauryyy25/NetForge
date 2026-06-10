"use client";

import { useEffect, useMemo, useState } from "react";
import {
  Particles,
  ParticlesProvider,
  useParticlesProvider,
} from "@tsparticles/react";
import { loadSlim } from "@tsparticles/slim";
import type { Engine, ISourceOptions } from "@tsparticles/engine";

async function initEngine(engine: Engine) {
  await loadSlim(engine);
}

function useIsDark() {
  const [isDark, setIsDark] = useState(false);

  useEffect(() => {
    const root = document.documentElement;
    const update = () => setIsDark(root.classList.contains("dark"));
    update();
    const observer = new MutationObserver(update);
    observer.observe(root, { attributes: true, attributeFilter: ["class"] });
    return () => observer.disconnect();
  }, []);

  return isDark;
}

function ParticlesCanvas() {
  const { loaded } = useParticlesProvider();
  const isDark = useIsDark();

  const options = useMemo<ISourceOptions>(
    () => ({
      fullScreen: { enable: false },
      background: { color: { value: "transparent" } },
      fpsLimit: 60,
      detectRetina: true,
      pauseOnBlur: true,
      pauseOnOutsideViewport: true,
      interactivity: {
        events: {
          onHover: { enable: false },
          onClick: { enable: false },
          resize: { enable: true },
        },
      },
      particles: {
        number: {
          value: 80,
          density: { enable: true, width: 800, height: 800 },
        },
        color: { value: isDark ? "#c7d2fe" : "#4f46e5" },
        links: {
          enable: true,
          distance: 150,
          color: isDark ? "#a5b4fc" : "#6366f1",
          opacity: isDark ? 0.55 : 0.4,
          width: 1,
        },
        move: {
          enable: true,
          speed: 0.5,
          direction: "none",
          random: true,
          straight: false,
          outModes: { default: "out" },
        },
        size: { value: { min: 1, max: 3 } },
        opacity: { value: { min: 0.4, max: 0.85 } },
      },
    }),
    [isDark],
  );

  if (!loaded) return null;

  return (
    <Particles
      id="auth-particles"
      options={options}
      className="pointer-events-none fixed inset-0 -z-10"
    />
  );
}

export function ParticlesBackground() {
  const [reducedMotion, setReducedMotion] = useState(false);

  useEffect(() => {
    const mq = window.matchMedia("(prefers-reduced-motion: reduce)");
    setReducedMotion(mq.matches);
    const onChange = (e: MediaQueryListEvent) => setReducedMotion(e.matches);
    mq.addEventListener("change", onChange);
    return () => mq.removeEventListener("change", onChange);
  }, []);

  if (reducedMotion) return null;

  return (
    <ParticlesProvider init={initEngine}>
      <ParticlesCanvas />
    </ParticlesProvider>
  );
}

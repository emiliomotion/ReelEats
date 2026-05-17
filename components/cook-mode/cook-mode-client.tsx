"use client";

import {
  useState, useEffect, useCallback, useRef, TouchEvent
} from "react";
import { useRouter } from "next/navigation";
import {
  ArrowLeft, ArrowRight, Mic, MicOff, Timer,
  X, Star, Check
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { cn, formatDuration } from "@/lib/utils";
import type { RecipeWithDetails } from "@/lib/supabase/types";

interface Props {
  recipe: RecipeWithDetails;
}

export function CookModeClient({ recipe }: Props) {
  const router = useRouter();
  const [currentStep, setCurrentStep] = useState(0);
  const [timerActive, setTimerActive] = useState(false);
  const [timerRemaining, setTimerRemaining] = useState<number | null>(null);
  const [timerDone, setTimerDone] = useState(false);
  const [voiceActive, setVoiceActive] = useState(false);
  const [showRating, setShowRating] = useState(false);
  const [rating, setRating] = useState(0);
  const [done, setDone] = useState(false);

  const touchStartX = useRef<number | null>(null);
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const recognitionRef = useRef<any>(null);
  const timerRef = useRef<NodeJS.Timeout | null>(null);
  const alertSoundRef = useRef<AudioContext | null>(null);

  const steps = recipe.steps;
  const step = steps[currentStep];
  const isLastStep = currentStep === steps.length - 1;

  // Wake Lock
  useEffect(() => {
    let wakeLock: WakeLockSentinel | null = null;
    if ("wakeLock" in navigator) {
      navigator.wakeLock.request("screen").then((wl) => {
        wakeLock = wl;
      }).catch(() => {});
    }
    return () => { wakeLock?.release(); };
  }, []);

  // Timer
  useEffect(() => {
    if (timerActive && timerRemaining !== null) {
      timerRef.current = setInterval(() => {
        setTimerRemaining((prev) => {
          if (prev === null || prev <= 1) {
            setTimerActive(false);
            setTimerDone(true);
            playAlert();
            return 0;
          }
          return prev - 1;
        });
      }, 1000);
    }
    return () => { if (timerRef.current) clearInterval(timerRef.current); };
  }, [timerActive, timerRemaining]);

  // Reset timer when step changes
  useEffect(() => {
    setTimerActive(false);
    setTimerDone(false);
    if (timerRef.current) clearInterval(timerRef.current);
    const dur = steps[currentStep]?.duration_sec ?? null;
    setTimerRemaining(dur);
  }, [currentStep, steps]);

  function playAlert() {
    try {
      if (!alertSoundRef.current) {
        alertSoundRef.current = new AudioContext();
      }
      const ctx = alertSoundRef.current;
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();
      osc.connect(gain);
      gain.connect(ctx.destination);
      osc.frequency.value = 880;
      gain.gain.setValueAtTime(0.3, ctx.currentTime);
      gain.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + 0.8);
      osc.start(ctx.currentTime);
      osc.stop(ctx.currentTime + 0.8);
    } catch {}
  }

  const goNext = useCallback(() => {
    if (currentStep < steps.length - 1) {
      setCurrentStep((s) => s + 1);
    } else if (isLastStep) {
      setShowRating(true);
    }
  }, [currentStep, steps.length, isLastStep]);

  const goPrev = useCallback(() => {
    if (currentStep > 0) setCurrentStep((s) => s - 1);
  }, [currentStep]);

  // Voice control
  const toggleVoice = useCallback(() => {
    if (!("SpeechRecognition" in window || "webkitSpeechRecognition" in window)) return;

    if (voiceActive && recognitionRef.current) {
      recognitionRef.current.stop();
      setVoiceActive(false);
      return;
    }

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const SR = (window as Record<string, any>).SpeechRecognition || (window as Record<string, any>).webkitSpeechRecognition;
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const recognition: any = new SR();
    recognition.continuous = true;
    recognition.interimResults = false;
    recognition.lang = "en-US";

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    recognition.onresult = (event: Record<string, any>) => {
      const last = event.results[event.results.length - 1];
      const text = last[0].transcript.toLowerCase().trim();

      if (text.includes("next")) goNext();
      else if (text.includes("previous") || text.includes("back") || text.includes("go back")) goPrev();
      else if (text.includes("repeat")) {/* stay on current step */}
      else if (text.includes("timer")) {
        if (timerRemaining) setTimerActive(true);
      }
    };

    recognition.onerror = () => setVoiceActive(false);
    recognition.onend = () => setVoiceActive(false);

    recognition.start();
    recognitionRef.current = recognition;
    setVoiceActive(true);
  }, [voiceActive, goNext, goPrev, timerRemaining]);

  // Touch swipe
  const handleTouchStart = (e: TouchEvent) => {
    touchStartX.current = e.touches[0].clientX;
  };

  const handleTouchEnd = (e: TouchEvent) => {
    if (touchStartX.current === null) return;
    const diff = touchStartX.current - e.changedTouches[0].clientX;
    if (Math.abs(diff) > 60) {
      if (diff > 0) goNext();
      else goPrev();
    }
    touchStartX.current = null;
  };

  const handleMarkCooked = async () => {
    await fetch(`/api/recipes/${recipe.id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        user_rating: rating || undefined,
      }),
    });
    // Increment times_cooked via a separate call to cook_logs
    await fetch("/api/cook-logs", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ recipe_id: recipe.id, rating: rating || null }),
    }).catch(() => {});
    setDone(true);
    setTimeout(() => router.push(`/recipe/${recipe.id}`), 1500);
  };

  // Rating overlay
  if (showRating) {
    return (
      <div className="min-h-screen bg-[var(--background)] flex flex-col items-center justify-center px-6">
        {done ? (
          <div className="text-center space-y-3">
            <div className="w-16 h-16 rounded-full bg-green-100 dark:bg-green-900/30 flex items-center justify-center mx-auto">
              <Check className="w-8 h-8 text-green-600" />
            </div>
            <h2 className="font-display text-2xl">Marked as cooked!</h2>
            <p className="text-[var(--muted-foreground)]">Returning to recipe…</p>
          </div>
        ) : (
          <div className="text-center space-y-6 max-w-sm">
            <div>
              <p className="text-[var(--muted-foreground)] text-sm mb-1">You made</p>
              <h1 className="font-display text-3xl">{recipe.title}</h1>
            </div>

            <div>
              <p className="text-sm text-[var(--muted-foreground)] mb-3">How was it?</p>
              <div className="flex justify-center gap-3">
                {[1, 2, 3, 4, 5].map((n) => (
                  <button
                    key={n}
                    onClick={() => setRating(rating === n ? 0 : n)}
                    className="text-3xl transition-transform hover:scale-110 active:scale-95"
                  >
                    <Star
                      className={cn(
                        "w-9 h-9 transition-colors",
                        n <= rating
                          ? "fill-[var(--accent)] text-[var(--accent)]"
                          : "text-[var(--border)]"
                      )}
                    />
                  </button>
                ))}
              </div>
            </div>

            <Button size="xl" onClick={handleMarkCooked} className="w-full">
              <Check className="w-5 h-5" />
              Mark as cooked
            </Button>

            <button
              onClick={() => router.push(`/recipe/${recipe.id}`)}
              className="text-sm text-[var(--muted-foreground)] hover:text-[var(--foreground)]"
            >
              Skip
            </button>
          </div>
        )}
      </div>
    );
  }

  return (
    <div
      className="min-h-screen bg-[var(--background)] flex flex-col select-none"
      onTouchStart={handleTouchStart}
      onTouchEnd={handleTouchEnd}
    >
      {/* Top bar */}
      <div className="flex items-center justify-between px-4 pt-4 pb-2">
        <button
          onClick={() => router.push(`/recipe/${recipe.id}`)}
          className="p-2 rounded-xl hover:bg-[var(--muted)] transition-colors"
        >
          <X className="w-5 h-5" />
        </button>

        <div className="text-sm text-[var(--muted-foreground)]">
          Step {currentStep + 1} of {steps.length}
        </div>

        <button
          onClick={toggleVoice}
          className={cn(
            "p-2 rounded-xl transition-colors",
            voiceActive
              ? "bg-[var(--accent)]/20 text-[var(--accent)]"
              : "hover:bg-[var(--muted)] text-[var(--muted-foreground)]"
          )}
        >
          {voiceActive ? <Mic className="w-5 h-5" /> : <MicOff className="w-5 h-5" />}
        </button>
      </div>

      {/* Progress bar */}
      <div className="px-4">
        <div className="h-1 bg-[var(--muted)] rounded-full overflow-hidden">
          <div
            className="h-full bg-[var(--accent)] transition-all duration-300"
            style={{ width: `${((currentStep + 1) / steps.length) * 100}%` }}
          />
        </div>
      </div>

      {/* Step content */}
      <div className="flex-1 flex flex-col items-center justify-center px-6 py-8 text-center">
        <p className="font-display text-4xl sm:text-5xl leading-tight max-w-2xl mb-8">
          {step.instruction}
        </p>

        {/* Timer chip */}
        {timerRemaining !== null && (
          <button
            onClick={() => {
              if (timerDone) {
                setTimerDone(false);
                setTimerRemaining(step.duration_sec ?? null);
              } else {
                setTimerActive(!timerActive);
              }
            }}
            className={cn(
              "flex items-center gap-2 px-5 py-2.5 rounded-full font-medium text-lg transition-all",
              timerDone
                ? "bg-green-100 dark:bg-green-900/30 text-green-700 dark:text-green-400"
                : timerActive
                ? "bg-[var(--accent)] text-stone-900 animate-pulse"
                : "bg-[var(--muted)] text-[var(--foreground)]"
            )}
          >
            <Timer className="w-5 h-5" />
            {timerDone ? "Done!" : formatDuration(timerRemaining)}
            {step.approximate && !timerDone && "±"}
          </button>
        )}

        {step.temperature && (
          <div className="mt-3 text-[var(--muted-foreground)] text-sm">
            🌡 {step.temperature}
          </div>
        )}

        {/* Voice indicator */}
        {voiceActive && (
          <div className="mt-6 flex items-center gap-2 text-sm text-[var(--muted-foreground)]">
            <div className="flex gap-0.5">
              {[1, 2, 3].map((i) => (
                <div
                  key={i}
                  className="w-1 bg-[var(--accent)] rounded-full animate-bounce"
                  style={{ height: `${8 + i * 4}px`, animationDelay: `${i * 0.1}s` }}
                />
              ))}
            </div>
            Listening — say &ldquo;next&rdquo;, &ldquo;back&rdquo;, or &ldquo;repeat&rdquo;
          </div>
        )}
      </div>

      {/* Navigation */}
      <div className="px-6 pb-10 flex items-center justify-between gap-4">
        <Button
          variant="secondary"
          size="lg"
          onClick={goPrev}
          disabled={currentStep === 0}
          className="flex-1 gap-2"
        >
          <ArrowLeft className="w-5 h-5" />
          Previous
        </Button>

        <Button
          size="lg"
          onClick={goNext}
          className="flex-1 gap-2"
        >
          {isLastStep ? (
            <>
              <Check className="w-5 h-5" />
              Finish
            </>
          ) : (
            <>
              Next
              <ArrowRight className="w-5 h-5" />
            </>
          )}
        </Button>
      </div>
    </div>
  );
}

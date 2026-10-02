import { MagnifyingGlass, PaperPlaneTilt, Sparkle, StarFour, MaskHappy } from '@phosphor-icons/react';
import { dailyVibe } from '../lib/dailyVibe';
import { MOOD_META, ZODIAC_META } from '../lib/constants';
import { icon } from '../lib/icons';
import { useComposer } from '../store/composer';
import { MetaLabel } from './ui/Card';

/**
 * A three-step explainer. The app is a single scroll with a form, a picker and
 * a preview, which reads as one undifferentiated surface until you know the
 * order of operations. This names the loop in one line each.
 */
export function HowItWorks() {
  const steps = [
    { icon: MagnifyingGlass, title: 'Pick a track', body: 'Search any song to anchor the message.' },
    { icon: Sparkle, title: 'Mix their vibe', body: 'Pair a mood and a zodiac to set the tone.' },
    { icon: PaperPlaneTilt, title: 'Send it', body: 'It lands anonymously in the whispers below.' },
  ];

  return (
    <section aria-labelledby="how-it-works-heading">
      <MetaLabel>How it works</MetaLabel>
      <ol className="mt-3 grid gap-2.5 sm:mt-4 sm:gap-4 sm:grid-cols-3">
        {steps.map((step, index) => (
          <li key={step.title} className="flex items-start gap-3 rounded-2xl border border-line bg-white p-4 sm:gap-4 sm:p-5">
            <span className="font-mono text-xs text-ink-soft">0{index + 1}</span>
            <div>
              <p className="flex items-center gap-2 font-semibold text-ink">
                <step.icon size={16} weight="light" className="text-accent" />
                {step.title}
              </p>
              <p className="mt-1 text-sm text-ink-soft">{step.body}</p>
            </div>
          </li>
        ))}
      </ol>
    </section>
  );
}

/**
 * Today's featured zodiac + mood pairing. Deterministic for the day, so it is
 * the same everywhere without a server, and it doubles as a one-tap way to start
 * composing if you have no idea what to pick.
 */
export function VibeOfTheDay({ onUse }: { onUse: () => void }) {
  const vibe = dailyVibe();
  const setZodiac = useComposer((state) => state.setZodiac);
  const setMood = useComposer((state) => state.setMood);

  function useThis() {
    // Seed the composer with the day's pairing, but leave the track and note
    // for the user — those are the personal parts. The parent owns the scroll
    // to the form: this card can sit far down the page, and scrolling to
    // itself would not move the user toward the thing they just filled in.
    setZodiac(vibe.zodiac);
    setMood(vibe.mood);
    onUse();
  }

  return (
    <section
      aria-labelledby="vibe-of-day-heading"
      className="relative overflow-hidden rounded-[1.5rem] border border-line bg-ink p-5 text-white sm:p-8"
    >
      {/* Soft terracotta glow, echoing the story card's aura without a photo. */}
      <div
        aria-hidden
        className="pointer-events-none absolute -top-24 -right-16 h-64 w-64 rounded-full opacity-40 blur-3xl"
        style={{ background: 'radial-gradient(circle, #D97757 0%, rgba(34,33,31,0) 70%)' }}
      />

      <div className="relative flex flex-wrap items-center justify-between gap-4 sm:gap-6">
        <div>
          <p className="flex items-center gap-2 font-mono text-[10px] tracking-widest text-white/60 uppercase">
            <Sparkle size={13} weight="light" />
            Vibe of the day
          </p>
          <h2 id="vibe-of-day-heading" className="mt-2 font-serif text-xl font-bold sm:text-2xl">
            {ZODIAC_META[vibe.zodiac].label} energy, {MOOD_META[vibe.mood].label.toLowerCase()} mood
          </h2>
          <p className="mt-2 max-w-sm text-[13px] leading-relaxed text-white/70 sm:text-sm">
            {ZODIAC_META[vibe.zodiac].blurb} {MOOD_META[vibe.mood].blurb}
          </p>
        </div>

        <div className="flex items-center gap-2 sm:gap-3">
          {[ZODIAC_META[vibe.zodiac].icon, MOOD_META[vibe.mood].icon].map((name) => {
            // Resolved inside the map callback, matching how Pickers looks
            // icons up: the registry returns stable references, so this is not
            // re-creating a component on every render.
            const Mark = icon(name);
            return (
              <div
                key={name}
                className="flex h-11 w-11 items-center justify-center rounded-2xl bg-white/10 sm:h-14 sm:w-14"
              >
                {Mark ? <Mark size={26} weight="light" className="h-5 w-5 sm:h-[26px] sm:w-[26px]" /> : null}
              </div>
            );
          })}
        </div>
      </div>

      <button
        type="button"
        onClick={useThis}
        className="relative mt-5 inline-flex items-center gap-2 rounded-full bg-white px-5 py-2 text-sm font-semibold text-ink transition-colors hover:bg-paper sm:mt-6 sm:py-2.5"
      >
        <MaskHappy size={15} weight="light" />
        Start with this vibe
        <StarFour size={13} weight="light" className="text-accent" />
      </button>
    </section>
  );
}

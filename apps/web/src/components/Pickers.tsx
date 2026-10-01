import { gsap } from '../lib/gsap';
import { icon } from '../lib/icons';
import { MOOD_META, ZODIAC_META } from '../lib/constants';
import { useComposer } from '../store/composer';
import { StarFour, MaskHappy } from '@phosphor-icons/react';
import { MOODS, ZODIAC_SIGNS, type Mood, type ZodiacSign } from '../lib/types';

/** Shared pop used whenever a picker option is chosen, as in the prototype. */
function pop(node: HTMLElement) {
  gsap.fromTo(node, { scale: 0.97 }, { scale: 1, duration: 0.3, ease: 'power2.out' });
}

interface RailProps {
  /** Gone with the mixer: nothing downstream caches a pairing any more. */
  onChange?: () => void;
}

/**
 * Pills for the twelve signs, wrapping onto a second row rather than
 * scrolling: a hidden scrollbar gave no affordance, so every sign past the
 * fold read as missing.
 */
export function ZodiacRail({ onChange }: RailProps) {
  const zodiac = useComposer((state) => state.zodiac);
  const setZodiac = useComposer((state) => state.setZodiac);

  function choose(sign: ZodiacSign, node: HTMLElement) {
    setZodiac(sign);
    onChange?.();
    pop(node);
  }

  // min-w-0 overrides the UA stylesheet's min-inline-size: min-content on
  // fieldset, which would otherwise let the pill row widen past its grid
  // column and paint over the Preview column.
  return (
    <fieldset className="min-w-0">
      <legend className="meta-label mb-4 flex items-center gap-2">
        <StarFour size={20} weight="light" />
        Their zodiac
      </legend>

        <div className="flex flex-wrap gap-3">
          {ZODIAC_SIGNS.map((sign) => {
            const Glyph = icon(ZODIAC_META[sign].icon);
            const active = zodiac === sign;
            return (
              <button
                key={sign}
                type="button"
                aria-pressed={active}
                onClick={(event) => choose(sign, event.currentTarget)}
                className={`flex shrink-0 items-center gap-2 rounded-full border px-5 py-2.5 text-sm font-medium transition-colors ${
                  active ? 'border-ink bg-ink text-white' : 'border-line bg-white text-ink hover:border-ink-soft'
                }`}
              >
                {Glyph ? <Glyph size={18} weight="light" /> : null}
                {ZODIAC_META[sign].label}
              </button>
            );
          })}
        </div>
    </fieldset>
  );
}

/** Icon cards for the eight moods, four across on desktop. */
export function MoodGrid({ onChange }: RailProps) {
  const mood = useComposer((state) => state.mood);
  const setMood = useComposer((state) => state.setMood);

  function choose(option: Mood, node: HTMLElement) {
    setMood(option);
    onChange?.();
    pop(node);
  }

  // Same min-w-0 rationale as ZodiacRail: keep the fieldset inside its grid
  // column so long unbroken content (e.g. blurb strings) can never widen it.
  return (
    <fieldset className="min-w-0">
      <legend className="meta-label mb-4 flex items-center gap-2">
        <MaskHappy size={20} weight="light" />
        Current mood
      </legend>

      <div className="grid grid-cols-2 gap-4 md:grid-cols-4">
        {MOODS.map((option) => {
          const Glyph = icon(MOOD_META[option].icon);
          const active = mood === option;
          return (
            <button
              key={option}
              type="button"
              aria-pressed={active}
              onClick={(event) => choose(option, event.currentTarget)}
              className={`flex flex-col items-start rounded-2xl border p-4 text-left transition-all ${
                active ? 'border-ink bg-ink' : 'border-line bg-white hover:border-ink-soft'
              }`}
            >
              {Glyph ? (
                <Glyph size={26} weight="light" className={`mb-2 ${active ? 'text-white' : 'text-ink'}`} />
              ) : null}
              <span className={`text-sm font-semibold ${active ? 'text-white' : 'text-ink'}`}>
                {MOOD_META[option].label}
              </span>
              <span className={`mt-0.5 text-xs ${active ? 'text-white/70' : 'text-ink-soft'}`}>
                {MOOD_META[option].blurb}
              </span>
            </button>
          );
        })}
      </div>
    </fieldset>
  );
}

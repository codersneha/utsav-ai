import { Camera, Check, ImagePlus } from 'lucide-react';
import { useEffect, useState, type ChangeEvent } from 'react';
import { analyzePhoto } from '../lib/api';
import { ACCEPTED_TYPES, prepareImage } from '../lib/image';
import type { Inspiration } from '../types';

interface Props {
  onUse: (look: { colors: string; note: string }) => void;
}

/** Upload a photo you love; Gemini reads its theme, colours and décor elements. */
export function InspirationCard({ onUse }: Props) {
  const [preview, setPreview] = useState<string>();
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const [look, setLook] = useState<Inspiration>();
  const [used, setUsed] = useState(false);

  // Release the local preview URL when it changes or the card unmounts.
  useEffect(() => () => (preview ? URL.revokeObjectURL(preview) : undefined), [preview]);

  const onFile = async (e: ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    e.target.value = '';
    if (!file) return;
    setError('');
    setLook(undefined);
    setUsed(false);
    setPreview(URL.createObjectURL(file));
    setBusy(true);
    try {
      const result = await analyzePhoto(await prepareImage(file));
      if (result.inspiration) setLook(result.inspiration);
      else setError(result.error ?? 'Could not read that photo.');
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Could not read that photo.');
    } finally {
      setBusy(false);
    }
  };

  const use = () => {
    if (!look) return;
    onUse({
      // Names with hex codes, so the décor palette uses exactly the photo's colours.
      colors: look.palette
        .slice(0, 4)
        .map((p) => `${p.name} ${p.hex}`)
        .join(', '),
      note: `Inspired by a photo: ${look.theme} — ${look.elements.slice(0, 4).join(', ')}`,
    });
    setUsed(true);
  };

  return (
    <section className="card inspiration" aria-labelledby="inspiration-heading">
      <div className="inspiration-head">
        <span className="icon-badge gold" aria-hidden="true">
          <Camera size={20} />
        </span>
        <div>
          <h3 id="inspiration-heading">Get inspired by a photo</h3>
          <p className="muted small">
            Saw a décor you love on Instagram or at a friend’s wedding? Upload it and the AI will pick out its
            theme, colours and elements. Your photo is only sent to read the style — it is not stored.
          </p>
        </div>
      </div>
      <label className="btn upload-btn">
        <ImagePlus size={18} aria-hidden="true" /> {busy ? 'Reading the photo…' : 'Choose a photo'}
        <input
          type="file"
          accept={ACCEPTED_TYPES.join(',')}
          className="sr-only"
          onChange={(e) => void onFile(e)}
          disabled={busy}
        />
      </label>
      <div aria-live="polite">
        {error && <p className="notice warning">{error}</p>}
        {(preview || look) && (
          <div className="inspiration-result">
            {preview && <img src={preview} alt="Your décor inspiration" className="inspiration-photo" />}
            {look && (
              <div>
                <p className="eyebrow">AI read this style</p>
                <h4>{look.theme}</h4>
                <p className="muted small">{look.mood}</p>
                <ul className="swatches" aria-label="Colours in the photo">
                  {look.palette.map((p) => (
                    <li key={p.hex + p.name}>
                      <span className="swatch-dot" style={{ background: p.hex }} aria-hidden="true" />
                      {p.name}
                    </li>
                  ))}
                </ul>
                <ul className="chips">
                  {look.elements.map((el) => (
                    <li key={el} className="chip">
                      {el}
                    </li>
                  ))}
                </ul>
                <button type="button" className="btn primary small" onClick={use} disabled={used}>
                  <Check size={16} aria-hidden="true" />{' '}
                  {used ? 'Applied to your décor' : 'Use this look for my décor'}
                </button>
              </div>
            )}
          </div>
        )}
      </div>
    </section>
  );
}

import struct, math

def classify_at(data, offset, window_bytes=48):
    """Classify the content type starting at byte `offset`, looking at the next window_bytes.
    Returns (label, confidence) where label in {"index","position","scalar01","other"}."""
    end = offset + window_bytes
    if end > len(data):
        return None

    def is_denormal_or_subnormal(v):
        # bit pattern of a small integer misread as float32 lands here -- reject these,
        # otherwise int sequences (like 0,1,2,3...) masquerade as "valid tiny floats"
        return v != 0.0 and abs(v) < 1e-30

    # --- try u16 interpretation FIRST (index buffers are a strong, specific signature) ---
    n_h = window_bytes // 2
    hv = struct.unpack_from(f"<{n_h}H", data, offset)
    if all(v < 3000 for v in hv):
        diffs = [abs(hv[i+1]-hv[i]) for i in range(len(hv)-1)]
        smallish = sum(1 for d in diffs if d < 150)
        if diffs and smallish / len(diffs) > 0.6:
            return ("index", 0.9)
        # fallback signature: non-monotonic index lists (e.g. per-bone vertex-influence
        # lists, which jump around the vertex range instead of climbing smoothly like a
        # triangle strip) -- these fail the smooth-diff test above but are still small
        # integers throughout. Real position/scalar float32 data reread as u16 almost
        # always has roughly every other halfword be "large" (the exponent bits of a
        # non-tiny float land in the upper halfword, typically >3000) -- so requiring
        # ALL values in the window to be small is a safe discriminator against floats.
        if all(v < 1000 for v in hv):
            return ("index_loose", 0.6)

    # --- try float32 interpretation (requires 4-byte alignment relative to offset) ---
    n_f = window_bytes // 4
    fv = struct.unpack_from(f"<{n_f}f", data, offset)
    valid_f = [v for v in fv if not (math.isnan(v) or math.isinf(v) or is_denormal_or_subnormal(v))]
    float_ok = len(valid_f) == n_f
    if float_ok:
        in_unit = sum(1 for v in valid_f if -1.2 <= v <= 1.2)
        maxabs = max(abs(v) for v in valid_f)
        spread = max(valid_f) - min(valid_f)
        if in_unit == n_f:
            return ("scalar01", 1.0)
        if maxabs < 2000 and spread > 3:
            return ("position", 1.0)

    return ("other", 0.0)


def segment(data, start, end, step=4, window_bytes=48, min_run=4):
    """Scan [start,end) at `step`-byte offsets (step=4 recommended -- 2-byte stepping
    causes float-alignment interleaving noise, see session notes), classify each,
    merge into runs. Returns list of (seg_start, seg_end, label)."""
    calls = []
    for off in range(start, end - window_bytes, step):
        c = classify_at(data, off, window_bytes)
        calls.append((off, c[0] if c else "other"))

    segments = []
    cur_label, cur_start = None, None
    for off, label in calls:
        if label != cur_label:
            if cur_label is not None:
                segments.append((cur_start, off, cur_label))
            cur_label, cur_start = label, off
    if cur_label is not None:
        segments.append((cur_start, calls[-1][0] + step, cur_label))

    cleaned = []
    for s, e, label in segments:
        if cleaned and (e - s) < min_run * step:
            ps, pe, plabel = cleaned[-1]
            cleaned[-1] = (ps, e, plabel)
        else:
            cleaned.append((s, e, label))
    return cleaned


def print_segments(segs):
    for s, e, label in segs:
        print(f"  [{s:6d} - {e:6d}]  len={e-s:5d}  {label}")

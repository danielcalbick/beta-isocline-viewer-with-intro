# ζ-isocline explorer

Interactive visualizer for the partial sums of the Riemann zeta function as a discrete planar walk in ℂ.

For *s = α + iβ* fixed, each step *n* contributes a vector of length *n*<sup>-α</sup> at angle *-β·ln(n)*. Sweeping α over a range gives a family of walks and the visualizer renders two layers:

- **Trajectories** — one polyline per α-walk through time (*n = 1…N* where *N = ⌊β/π⌋ + 1*), colored along time.
- **Isoclines** — at each *n*, the connection across all α-walks; these are the β-isoclines (curves of constant phase angle in the family).

## Controls

- **β** — imaginary part. **FINE** opens a sub-panel with Δβ and a step-size σ; β = β<sub>center</sub> + σ·Δβ. Adjusting σ keeps β and Δβ pinned and only changes the resolution of the Δβ slider.
- **α₀, α₁** — real-part window for the family. Range extends into the convergence regime (up to 7) for exploring the >1 behavior.
- **Trajectories / Isoclines** — independent visibility, colormap, and opacity per layer.
- **U(1)** — overlay the unit and half-unit reference circles at the data origin.
- **Settings (sun icon next to status)** — slide the canvas background through grayscale [0, 1]; gridlines auto-flip for contrast.
- **Random β / Fit** — convenience.

Desktop: the params panel is draggable by its header and stays in-bounds when expanded. Mobile: a sliders icon top-left toggles a bottom-center carousel sheet.

## Implementation

Single-file HTML, no build step. Canvas 2D rendering with two color-binned `Path2D` strokes per layer (~64 batched draws regardless of segment count).

The magnitude table *M[n][j] = exp(-α[j]·ln n)* is cached on (nwalks, α₀, α₁) and reused — fine-tuning β only recomputes the per-row cos/sin phase, dropping the inner loop to one array read and two FMAs per cell. Output buffers are reused across compute calls to avoid GC pauses during continuous slider drags.

## Deploy

`index.html` is the entire app — Vercel serves it as a static site with no framework or build configuration.

/**
 * Liquid-glass edge lighting as a Skia runtime effect (SkSL). No React Native or Skia imports,
 * so Node can load it (scripts/compare-film-shader.mjs compiles it in CanvasKit).
 *
 * It draws ONLY the light on a glass panel, over whatever is already there (the blur and the
 * tinted body fill). React Native cannot refract the screen behind a panel the way
 * liquid-glass-js does on the web (that library screenshots the page into a WebGL texture), so
 * this reproduces the look of refraction instead: a thin bright rim that follows the shape, a
 * bevel that lights the side facing the lamp and shades the far side, a bounce light on the far
 * rim, a faint inner "tray" line, a broad sheen and a slight colour fringe on the rim.
 *
 * Adapted from liquid-glass-js (MIT, (c) 2025 Armagan Amcalar): the rounded-rect distance field,
 * the shape normal, and the exponential falloffs `exp(-distance * k)` for the edge and rim terms.
 * The inner tray line follows taste-skill's "glass plate in a tray" nested-bezel rule.
 */

export const GLASS_SKSL = `
uniform float2 size;
uniform float radius;
uniform float2 lightDir;
uniform float press;
uniform float dark;
uniform float strength;

// Signed distance to a rounded box centred on the origin (negative inside).
float sdBox(float2 p, float2 b, float r) {
  float2 q = abs(p) - b + r;
  return length(max(q, 0.0)) + min(max(q.x, q.y), 0.0) - r;
}

// Outward unit normal of that box.
float2 boxNormal(float2 p, float2 b, float r) {
  float2 q = abs(p) - b + r;
  float2 g = max(q, 0.0);
  float2 n = length(g) > 0.0001 ? normalize(g) : (q.x > q.y ? float2(1.0, 0.0) : float2(0.0, 1.0));
  return n * float2(p.x < 0.0 ? -1.0 : 1.0, p.y < 0.0 ? -1.0 : 1.0);
}

half4 main(float2 xy) {
  float2 half_ = size * 0.5;
  float2 p = xy - half_;
  float r = min(radius, min(half_.x, half_.y));
  float d = sdBox(p, half_, r);
  float cover = 1.0 - smoothstep(-0.75, 0.75, d);
  if (cover <= 0.0) {
    return half4(0.0);
  }

  float depth = max(-d, 0.0);
  float2 n = boxNormal(p, half_, r);
  float facing = dot(n, lightDir);
  float lit = max(facing, 0.0);
  float back = max(-facing, 0.0);
  float2 uv = xy / size;

  // Rim: thin, bright where the edge faces the lamp, a softer bounce on the far edge, and a
  // faint ring all round so no edge goes fully dark. Colour channels sit a fraction of a pixel
  // apart (red deepest, blue shallowest) for a hint of dispersion.
  float rimWeight = 0.12 + 0.80 * lit * lit + 0.26 * back * back;
  float3 rim = float3(
    exp(-max(depth - 0.12, 0.0) / 1.1),
    exp(-depth / 1.1),
    exp(-max(depth - 0.12, 0.0) / 1.0)
  ) * rimWeight;

  // Inner tray line a few pixels inside the edge (the nested bezel).
  float ring = exp(-pow((depth - 3.4) / 0.9, 2.0)) * (0.05 + 0.10 * lit);

  // Bevel: light pooling inside the lit edge, shade inside the far edge.
  float bevel = exp(-depth / 7.0);
  float bevelLight = bevel * lit * 0.22;
  float bevelShade = bevel * back * mix(0.12, 0.26, dark);

  // Sheen: broad highlight from the lamp side, fading across the panel.
  float along = dot(uv - 0.5, lightDir);
  float sheen = pow(clamp(along * 1.25 + 0.42, 0.0, 1.0), 3.0) * 0.12;

  float boost = (1.0 + 0.7 * press) * strength;
  float3 white = (rim + ring + bevelLight + sheen) * boost;
  white = clamp(white, 0.0, 1.0);
  float shade = clamp(bevelShade * strength, 0.0, 1.0);

  // White light over a black shade layer, premultiplied.
  float whiteA = max(white.r, max(white.g, white.b));
  float a = whiteA + shade * (1.0 - whiteA);
  return half4(half3(white * cover), half(a * cover));
}
`;

export type GlassUniforms = {
  size: readonly [number, number];
  radius: number;
  lightDir: readonly [number, number];
  /** 0..1 press amount (brightens the light). */
  press: number;
  /** 1 on a dark panel, 0 on a light one (light panels get a lighter far-edge shade). */
  dark: number;
  strength: number;
};

/** Declaration order of the uniforms in the SkSL above. */
export const GLASS_UNIFORM_ORDER: readonly (keyof GlassUniforms)[] = [
  'size',
  'radius',
  'lightDir',
  'press',
  'dark',
  'strength',
];

/** Lamp up and to the left, like iOS glass. Unit length. */
export const GLASS_LIGHT_DIR: readonly [number, number] = [-0.45, -0.893];

export function flattenGlassUniforms(u: GlassUniforms): number[] {
  const out: number[] = [];
  for (const key of GLASS_UNIFORM_ORDER) {
    const value = u[key];
    if (typeof value === 'number') out.push(value);
    else out.push(...value);
  }
  return out;
}

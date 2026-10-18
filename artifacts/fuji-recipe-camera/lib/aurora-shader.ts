/**
 * Slow flowing colour field for the app background, as a Skia runtime effect (SkSL). No React
 * Native or Skia imports, so Node can load it (scripts/compare-film-shader.mjs compiles it).
 *
 * Adapted from ShaderGradient (MIT, ruucm/shadergradient). Its plane material mixes three
 * colours with `mix(mix(c1, c2, smoothstep(-3, 3, pos.x)), c3, pos.z)`, where `pos.z` is the
 * height of a noise-displaced plane. This is the same idea flattened to 2D: a domain-warped
 * noise field plays the part of the displacement, and the three colours are mixed by x and by
 * that field. The result is drawn over black and fades to pure black away from the glow, so the
 * OLED screen keeps its black. A pixel of dither noise stops banding in the dark gradients.
 */

export const AURORA_SKSL = `
uniform float2 res;
uniform float time;
uniform float3 color1;
uniform float3 color2;
uniform float3 color3;
uniform float intensity;

float hash(float2 p) {
  p = fract(p * float2(123.34, 456.21));
  p += dot(p, p + 45.32);
  return fract(p.x * p.y);
}

// Smooth value noise in -1..1.
float noise(float2 p) {
  float2 i = floor(p);
  float2 f = fract(p);
  f = f * f * (3.0 - 2.0 * f);
  float a = hash(i);
  float b = hash(i + float2(1.0, 0.0));
  float c = hash(i + float2(0.0, 1.0));
  float d = hash(i + float2(1.0, 1.0));
  return mix(mix(a, b, f.x), mix(c, d, f.x), f.y) * 2.0 - 1.0;
}

half4 main(float2 xy) {
  float2 uv = xy / res;
  float2 p = (uv - 0.5) * float2(res.x / res.y, 1.0) * 3.4;
  float t = time * 0.07;

  // Domain-warped noise = the "displacement".
  float n1 = noise(p * 0.85 + float2(t, -t * 0.7));
  float n2 = noise(p * 1.4 + n1 * 1.2 + float2(-t * 0.8, t));
  float field = n1 * 0.6 + n2 * 0.4;

  float3 col = mix(mix(color1, color2, smoothstep(-1.0, 1.0, p.x + n1 * 0.9)), color3, smoothstep(-0.2, 0.5, field));

  // Glow lives in lobes of the field, strongest near the top, gone toward the bottom.
  float glow = smoothstep(-0.3, 0.45, field) * (1.0 - smoothstep(0.2, 1.0, uv.y));
  float dither = (hash(xy) - 0.5) / 255.0;
  return half4(half3(col * glow * intensity + dither * step(0.001, glow)), 1.0);
}
`;

export type AuroraUniforms = {
  res: readonly [number, number];
  time: number;
  color1: readonly [number, number, number];
  color2: readonly [number, number, number];
  color3: readonly [number, number, number];
  intensity: number;
};

export const AURORA_UNIFORM_ORDER: readonly (keyof AuroraUniforms)[] = [
  'res',
  'time',
  'color1',
  'color2',
  'color3',
  'intensity',
];

/** Default palette: the app's amber, a deep teal and a violet. 0..1 RGB. */
export const AURORA_COLORS = {
  color1: [1.0, 0.62, 0.26],
  color2: [0.12, 0.5, 0.58],
  color3: [0.42, 0.24, 0.72],
} as const;

export function flattenAuroraUniforms(u: AuroraUniforms): number[] {
  const out: number[] = [];
  for (const key of AURORA_UNIFORM_ORDER) {
    const value = u[key];
    if (typeof value === 'number') out.push(value);
    else out.push(...value);
  }
  return out;
}

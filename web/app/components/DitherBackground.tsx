// SPDX-License-Identifier: Apache-2.0

"use client";

import { useEffect, useRef } from "react";

/**
 * The page field: fractal noise pushed through an ordered dither so the result
 * only ever contains two colours. The gradient exists as a pattern of hard
 * pixels rather than as a blend, which is the whole point — no anti-aliasing,
 * no intermediate tones, no soft glow.
 *
 * It replaces the 3D instrument that used to sit behind the marketing pages.
 */

const VERTEX = `
attribute vec2 a_position;
void main() { gl_Position = vec4(a_position, 0.0, 1.0); }
`;

// The 4x4 Bayer matrix is the dither. Comparing the noise against a threshold
// that varies per pixel is what turns a smooth field into a stable pattern
// instead of into noise-flecked banding.
const FRAGMENT = `
// highp, not mediump: the hash below multiplies by large constants and takes
// the fraction, which collapses to a constant at medium precision — the field
// then comes out a single flat colour.
precision highp float;

uniform vec2  u_resolution;
uniform float u_time;
uniform vec3  u_light;
uniform vec3  u_dark;
uniform float u_scale;

float hash(vec2 p) {
  p = fract(p * vec2(127.13, 311.7));
  p += dot(p, p.yx + 34.23);
  return fract(p.x * p.y);
}

float noise(vec2 p) {
  vec2 i = floor(p);
  vec2 f = fract(p);
  vec2 u = f * f * (3.0 - 2.0 * f);
  return mix(
    mix(hash(i), hash(i + vec2(1.0, 0.0)), u.x),
    mix(hash(i + vec2(0.0, 1.0)), hash(i + vec2(1.0, 1.0)), u.x),
    u.y
  );
}

/** Each octave halves in amplitude and doubles in frequency: soft shapes first,
 *  detail after, which is what makes the field read as cloud rather than static. */
float fbm(vec2 p) {
  float total = 0.0;
  float amplitude = 0.5;
  for (int i = 0; i < 5; i++) {
    total += noise(p) * amplitude;
    p *= 2.0;
    amplitude *= 0.5;
  }
  return total;
}

float bayer(vec2 pixel) {
  int x = int(mod(pixel.x, 4.0));
  int y = int(mod(pixel.y, 4.0));
  int index = x + y * 4;
  float m[16];
  m[0]=0.0;  m[1]=8.0;  m[2]=2.0;  m[3]=10.0;
  m[4]=12.0; m[5]=4.0;  m[6]=14.0; m[7]=6.0;
  m[8]=3.0;  m[9]=11.0; m[10]=1.0; m[11]=9.0;
  m[12]=15.0;m[13]=7.0; m[14]=13.0;m[15]=5.0;
  for (int i = 0; i < 16; i++) {
    if (i == index) return m[i] / 16.0;
  }
  return 0.0;
}

void main() {
  vec2 uv = gl_FragCoord.xy / u_resolution.xy;
  uv.x *= u_resolution.x / u_resolution.y;

  float field = fbm(uv * u_scale + vec2(u_time * 0.02, u_time * 0.013));
  // Lean the field toward light at the top so copy has somewhere quiet to sit.
  field = field * 0.85 + (1.0 - gl_FragCoord.y / u_resolution.y) * 0.3;

  float threshold = bayer(gl_FragCoord.xy);
  vec3 color = field > threshold ? u_dark : u_light;
  gl_FragColor = vec4(color, 1.0);
}
`;

function compile(gl: WebGLRenderingContext, type: number, source: string) {
  const shader = gl.createShader(type);
  if (!shader) return null;
  gl.shaderSource(shader, source);
  gl.compileShader(shader);
  if (!gl.getShaderParameter(shader, gl.COMPILE_STATUS)) {
    console.error("dither shader failed to compile:", gl.getShaderInfoLog(shader));
    gl.deleteShader(shader);
    return null;
  }
  return shader;
}

function rgb(hex: string): [number, number, number] {
  const n = parseInt(hex.replace("#", ""), 16);
  return [((n >> 16) & 255) / 255, ((n >> 8) & 255) / 255, (n & 255) / 255];
}

export function DitherBackground({
  light = "#ffffff",
  dark = "#5ea6e5",
  scale = 3,
  className = "",
}: {
  light?: string;
  dark?: string;
  scale?: number;
  className?: string;
}) {
  const ref = useRef<HTMLCanvasElement>(null);

  useEffect(() => {
    const canvas = ref.current;
    if (!canvas) return;
    const gl = canvas.getContext("webgl", { antialias: false, alpha: false });
    if (!gl) return;

    const vertex = compile(gl, gl.VERTEX_SHADER, VERTEX);
    const fragment = compile(gl, gl.FRAGMENT_SHADER, FRAGMENT);
    if (!vertex || !fragment) return;

    const program = gl.createProgram();
    if (!program) return;
    gl.attachShader(program, vertex);
    gl.attachShader(program, fragment);
    gl.linkProgram(program);
    if (!gl.getProgramParameter(program, gl.LINK_STATUS)) {
      console.error("dither program failed to link:", gl.getProgramInfoLog(program));
      return;
    }
    gl.useProgram(program);

    const buffer = gl.createBuffer();
    gl.bindBuffer(gl.ARRAY_BUFFER, buffer);
    gl.bufferData(
      gl.ARRAY_BUFFER,
      new Float32Array([-1, -1, 1, -1, -1, 1, -1, 1, 1, -1, 1, 1]),
      gl.STATIC_DRAW,
    );
    const position = gl.getAttribLocation(program, "a_position");
    gl.enableVertexAttribArray(position);
    gl.vertexAttribPointer(position, 2, gl.FLOAT, false, 0, 0);

    const uResolution = gl.getUniformLocation(program, "u_resolution");
    const uTime = gl.getUniformLocation(program, "u_time");
    gl.uniform3fv(gl.getUniformLocation(program, "u_light"), rgb(light));
    gl.uniform3fv(gl.getUniformLocation(program, "u_dark"), rgb(dark));
    gl.uniform1f(gl.getUniformLocation(program, "u_scale"), scale);

    // Rendered at CSS pixels, not device pixels: the dither grid is the point,
    // and a retina buffer would shrink the cells below where the pattern reads.
    //
    // The uniform is set on every call, not only when the size changed. A
    // uniform belongs to the program, not to the context, so a second program
    // on an already-correctly-sized canvas — which is exactly what React's
    // double-invoked effects produce in development — would otherwise keep
    // u_resolution at its default of zero, divide by it, and render a single
    // flat colour.
    const resize = () => {
      const width = Math.max(1, Math.floor(canvas.clientWidth));
      const height = Math.max(1, Math.floor(canvas.clientHeight));
      if (canvas.width !== width || canvas.height !== height) {
        canvas.width = width;
        canvas.height = height;
      }
      gl.viewport(0, 0, width, height);
      gl.uniform2f(uResolution, width, height);
    };
    resize();

    const still = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    let raf = 0;
    const start = performance.now();
    const draw = () => {
      resize();
      gl.uniform1f(uTime, still ? 0 : (performance.now() - start) / 1000);
      gl.drawArrays(gl.TRIANGLES, 0, 6);
      if (!still) raf = requestAnimationFrame(draw);
    };
    draw();

    const observer = new ResizeObserver(() => {
      if (still) draw();
    });
    observer.observe(canvas);

    return () => {
      cancelAnimationFrame(raf);
      observer.disconnect();
      gl.deleteProgram(program);
      gl.deleteShader(vertex);
      gl.deleteShader(fragment);
      gl.deleteBuffer(buffer);
    };
  }, [light, dark, scale]);

  return (
    <div aria-hidden className={`pointer-events-none sticky top-0 z-0 h-0 ${className}`}>
      <canvas ref={ref} className="block h-screen w-full" />
    </div>
  );
}

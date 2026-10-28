export const orbVertexShader = /* glsl */ `
  varying vec2 vUv;
  void main() {
    vUv = uv;
    gl_Position = vec4(position.xy, 0.0, 1.0);
  }
`;

export const orbFragmentShader = /* glsl */ `
  precision highp float;
  varying vec2 vUv;
  uniform float uTime;
  uniform float uEnergy;
  uniform float uAspect;
  uniform vec3 uCyan;
  uniform vec3 uEmerald;
  uniform vec3 uLime;

  mat2 rotate(float a) {
    return mat2(cos(a), -sin(a), sin(a), cos(a));
  }

  // A continuous soft band, with no high-frequency noise or time quantization.
  float ribbon(float distance, float width) {
    float x = distance / width;
    return exp(-x * x);
  }

  void main() {
    vec2 p = (vUv - 0.5) * 2.0;
    p.x *= uAspect;
    float t = uTime;
    float energy = clamp(uEnergy, 0.0, 1.0);
    float radius = 0.72 + 0.008 * energy * sin(t * 1.1);
    float radial = length(p);
    float antialias = max(fwidth(radial), 0.002);
    float silhouette = 1.0 - smoothstep(radius - antialias, radius + antialias, radial);
    float halo = ribbon(radial - radius, 0.075);

    vec2 q = p / radius;
    float z = sqrt(max(0.0, 1.0 - dot(q, q)));
    vec3 sphere = vec3(q, z);
    sphere.xz = rotate(0.15 + 0.16 * sin(t * 0.24)) * sphere.xz;
    sphere.xy = rotate(-0.38 + 0.11 * sin(t * 0.19)) * sphere.xy;

    // Three broad translucent folds move smoothly across the curved surface.
    float flow = sin(sphere.x * 2.4 + t * 0.43) * (0.16 + 0.09 * energy)
      + sin(sphere.z * 2.8 - t * 0.31) * 0.10;
    float first = ribbon(sphere.y + flow + sphere.x * 0.15 - 0.10, 0.16 + energy * 0.025);
    float second = ribbon(sphere.y - flow * 0.65 - sphere.x * 0.20 + 0.34, 0.22);
    float third = ribbon(sphere.x + sphere.y * 0.58 + 0.36 + 0.10 * sin(t * 0.35), 0.30);

    float rim = pow(1.0 - z, 2.5);
    float colorMix = smoothstep(-0.75, 0.75, sphere.x - sphere.y * 0.35);
    vec3 base = mix(uEmerald, uCyan, colorMix);
    vec3 color = base * (0.055 + 0.065 * z);
    color += mix(uEmerald, uCyan, 0.65) * first * (0.52 + 0.18 * energy);
    color += mix(uEmerald, uCyan, 0.22) * second * 0.30;
    color += mix(uEmerald, uLime, 0.42) * third * 0.16;
    color += base * rim * 0.27;

    // A broad central sheen and a soft highlight give the orb a glass-like finish.
    float sheen = exp(-dot(q - vec2(-0.18, 0.16), q - vec2(-0.18, 0.16)) * 3.4);
    float highlight = exp(-dot(q - vec2(-0.34, 0.48), q - vec2(-0.34, 0.48)) * 32.0);
    color += mix(uCyan, vec3(1.0), 0.4) * sheen * 0.09;
    color += vec3(0.14, 0.22, 0.21) * highlight;

    vec3 haloColor = mix(uEmerald, uCyan, clamp(0.5 + 0.5 * p.x, 0.0, 1.0));
    color = mix(haloColor * 0.28, color, silhouette);
    float alpha = silhouette * (0.82 + 0.12 * rim)
      + (1.0 - silhouette) * halo * (0.16 + 0.025 * energy);
    gl_FragColor = vec4(color, alpha);
    #include <colorspace_fragment>
  }
`;

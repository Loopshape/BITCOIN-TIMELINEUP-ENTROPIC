/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
*/
const vs = `precision highp float;

in vec3 position;

uniform mat4 modelViewMatrix;
uniform mat4 projectionMatrix;

void main() {
  gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.);
}`;

const fs = `precision highp float;

out vec4 fragmentColor;

uniform vec2 resolution;
uniform float rand;
uniform float idleFactor;

// Hashing functions for procedural generation
float hash( float n ) { return fract(sin(n)*43758.5453); }

vec3 hash3( float n ) {
    return vec3(
      hash(n),
      hash(n + 7.345),
      hash(n - 4.234)
    );
}

// Function to draw a blurred circle
float circle(vec2 uv, vec2 pos, float radius, float blur) {
    float d = length(uv - pos);
    return smoothstep(radius, radius - blur, d);
}

void main() {
  float aspectRatio = resolution.x / resolution.y; 
  // Use resolution.y to keep circles round regardless of aspect ratio
  vec2 uv = gl_FragCoord.xy / resolution.y;
  uv.x -= (aspectRatio - 1.0) / 2.0;

  vec3 finalColor = vec3(0.0);
  
  // Background gradient
  vec3 from = vec3(0.5, 0.1, 0.1);
  vec3 to = vec3(0.1, 0.0, 0.0);
  finalColor = mix(from, to, uv.y) + .02 * hash(uv.x + uv.y*100.0);

  // Bokeh circles
  for (int i = 0; i < 30; i++) {
      float i_float = float(i);
      vec3 h = hash3(i_float);
      vec2 pos = vec2(h.x * aspectRatio, h.y);
      float radius = mix(0.05, 0.25, h.z);
      vec3 color = mix(vec3(1.0, 0.2, 0.1), vec3(1.0, 0.8, 0.2), h.y);
      
      finalColor += color * circle(uv, pos, radius, radius * 0.8) * 0.5;
  }
  
  // Glitter
  float glitter = pow(hash(gl_FragCoord.x * 123.4 + gl_FragCoord.y * 321.6 + rand), 100.0) * 0.5;
  finalColor += vec3(glitter);

  fragmentColor = vec4(finalColor * idleFactor, 1.0);
}
`;

export {fs, vs};

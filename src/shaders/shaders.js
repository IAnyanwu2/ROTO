// shaders.js

export const vertexShader = `
  varying vec2 vertexUV;
  varying vec3 vertexNormal;

  void main() {
      vertexUV = uv;
      vertexNormal = normalize(normalMatrix * normal);
      gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
  }
`;

export const fragmentShader = `
  uniform sampler2D globeTexture;

  varying vec2 vertexUV;
  varying vec3 vertexNormal;

  void main() {
      float intensity = 1.05 - dot(normalize(vertexNormal), vec3(0.0, 0.0, 1.0));
      vec3 atmosphere = vec3(0.3, 0.6, 1.0) * pow(intensity, 1.5);
      vec3 textureColor = texture2D(globeTexture, vertexUV).xyz;
      
      gl_FragColor = vec4(atmosphere + textureColor, 1.0);
  }
`;

export const atmosphereVertexShader = `
  varying vec3 vertexNormal;

  void main() {
      vertexNormal = normalize(normalMatrix * normal);
      gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
  }
`;

export const atmosphereFragmentShader = `
  varying vec3 vertexNormal;

  void main() {
      float intensity = pow(0.77 - dot(vertexNormal, vec3(0.0, 0.0, 1.0)), 2.0);
      gl_FragColor = vec4(0.04, 0.56, 0.86, 1.0) * intensity;
  }
`;

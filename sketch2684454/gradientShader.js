class GradientShader {
  constructor(vertShader, fragShader, colors = null) {
    this.shader = createShader(vertShader, fragShader);
    const defaultColors = [
      [1.0, 0.0, 0.0],
      [0.0, 1.0, 0.0],
      [0.0, 0.0, 1.0],
    ];
    this.config = {
      gradientType: 0,
      animationType: 0,
      speed: 0.0,
      angle: 0,
      scale: 1.0,
      colors: colors || defaultColors,
    };
  }
  
  apply() {
    shader(this.shader);
    this.updateUniforms();
  }
  
  updateUniforms() {
    const currentTime = millis() / 1000.0;
    this.shader.setUniform('uTime', this.config.speed === 0 ? 0 : currentTime);
    this.shader.setUniform('uGradientType', this.config.gradientType);
    this.shader.setUniform('uAnimationType', this.config.animationType);
    this.shader.setUniform('uSpeed', this.config.speed);
    this.shader.setUniform('uAngle', this.config.angle);
    this.shader.setUniform('uScale', this.config.scale);
    this.shader.setUniform('uColorCount', this.config.colors.length);
    for (let i = 0; i < Math.min(16, this.config.colors.length); i++) {
      this.shader.setUniform(`uColor${i}`, this.config.colors[i]);
    }
  }
  
  setGradientType(type) {
    this.config.gradientType = type;
  }
  
  setAnimationType(type) {
    this.config.animationType = type;
  }
  
  setColors(...colors) {
    if (Array.isArray(colors[0])) {
      this.config.colors = colors[0].map(color => {
        if (typeof color === 'string' && color.startsWith('#')) {
          const c = window.color(color);
          return [red(c) / 255, green(c) / 255, blue(c) / 255];
        }
        return color;
      });
    } else {
      this.config.colors = colors.map(color => {
        if (typeof color === 'string' && color.startsWith('#')) {
          const c = window.color(color);
          return [red(c) / 255, green(c) / 255, blue(c) / 255];
        }
        return color;
      });
    }
  }
  
  setColorsFromP5(...p5Colors) {
    this.config.colors = p5Colors.map(c => [
      red(c) / 255,
      green(c) / 255,
      blue(c) / 255
    ]);
  }
  
  setColorsFromPalette(palette) {
    this.config.colors = palette.colors.map(hexColor => {
      const c = color(hexColor);
      return [red(c) / 255, green(c) / 255, blue(c) / 255];
    });
  }
  
  setSpeed(speed) {
    this.config.speed = speed;
  }
  
  setAngle(angle) {
    this.config.angle = angle;
  }
  
  setScale(scale) {
    this.config.scale = scale;
  }

  setRandomSpeed(min = -10, max = 10) {
    this.config.speed = random(min, max);
  }
}

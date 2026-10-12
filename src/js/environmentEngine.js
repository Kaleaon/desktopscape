/**
 * Peoria Environment & Weather System.
 * Manages solar time of day, dynamic weather effects (rain, snow, fog),
 * Peoria Illinois River winter ice accumulation, and night city lighting.
 */

export class EnvironmentEngine {
  constructor(splatRenderer, containerElement) {
    this.splatRenderer = splatRenderer;
    this.container = containerElement;

    // Environmental state
    this.timeOfDay = 12.0; // 12:00 PM default
    this.autoSyncClock = false;
    
    this.weather = {
      preset: 'clear',      // 'clear', 'rain', 'snow', 'winter-ice', 'fog'
      temperature: 72,      // Fahrenheit
      winterIce: 0.0,       // 0.0 = open water, 1.0 = solid frozen river sheet
      rainIntensity: 0.0,   // 0.0 - 1.0
      snowIntensity: 0.0,   // 0.0 - 1.0
      fogDensity: 0.0,      // 0.0 - 1.0
      windSpeed: 8.5        // mph
    };

    // Particle Overlay Canvas
    this.particleCanvas = document.createElement('canvas');
    this.particleCanvas.id = 'weather-particle-canvas';
    this.particleCanvas.style.position = 'absolute';
    this.particleCanvas.style.top = '0';
    this.particleCanvas.style.left = '0';
    this.particleCanvas.style.width = '100%';
    this.particleCanvas.style.height = '100%';
    this.particleCanvas.style.pointerEvents = 'none';
    this.particleCanvas.style.zIndex = '5';
    this.container.appendChild(this.particleCanvas);

    this.ctx = this.particleCanvas.getContext('2d');
    this.particles = [];

    this.resizeCanvas();
    window.addEventListener('resize', () => this.resizeCanvas());

    this.initParticles();
  }

  resizeCanvas() {
    this.particleCanvas.width = this.container.clientWidth || window.innerWidth;
    this.particleCanvas.height = this.container.clientHeight || window.innerHeight;
  }

  setTimeOfDay(hours) {
    this.timeOfDay = Math.max(0, Math.min(24, hours));
    this.updateLighting();
  }

  setWeather(weatherParams) {
    if (weatherParams.preset) {
      this.weather.preset = weatherParams.preset;
      this.applyWeatherPreset(weatherParams.preset);
    }

    if (weatherParams.temp !== undefined) {
      this.weather.temperature = weatherParams.temp;
      // Temperature driven ice calculation if not manually forced
      if (weatherParams.ice === undefined) {
        this.updateWinterIceFromTemperature();
      }
    }

    if (weatherParams.ice !== undefined) {
      this.weather.winterIce = Math.max(0, Math.min(1, weatherParams.ice));
    }

    this.initParticles();
    this.updateLighting();
  }

  applyWeatherPreset(preset) {
    switch (preset) {
      case 'clear':
        this.weather.rainIntensity = 0.0;
        this.weather.snowIntensity = 0.0;
        this.weather.fogDensity = 0.0;
        this.weather.winterIce = 0.0;
        this.weather.temperature = 72;
        break;

      case 'rain':
        this.weather.rainIntensity = 0.8;
        this.weather.snowIntensity = 0.0;
        this.weather.fogDensity = 0.2;
        this.weather.winterIce = 0.0;
        this.weather.temperature = 52;
        break;

      case 'snow':
        this.weather.rainIntensity = 0.0;
        this.weather.snowIntensity = 0.9;
        this.weather.fogDensity = 0.4;
        this.weather.winterIce = 0.75;
        this.weather.temperature = 18;
        break;

      case 'winter-ice':
        this.weather.rainIntensity = 0.0;
        this.weather.snowIntensity = 0.3;
        this.weather.fogDensity = 0.5;
        this.weather.winterIce = 1.0; // 100% Frozen Illinois River
        this.weather.temperature = -10;
        break;

      case 'fog':
        this.weather.rainIntensity = 0.0;
        this.weather.snowIntensity = 0.0;
        this.weather.fogDensity = 0.85;
        this.weather.temperature = 45;
        break;
    }
  }

  updateWinterIceFromTemperature() {
    if (this.weather.temperature <= 32) {
      // Ice freezes progressively as temperature drops below 32°F down to -20°F
      const freezeFactor = (32 - this.weather.temperature) / 52.0;
      this.weather.winterIce = Math.min(1.0, Math.max(0.2, freezeFactor));
    } else {
      this.weather.winterIce = 0.0;
    }
  }

  initParticles() {
    this.particles = [];
    const width = this.particleCanvas.width;
    const height = this.particleCanvas.height;

    if (this.weather.rainIntensity > 0) {
      const count = Math.floor(this.weather.rainIntensity * 300);
      for (let i = 0; i < count; i++) {
        this.particles.push({
          type: 'rain',
          x: Math.random() * width,
          y: Math.random() * height,
          length: 15 + Math.random() * 20,
          speed: 12 + Math.random() * 10,
          opacity: 0.4 + Math.random() * 0.4
        });
      }
    } else if (this.weather.snowIntensity > 0) {
      const count = Math.floor(this.weather.snowIntensity * 250);
      for (let i = 0; i < count; i++) {
        this.particles.push({
          type: 'snow',
          x: Math.random() * width,
          y: Math.random() * height,
          radius: 1.5 + Math.random() * 3.5,
          speedY: 1.0 + Math.random() * 2.5,
          speedX: (Math.random() - 0.5) * 1.5,
          opacity: 0.5 + Math.random() * 0.5
        });
      }
    }
  }

  updateLighting() {
    if (this.autoSyncClock) {
      const now = new Date();
      this.timeOfDay = now.getHours() + (now.getMinutes() / 60.0);
    }

    if (this.splatRenderer) {
      this.splatRenderer.updateLighting(this.timeOfDay, this.weather);
    }
  }

  update(timeDelta = 0.016) {
    if (this.autoSyncClock) {
      this.updateLighting();
    }

    this.renderParticles(timeDelta);
  }

  renderParticles(timeDelta) {
    const width = this.particleCanvas.width;
    const height = this.particleCanvas.height;

    this.ctx.clearRect(0, 0, width, height);

    // Fog & Haze Overlay over Peoria Illinois River Basin
    if (this.weather.fogDensity > 0) {
      const fogGrad = this.ctx.createLinearGradient(0, height * 0.3, 0, height);
      const isNight = this.timeOfDay < 6.0 || this.timeOfDay > 19.5;
      const fogColor = isNight ? `rgba(10, 20, 35, ${this.weather.fogDensity * 0.6})` : `rgba(220, 230, 240, ${this.weather.fogDensity * 0.45})`;

      fogGrad.addColorStop(0, 'rgba(0,0,0,0)');
      fogGrad.addColorStop(1, fogColor);
      this.ctx.fillStyle = fogGrad;
      this.ctx.fillRect(0, 0, width, height);
    }

    // Winter Frost on Screen Borders during heavy ice freeze
    if (this.weather.winterIce > 0.5) {
      const frostGrad = this.ctx.createRadialGradient(
        width / 2, height / 2, Math.min(width, height) * 0.3,
        width / 2, height / 2, Math.max(width, height) * 0.7
      );
      frostGrad.addColorStop(0, 'rgba(255,255,255,0)');
      frostGrad.addColorStop(1, `rgba(220,240,255,${(this.weather.winterIce - 0.5) * 0.5})`);
      this.ctx.fillStyle = frostGrad;
      this.ctx.fillRect(0, 0, width, height);
    }

    // Render Weather Particles
    this.particles.forEach(p => {
      if (p.type === 'rain') {
        this.ctx.beginPath();
        this.ctx.strokeStyle = `rgba(180, 210, 245, ${p.opacity})`;
        this.ctx.lineWidth = 1.2;
        this.ctx.moveTo(p.x, p.y);
        this.ctx.lineTo(p.x - 2, p.y + p.length);
        this.ctx.stroke();

        p.y += p.speed;
        p.x -= 2;

        if (p.y > height) {
          p.y = -p.length;
          p.x = Math.random() * width;
        }
      } else if (p.type === 'snow') {
        this.ctx.beginPath();
        this.ctx.fillStyle = `rgba(255, 255, 255, ${p.opacity})`;
        this.ctx.arc(p.x, p.y, p.radius, 0, Math.PI * 2);
        this.ctx.fill();

        p.y += p.speedY;
        p.x += p.speedX + Math.sin(p.y * 0.02) * 0.5;

        if (p.y > height) {
          p.y = -p.radius;
          p.x = Math.random() * width;
        }
      }
    });
  }
}

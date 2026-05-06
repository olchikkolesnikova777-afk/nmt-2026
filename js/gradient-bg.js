// Animated radial gradient background — supports dark & light themes
(function () {
  const el = document.getElementById('gradient-bg');
  if (!el) return;

  const THEMES = {
    dark: {
      colors: ['#09090B','#0f0728','#1e1252','#3730a3','#6366f1','#1a0a3d','#09090B'],
      stops:  [28, 42, 55, 66, 78, 90, 100],
    },
    light: {
      colors: ['#FDF2F6','#fce7ef','#f9cede','#f0a0bc','#E0729A','#fce7ef','#FDF2F6'],
      stops:  [28, 42, 55, 66, 78, 90, 100],
    },
  };

  const startingGap    = 120;
  const breathingRange = 6;
  const animationSpeed = 0.015;
  const topOffset      = 10;

  let width     = startingGap;
  let direction = 1;
  let currentTheme = document.documentElement.getAttribute('data-theme') || 'dark';

  function buildGradient(w) {
    const { colors, stops } = THEMES[currentTheme] || THEMES.dark;
    const s = stops.map((stop, i) => `${colors[i]} ${stop}%`).join(', ');
    return `radial-gradient(${w}% ${w + topOffset}% at 50% 20%, ${s})`;
  }

  function animate() {
    if (width >= startingGap + breathingRange) direction = -1;
    if (width <= startingGap - breathingRange) direction =  1;
    width += direction * animationSpeed;
    el.style.background = buildGradient(width);
    requestAnimationFrame(animate);
  }

  // Entrance animation
  el.style.opacity   = '0';
  el.style.transform = 'scale(1.5)';
  el.style.background = buildGradient(width);
  requestAnimationFrame(animate);

  let start = null;
  const duration = 1800;
  function entrance(ts) {
    if (!start) start = ts;
    const p = Math.min((ts - start) / duration, 1);
    const eased = p < 0.5 ? 2 * p * p : -1 + (4 - 2 * p) * p;
    el.style.opacity   = eased;
    el.style.transform = `scale(${1.5 - 0.5 * eased})`;
    if (p < 1) requestAnimationFrame(entrance);
    else { el.style.transform = 'scale(1)'; el.style.opacity = '1'; }
  }
  requestAnimationFrame(entrance);

  // Public API for theme switching
  window.updateGradientTheme = function(theme) {
    currentTheme = theme;
  };
})();

// Visualization registry — lazy-loaded modules
export const visualizations = {
  murmuration: { name: 'Murmuration',      module: () => import('./murmuration.js') },
  lorenz:      { name: 'Lorenz Attractor',  module: () => import('./lorenz.js') },
  cymatics:    { name: '3D Cymatics',       module: () => import('./cymatics.js') },
  toroidal:    { name: 'Toroidal Vortex',   module: () => import('./toroidal-vortex.js') },
  dna:         { name: 'DNA Helix',         module: () => import('./dna-helix.js') },
};

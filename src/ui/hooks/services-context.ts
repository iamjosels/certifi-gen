import { createContext, useContext } from 'react';
import type { AppServices } from '../../application/services';

export const ServicesContext = createContext<AppServices | null>(null);

/** Adapters created by the composition root (engine, parsers, fonts, rasterizer…). */
export function useServices(): AppServices {
  const services = useContext(ServicesContext);
  if (!services) throw new Error('useServices must be used inside <ServicesProvider>');
  return services;
}

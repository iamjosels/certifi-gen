import type { ReactNode } from 'react';
import type { AppServices } from '../../application/services';
import { ServicesContext } from '../hooks/services-context';

export function ServicesProvider({
  services,
  children,
}: {
  services: AppServices;
  children: ReactNode;
}) {
  return <ServicesContext.Provider value={services}>{children}</ServicesContext.Provider>;
}

/* oxlint-disable react/only-export-components */
import {
  createContext,
  createElement,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
  type AnchorHTMLAttributes,
  type MouseEvent,
  type ReactNode,
  type Ref,
} from 'react';
import { Center } from '@astryxdesign/core/Center';
import { Spinner } from '@astryxdesign/core/Spinner';
import { Text } from '@astryxdesign/core/Text';
import { VStack } from '@astryxdesign/core/VStack';
import { useAuth } from '../context/AuthContext';
import type { UserRole } from '../types/nexus';

export const RoutePath = {
  HOME: '/',
  TRACK: '/track',
  LOGIN: '/login',

  ADMIN: '/admin',
  ADMIN_PLANS: '/admin/plans',
  ADMIN_PRODUCTS: '/admin/products',
  ADMIN_CITIES: '/admin/cities',
  ADMIN_EMPLOYEES: '/admin/employees',
  ADMIN_CUSTOMERS: '/admin/customers',

  RETAIL: '/retail',
  RETAIL_CUSTOMERS: '/retail/customers',
  RETAIL_REQUESTS: '/retail/requests',
  RETAIL_ORDERS: '/retail/orders',

  TECHNICAL: '/technical',
  TECHNICAL_ASSESSMENTS: '/technical/assessments',
  TECHNICAL_CONNECTIONS: '/technical/connections',
  TECHNICAL_ORDERS: '/technical/orders',

  BILLING: '/billing',
  BILLING_ACCOUNTS: '/billing/accounts',
  BILLING_PAYMENTS: '/billing/payments',
  BILLING_REGISTRY: '/billing/registry',
} as const;

export type RoutePathValue = (typeof RoutePath)[keyof typeof RoutePath];

export function normalizePath(rawPath: string): string {
  const pathname = rawPath.split('?')[0]?.split('#')[0] || '/';
  if (pathname.length > 1 && pathname.endsWith('/')) {
    return pathname.slice(0, -1);
  }
  return pathname || '/';
}

export function getDefaultRouteForRole(role: UserRole): string {
  switch (role) {
    case 'Admin':
      return RoutePath.ADMIN_PLANS;
    case 'Retail':
      return RoutePath.RETAIL_CUSTOMERS;
    case 'Technical':
      return RoutePath.TECHNICAL_ASSESSMENTS;
    case 'Billing':
      return RoutePath.BILLING_ACCOUNTS;
  }
}

export interface RouterContextValue {
  path: string;
  navigate: (to: string) => void;
  replace: (to: string) => void;
}

const RouterContext = createContext<RouterContextValue | null>(null);

export function RouterProvider({ children }: { children: ReactNode }) {
  const [path, setPath] = useState<string>(() => normalizePath(window.location.pathname));

  useEffect(() => {
    const onPopState = () => {
      setPath(normalizePath(window.location.pathname));
    };
    window.addEventListener('popstate', onPopState);
    return () => window.removeEventListener('popstate', onPopState);
  }, []);

  const navigate = useCallback((to: string) => {
    const next = normalizePath(to);
    if (normalizePath(window.location.pathname) !== next) {
      window.history.pushState(null, '', next);
    }
    setPath(next);
    window.scrollTo(0, 0);
  }, []);

  const replace = useCallback((to: string) => {
    const next = normalizePath(to);
    if (normalizePath(window.location.pathname) !== next) {
      window.history.replaceState(null, '', next);
    }
    setPath(next);
  }, []);

  const value = useMemo<RouterContextValue>(
    () => ({ path, navigate, replace }),
    [navigate, path, replace],
  );

  return <RouterContext.Provider value={value}>{children}</RouterContext.Provider>;
}

export function useRouter(): RouterContextValue {
  const ctx = useContext(RouterContext);
  if (!ctx) {
    throw new Error('useRouter must be used within RouterProvider');
  }
  return ctx;
}

export interface RouterLinkProps extends AnchorHTMLAttributes<HTMLAnchorElement> {
  href?: string;
  to?: string;
  ref?: Ref<HTMLAnchorElement>;
}

function isModifiedEvent(e: MouseEvent<HTMLAnchorElement>): boolean {
  return e.metaKey || e.ctrlKey || e.shiftKey || e.altKey || e.button !== 0;
}

function isInternalPath(href: string): boolean {
  return href.startsWith('/') && !href.startsWith('//');
}

export function RouterLink({
  href,
  to,
  onClick,
  target,
  download,
  rel,
  children,
  ...rest
}: RouterLinkProps) {
  const { navigate } = useRouter();
  const destination = href ?? to;

  const handleClick = (e: MouseEvent<HTMLAnchorElement>) => {
    onClick?.(e);
    if (
      e.defaultPrevented ||
      isModifiedEvent(e) ||
      (target && target !== '_self') ||
      Boolean(download) ||
      Boolean(rel?.split(/\s+/).includes('external')) ||
      typeof destination !== 'string' ||
      !isInternalPath(destination)
    ) {
      return;
    }
    e.preventDefault();
    navigate(destination);
  };

  return createElement(
    'a',
    {
      ...rest,
      href: destination,
      target,
      download,
      rel,
      onClick: handleClick,
    },
    children,
  );
}

export function RoleGuard({
  allowedRole,
  accessDenied,
  children,
}: {
  allowedRole: UserRole;
  accessDenied: (currentRole: UserRole) => ReactNode;
  children: ReactNode;
}) {
  const { session, isBootstrapping } = useAuth();
  const { replace } = useRouter();
  const authenticatedRole = session?.username && session?.role ? session.role : null;

  useEffect(() => {
    if (!isBootstrapping && !authenticatedRole) {
      replace(RoutePath.LOGIN);
    }
  }, [authenticatedRole, isBootstrapping, replace]);

  if (isBootstrapping) {
    return (
      <Center padding={8}>
        <VStack gap={3} hAlign="center">
          <Spinner size="lg" label="Checking session..." />
          <Text type="supporting">Verifying staff session...</Text>
        </VStack>
      </Center>
    );
  }

  if (!authenticatedRole) {
    return null;
  }

  if (authenticatedRole !== allowedRole) {
    return <>{accessDenied(authenticatedRole)}</>;
  }

  return <>{children}</>;
}

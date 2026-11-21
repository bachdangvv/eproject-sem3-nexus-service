/**
 * Root application shell, sign-in view, role-based navigation layout, and route dispatcher.
 */
import { useEffect, useState, type FormEvent } from 'react';
import { AppShell } from '@astryxdesign/core/AppShell';
import { AspectRatio } from '@astryxdesign/core/AspectRatio';
import { Button } from '@astryxdesign/core/Button';
import { Card } from '@astryxdesign/core/Card';
import { Center } from '@astryxdesign/core/Center';
import { EmptyState } from '@astryxdesign/core/EmptyState';
import { FormLayout } from '@astryxdesign/core/FormLayout';
import { Grid } from '@astryxdesign/core/Grid';
import { HStack } from '@astryxdesign/core/HStack';
import { Heading } from '@astryxdesign/core/Heading';
import { Icon } from '@astryxdesign/core/Icon';
import { Link, LinkProvider } from '@astryxdesign/core/Link';
import { Section } from '@astryxdesign/core/Section';
import {
  SideNav,
  SideNavCollapseButton,
  SideNavItem,
  SideNavSection,
} from '@astryxdesign/core/SideNav';
import { StackItem } from '@astryxdesign/core/Stack';
import { Text } from '@astryxdesign/core/Text';
import { TextInput } from '@astryxdesign/core/TextInput';
import { ToastViewport, useToast } from '@astryxdesign/core/Toast';
import { Token } from '@astryxdesign/core/Token';
import { TopNav, TopNavHeading, TopNavItem } from '@astryxdesign/core/TopNav';
import { VStack } from '@astryxdesign/core/VStack';
import { Theme } from '@astryxdesign/core/theme';
import { defaultThemeSlug, themes } from './astryx-themes';
import nexusLoginIllustration from './assets/nexus-login-illustration.png';
import { ApiErrorBanner, OfflineBanner } from './components/StatusViews';
import { AuthProvider, useAuth } from './context/AuthContext';
import { HomePage } from './pages/HomePage';
import { AdminPortal } from './pages/admin/AdminPortal';
import { RegisterPage } from './pages/auth/RegisterPage';
import { BillingPortal } from './pages/billing/BillingPortal';
import { CustomerPortal } from './pages/customer/CustomerPortal';
import { RetailPortal } from './pages/retail/RetailPortal';
import { TechnicalPortal } from './pages/technical/TechnicalPortal';
import {
  RoleGuard,
  RoutePath,
  RouterLink,
  RouterProvider,
  getDefaultRouteForRole,
  useRouter,
} from './router/router';
import type { UserRole } from './types/nexus';

function AccessDeniedView({ currentRole }: { currentRole: UserRole }) {
  const { logout } = useAuth();
  const { navigate } = useRouter();
  const workspaceHref = getDefaultRouteForRole(currentRole);

  return (
    <Card padding={6}>
      <EmptyState
        title="Access Denied"
        description={`You are currently signed in as ${currentRole}. This route is restricted to a different portal role.`}
        icon={<Icon icon="warning" />}
        actions={
          <HStack gap={2} wrap="wrap">
            <Button
              variant="primary"
              label={`Go to ${currentRole} Workspace`}
              href={workspaceHref}
            />
            <Button
              variant="secondary"
              label="Sign Out"
              onClick={async () => {
                await logout();
                navigate(RoutePath.LOGIN);
              }}
            />
          </HStack>
        }
      />
    </Card>
  );
}

function NotFoundView() {
  const { session } = useAuth();
  const authenticatedRole = session?.username && session?.role ? session.role : null;

  return (
    <Card padding={6}>
      <EmptyState
        title="Page Not Found"
        description="The requested Nexus page does not exist. Return to the home page or your workspace."
        icon={<Icon icon="info" />}
        actions={
          <HStack gap={2} wrap="wrap">
            <Button variant="primary" label="Go to Home" href={RoutePath.HOME} />
            {authenticatedRole && (
              <Button
                variant="secondary"
                label={`Open ${authenticatedRole} Workspace`}
                href={getDefaultRouteForRole(authenticatedRole)}
              />
            )}
          </HStack>
        }
      />
    </Card>
  );
}

function SignInPage() {
  const { session, isBootstrapping, login } = useAuth();
  const { replace } = useRouter();
  const toast = useToast();

  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [localError, setLocalError] = useState<string | null>(null);

  const authenticatedRole = session?.username && session?.role ? session.role : null;

  useEffect(() => {
    if (!isBootstrapping && authenticatedRole) {
      replace(getDefaultRouteForRole(authenticatedRole));
    }
  }, [authenticatedRole, isBootstrapping, replace]);

  const handleSubmit = async (e: FormEvent) => {
    e.preventDefault();
    if (submitting) return;
    setLocalError(null);
    const cleanUser = username.trim();
    if (!cleanUser || !password) {
      setLocalError('Enter both username and password.');
      return;
    }
    setSubmitting(true);
    try {
      const nextSession = await login(cleanUser, password);
      if (nextSession?.role) {
        toast({
          body: `Signed in as ${nextSession.displayName || cleanUser} (${nextSession.role})`,
        });
        replace(getDefaultRouteForRole(nextSession.role));
      }
    } catch (err) {
      setLocalError(
        err instanceof Error ? err.message : 'Sign in failed. Verify your credentials.',
      );
    } finally {
      setSubmitting(false);
    }
  };

  const fillDemoCredentials = (demoUsername: string) => {
    setUsername(demoUsername);
    setPassword('Nexus-Demo-2026!');
    setLocalError(null);
  };

  return (
    <Grid columns={{ minWidth: 320, max: 2 }} gap={0} width="100%" minHeight="100%">
      <Section variant="section" padding={0} width="100%" height="100%" minHeight="100%">
        <VStack height="100%" minHeight="100%" gap={0}>
          <Section variant="transparent" paddingBlock={4} paddingInline={2} width="100%">
            <HStack hAlign="start" vAlign="center">
              <TopNavHeading heading="▲ Nexus" headingHref={RoutePath.HOME} />
            </HStack>
          </Section>

          <StackItem size="fill">
            <Center width="100%" height="100%" paddingInline={6} paddingBlock={8}>
              <VStack gap={5} width="100%" maxWidth={380}>
                <VStack gap={1.5}>
                  <Heading level={1} type="display-3">
                    Hey, welcome back
                  </Heading>
                  <Text type="supporting">
                    Good to see you again — sign in to Nexus Service.
                  </Text>
                </VStack>

                <ApiErrorBanner
                  title="Authentication failed"
                  error={localError}
                  onDismiss={() => setLocalError(null)}
                />

                <form onSubmit={handleSubmit}>
                  <FormLayout>
                    <TextInput
                      label="Username"
                      htmlName="username"
                      autoComplete="username"
                      value={username}
                      onChange={setUsername}
                      placeholder="e.g. customer.demo or retail.demo"
                      isRequired
                    />
                    <TextInput
                      label="Password"
                      htmlName="password"
                      autoComplete="current-password"
                      type="password"
                      value={password}
                      onChange={setPassword}
                      placeholder="Enter your password"
                      isRequired
                    />
                    <HStack hAlign="between" vAlign="center" gap={3} wrap="wrap">
                      <Button
                        type="submit"
                        variant="primary"
                        label="Sign in"
                        isLoading={submitting}
                      />
                      <HStack gap={3} vAlign="center" wrap="wrap">
                        <Link href={RoutePath.REGISTER} type="supporting" color="primary" hasUnderline>
                          Create Customer Account
                        </Link>
                        <Link href={RoutePath.HOME} type="supporting" color="secondary" hasUnderline>
                          Back to Home
                        </Link>
                      </HStack>
                    </HStack>
                  </FormLayout>
                </form>

                <Section variant="muted" padding={3}>
                  <VStack gap={2}>
                    <Text type="eyebrow" display="block">
                      DEMO QUICK-FILL
                    </Text>
                    <HStack gap={2} wrap="wrap">
                      <Button
                        size="sm"
                        variant="secondary"
                        label="Fill customer.demo"
                        onClick={() => fillDemoCredentials('customer.demo')}
                      />
                      <Button
                        size="sm"
                        variant="ghost"
                        label="admin.demo"
                        onClick={() => fillDemoCredentials('admin.demo')}
                      />
                      <Button
                        size="sm"
                        variant="ghost"
                        label="retail.demo"
                        onClick={() => fillDemoCredentials('retail.demo')}
                      />
                      <Button
                        size="sm"
                        variant="ghost"
                        label="technical.demo"
                        onClick={() => fillDemoCredentials('technical.demo')}
                      />
                      <Button
                        size="sm"
                        variant="ghost"
                        label="billing.demo"
                        onClick={() => fillDemoCredentials('billing.demo')}
                      />
                    </HStack>
                  </VStack>
                </Section>
              </VStack>
            </Center>
          </StackItem>
        </VStack>
      </Section>

      <Section variant="transparent" padding={4} width="100%" height="100%" minHeight="100%">
        <Center width="100%" height="100%" padding={4}>
          <Section variant="transparent" padding={0} width="100%" maxWidth={560}>
            <AspectRatio ratio={1} fit="contain">
              <img
                src={nexusLoginIllustration}
                alt="Minimalist monochrome illustration of a Nexus Service technician connecting network infrastructure"
              />
            </AspectRatio>
          </Section>
        </Center>
      </Section>
    </Grid>
  );
}

function NexusAppContent() {
  const { session, backendOffline, logout, refreshSession } = useAuth();
  const { path, navigate } = useRouter();
  const toast = useToast();
  const [isSidebarCollapsed, setIsSidebarCollapsed] = useState(true);

  const authenticatedRole = session?.username && session?.role ? session.role : null;
  const isAuthRoute = path === RoutePath.LOGIN || path === RoutePath.REGISTER;
  const isWorkspaceRoute =
    path.startsWith('/admin') ||
    path.startsWith('/retail') ||
    path.startsWith('/technical') ||
    path.startsWith('/billing') ||
    path.startsWith('/customer');
  const isInOwnWorkspace = Boolean(
    authenticatedRole && path.startsWith(`/${authenticatedRole.toLowerCase()}`),
  );
  const showSideNav = Boolean(authenticatedRole) && isWorkspaceRoute;
  const sidebarTitle =
    authenticatedRole === 'Admin'
      ? '▲ ADMIN OPERATIONS'
      : authenticatedRole === 'Retail'
        ? '▲ RETAIL OUTLET'
        : authenticatedRole === 'Technical'
          ? '▲ TECHNICAL DEPARTMENT'
          : authenticatedRole === 'Billing'
            ? '▲ BILLING DEPARTMENT'
            : authenticatedRole === 'Customer'
              ? '▲ CUSTOMER PORTAL'
              : null;
  const publicMaxWidth = path === RoutePath.TRACK ? 880 : 1280;

  const renderRoute = () => {
    switch (path) {
      case RoutePath.HOME:
        return <HomePage initialMode="home" />;
      case RoutePath.TRACK:
        return <HomePage initialMode="track" />;
      case RoutePath.LOGIN:
        return <SignInPage />;
      case RoutePath.REGISTER:
        return <RegisterPage />;

      case RoutePath.CUSTOMER:
      case RoutePath.CUSTOMER_PROFILE:
        return (
          <RoleGuard
            allowedRole="Customer"
            accessDenied={(role) => <AccessDeniedView currentRole={role} />}
          >
            <CustomerPortal section="profile" />
          </RoleGuard>
        );
      case RoutePath.CUSTOMER_ORDERS:
        return (
          <RoleGuard
            allowedRole="Customer"
            accessDenied={(role) => <AccessDeniedView currentRole={role} />}
          >
            <CustomerPortal section="orders" />
          </RoleGuard>
        );
      case RoutePath.CUSTOMER_BILLING:
        return (
          <RoleGuard
            allowedRole="Customer"
            accessDenied={(role) => <AccessDeniedView currentRole={role} />}
          >
            <CustomerPortal section="billing" />
          </RoleGuard>
        );
      case RoutePath.CUSTOMER_SUPPORT:
        return (
          <RoleGuard
            allowedRole="Customer"
            accessDenied={(role) => <AccessDeniedView currentRole={role} />}
          >
            <CustomerPortal section="support" />
          </RoleGuard>
        );

      case RoutePath.ADMIN:
      case RoutePath.ADMIN_PLANS:
        return (
          <RoleGuard
            allowedRole="Admin"
            accessDenied={(role) => <AccessDeniedView currentRole={role} />}
          >
            <AdminPortal section="plans" />
          </RoleGuard>
        );
      case RoutePath.ADMIN_PRODUCTS:
        return (
          <RoleGuard
            allowedRole="Admin"
            accessDenied={(role) => <AccessDeniedView currentRole={role} />}
          >
            <AdminPortal section="products" />
          </RoleGuard>
        );
      case RoutePath.ADMIN_CITIES:
        return (
          <RoleGuard
            allowedRole="Admin"
            accessDenied={(role) => <AccessDeniedView currentRole={role} />}
          >
            <AdminPortal section="cities" />
          </RoleGuard>
        );
      case RoutePath.ADMIN_EMPLOYEES:
        return (
          <RoleGuard
            allowedRole="Admin"
            accessDenied={(role) => <AccessDeniedView currentRole={role} />}
          >
            <AdminPortal section="employees" />
          </RoleGuard>
        );
      case RoutePath.ADMIN_CUSTOMERS:
        return (
          <RoleGuard
            allowedRole="Admin"
            accessDenied={(role) => <AccessDeniedView currentRole={role} />}
          >
            <AdminPortal section="customers" />
          </RoleGuard>
        );
      case RoutePath.ADMIN_RETAIL_SHOPS:
        return (
          <RoleGuard
            allowedRole="Admin"
            accessDenied={(role) => <AccessDeniedView currentRole={role} />}
          >
            <AdminPortal section="retail-shops" />
          </RoleGuard>
        );
      case RoutePath.ADMIN_VENDORS:
        return (
          <RoleGuard
            allowedRole="Admin"
            accessDenied={(role) => <AccessDeniedView currentRole={role} />}
          >
            <AdminPortal section="vendors" />
          </RoleGuard>
        );
      case RoutePath.ADMIN_PURCHASES:
        return (
          <RoleGuard
            allowedRole="Admin"
            accessDenied={(role) => <AccessDeniedView currentRole={role} />}
          >
            <AdminPortal section="purchases" />
          </RoleGuard>
        );
      case RoutePath.ADMIN_VENDOR_PAYMENTS:
        return (
          <RoleGuard
            allowedRole="Admin"
            accessDenied={(role) => <AccessDeniedView currentRole={role} />}
          >
            <AdminPortal section="vendor-payments" />
          </RoleGuard>
        );
      case RoutePath.ADMIN_DOCUMENTS:
        return (
          <RoleGuard
            allowedRole="Admin"
            accessDenied={(role) => <AccessDeniedView currentRole={role} />}
          >
            <AdminPortal section="documents" />
          </RoleGuard>
        );
      case RoutePath.ADMIN_PLAN_CHANGES:
        return (
          <RoleGuard
            allowedRole="Admin"
            accessDenied={(role) => <AccessDeniedView currentRole={role} />}
          >
            <AdminPortal section="plan-changes" />
          </RoleGuard>
        );
      case RoutePath.ADMIN_QUERIES:
        return (
          <RoleGuard
            allowedRole="Admin"
            accessDenied={(role) => <AccessDeniedView currentRole={role} />}
          >
            <AdminPortal section="queries" />
          </RoleGuard>
        );

      case RoutePath.RETAIL:
      case RoutePath.RETAIL_CUSTOMERS:
        return (
          <RoleGuard
            allowedRole="Retail"
            accessDenied={(role) => <AccessDeniedView currentRole={role} />}
          >
            <RetailPortal section="customers" />
          </RoleGuard>
        );
      case RoutePath.RETAIL_REQUESTS:
        return (
          <RoleGuard
            allowedRole="Retail"
            accessDenied={(role) => <AccessDeniedView currentRole={role} />}
          >
            <RetailPortal section="requests" />
          </RoleGuard>
        );
      case RoutePath.RETAIL_ORDERS:
        return (
          <RoleGuard
            allowedRole="Retail"
            accessDenied={(role) => <AccessDeniedView currentRole={role} />}
          >
            <RetailPortal section="orders" />
          </RoleGuard>
        );
      case RoutePath.RETAIL_BILLING:
        return (
          <RoleGuard
            allowedRole="Retail"
            accessDenied={(role) => <AccessDeniedView currentRole={role} />}
          >
            <RetailPortal section="billing" />
          </RoleGuard>
        );
      case RoutePath.RETAIL_LIFECYCLE:
        return (
          <RoleGuard
            allowedRole="Retail"
            accessDenied={(role) => <AccessDeniedView currentRole={role} />}
          >
            <RetailPortal section="lifecycle" />
          </RoleGuard>
        );
      case RoutePath.RETAIL_DOCUMENTS:
        return (
          <RoleGuard
            allowedRole="Retail"
            accessDenied={(role) => <AccessDeniedView currentRole={role} />}
          >
            <RetailPortal section="documents" />
          </RoleGuard>
        );
      case RoutePath.RETAIL_PLAN_CHANGES:
        return (
          <RoleGuard
            allowedRole="Retail"
            accessDenied={(role) => <AccessDeniedView currentRole={role} />}
          >
            <RetailPortal section="plan-changes" />
          </RoleGuard>
        );
      case RoutePath.RETAIL_QUERIES:
        return (
          <RoleGuard
            allowedRole="Retail"
            accessDenied={(role) => <AccessDeniedView currentRole={role} />}
          >
            <RetailPortal section="queries" />
          </RoleGuard>
        );

      case RoutePath.TECHNICAL:
      case RoutePath.TECHNICAL_ASSESSMENTS:
        return (
          <RoleGuard
            allowedRole="Technical"
            accessDenied={(role) => <AccessDeniedView currentRole={role} />}
          >
            <TechnicalPortal section="assessments" />
          </RoleGuard>
        );
      case RoutePath.TECHNICAL_CONNECTIONS:
        return (
          <RoleGuard
            allowedRole="Technical"
            accessDenied={(role) => <AccessDeniedView currentRole={role} />}
          >
            <TechnicalPortal section="connections" />
          </RoleGuard>
        );
      case RoutePath.TECHNICAL_EQUIPMENT:
        return (
          <RoleGuard
            allowedRole="Technical"
            accessDenied={(role) => <AccessDeniedView currentRole={role} />}
          >
            <TechnicalPortal section="equipment" />
          </RoleGuard>
        );
      case RoutePath.TECHNICAL_ORDERS:
        return (
          <RoleGuard
            allowedRole="Technical"
            accessDenied={(role) => <AccessDeniedView currentRole={role} />}
          >
            <TechnicalPortal section="orders" />
          </RoleGuard>
        );
      case RoutePath.TECHNICAL_LIFECYCLE:
        return (
          <RoleGuard
            allowedRole="Technical"
            accessDenied={(role) => <AccessDeniedView currentRole={role} />}
          >
            <TechnicalPortal section="lifecycle" />
          </RoleGuard>
        );
      case RoutePath.TECHNICAL_PLAN_CHANGES:
        return (
          <RoleGuard
            allowedRole="Technical"
            accessDenied={(role) => <AccessDeniedView currentRole={role} />}
          >
            <TechnicalPortal section="plan-changes" />
          </RoleGuard>
        );

      case RoutePath.BILLING:
      case RoutePath.BILLING_ACCOUNTS:
        return (
          <RoleGuard
            allowedRole="Billing"
            accessDenied={(role) => <AccessDeniedView currentRole={role} />}
          >
            <BillingPortal section="lookup" />
          </RoleGuard>
        );
      case RoutePath.BILLING_PAYMENTS:
        return (
          <RoleGuard
            allowedRole="Billing"
            accessDenied={(role) => <AccessDeniedView currentRole={role} />}
          >
            <BillingPortal section="payments" />
          </RoleGuard>
        );
      case RoutePath.BILLING_REGISTRY:
        return (
          <RoleGuard
            allowedRole="Billing"
            accessDenied={(role) => <AccessDeniedView currentRole={role} />}
          >
            <BillingPortal section="registry" />
          </RoleGuard>
        );

      default:
        return <NotFoundView />;
    }
  };

  return (
    <AppShell
      variant={showSideNav ? 'elevated' : 'wash'}
      height={showSideNav || isAuthRoute ? 'fill' : 'auto'}
      contentPadding={isAuthRoute ? 0 : showSideNav ? 6 : 5}
      mobileNav={showSideNav ? { breakpoint: 'md' } : false}
      banner={backendOffline ? <OfflineBanner onRetry={refreshSession} /> : undefined}
      topNav={
        isAuthRoute ? undefined : (
          <TopNav
          label="Primary navigation"
          heading={
            <TopNavHeading
              heading="▲ Nexus"
              headingHref={RoutePath.HOME}
            />
          }
          startContent={
            <>
              <TopNavItem
                label="Home"
                href={RoutePath.HOME}
                isSelected={path === RoutePath.HOME}
              />
              <TopNavItem
                label="Track Order"
                href={RoutePath.TRACK}
                isSelected={path === RoutePath.TRACK}
              />
            </>
          }
          endContent={
            <HStack gap={2} vAlign="center">
              {authenticatedRole && session ? (
                <>
                  {!isInOwnWorkspace && (
                    <Button
                      size="sm"
                      variant="secondary"
                      label={`${authenticatedRole} Workspace`}
                      href={getDefaultRouteForRole(authenticatedRole)}
                    />
                  )}
                  <Token
                    size="sm"
                    color="blue"
                    label={`${session.displayName || session.username} (${authenticatedRole})`}
                  />
                  <Button
                    size="sm"
                    variant="secondary"
                    label="Sign Out"
                    onClick={async () => {
                      await logout();
                      toast({ body: 'Signed out' });
                      navigate(RoutePath.HOME);
                    }}
                  />
                </>
              ) : (
                <>
                  <Button
                    size="sm"
                    variant="secondary"
                    label="Register"
                    href={RoutePath.REGISTER}
                  />
                  <Button
                    size="sm"
                    variant="primary"
                    label="Sign In"
                    href={RoutePath.LOGIN}
                  />
                </>
              )}
            </HStack>
          }
        />
        )
      }
      sideNav={
        showSideNav ? (
          <SideNav
            collapsible={{
              defaultIsCollapsed: true,
              isCollapsed: isSidebarCollapsed,
              onCollapsedChange: setIsSidebarCollapsed,
              hasButton: false,
            }}
            resizable={{ defaultWidth: 252, minWidth: 220, maxWidth: 320 }}
            topContent={
              !isSidebarCollapsed && sidebarTitle ? (
                <Section variant="transparent" paddingInline={2} paddingBlockStart={2} paddingBlockEnd={0}>
                  <Text type="eyebrow" color="secondary" display="block">
                    {sidebarTitle}
                  </Text>
                </Section>
              ) : undefined
            }
            footer={
              isSidebarCollapsed ? undefined : (
                <VStack gap={2}>
                  <Token
                    size="sm"
                    color={backendOffline ? 'red' : 'green'}
                    label={backendOffline ? 'Backend Offline' : 'Live API Connected'}
                  />
                  <Text type="supporting">
                    {authenticatedRole && session
                      ? `${session.username} (${authenticatedRole})`
                      : 'Public Visitor'}
                  </Text>
                </VStack>
              )
            }
            footerIcons={
              <HStack width="100%" hAlign={isSidebarCollapsed ? 'center' : 'end'}>
                <SideNavCollapseButton>
                  <Icon icon="nexus:sidebar" size="sm" />
                </SideNavCollapseButton>
              </HStack>
            }
          >
            {authenticatedRole === 'Admin' && (
              <SideNavSection title="Admin Operations" isHeaderHidden>
                <SideNavItem
                  label="Service Plans"
                  icon={isSidebarCollapsed ? <Icon icon="nexus:plans" /> : undefined}
                  href={RoutePath.ADMIN_PLANS}
                  isSelected={
                    path === RoutePath.ADMIN ||
                    path === RoutePath.ADMIN_PLANS ||
                    path === RoutePath.ADMIN_PLAN_CHANGES
                  }
                />
                <SideNavItem
                  label="Products & Equipment"
                  icon={isSidebarCollapsed ? <Icon icon="nexus:products" /> : undefined}
                  href={RoutePath.ADMIN_PRODUCTS}
                  isSelected={path === RoutePath.ADMIN_PRODUCTS}
                />
                <SideNavItem
                  label="Cities & Outlets"
                  icon={isSidebarCollapsed ? <Icon icon="nexus:cities" /> : undefined}
                  href={RoutePath.ADMIN_CITIES}
                  isSelected={
                    path === RoutePath.ADMIN_CITIES || path === RoutePath.ADMIN_RETAIL_SHOPS
                  }
                />
                <SideNavItem
                  label="Vendors & Procurement"
                  icon={isSidebarCollapsed ? <Icon icon="nexus:vendors" /> : undefined}
                  href={RoutePath.ADMIN_VENDORS}
                  isSelected={
                    path === RoutePath.ADMIN_VENDORS ||
                    path === RoutePath.ADMIN_PURCHASES ||
                    path === RoutePath.ADMIN_VENDOR_PAYMENTS
                  }
                />
                <SideNavItem
                  label="Employees"
                  icon={isSidebarCollapsed ? <Icon icon="nexus:employees" /> : undefined}
                  href={RoutePath.ADMIN_EMPLOYEES}
                  isSelected={path === RoutePath.ADMIN_EMPLOYEES}
                />
                <SideNavItem
                  label="Customers"
                  icon={isSidebarCollapsed ? <Icon icon="nexus:customers" /> : undefined}
                  href={RoutePath.ADMIN_CUSTOMERS}
                  isSelected={
                    path === RoutePath.ADMIN_CUSTOMERS || path === RoutePath.ADMIN_DOCUMENTS
                  }
                />
                <SideNavItem
                  label="Queries & FAQ"
                  icon={isSidebarCollapsed ? <Icon icon="nexus:queries" /> : undefined}
                  href={RoutePath.ADMIN_QUERIES}
                  isSelected={path === RoutePath.ADMIN_QUERIES}
                />
              </SideNavSection>
            )}

            {authenticatedRole === 'Retail' && (
              <SideNavSection title="Retail Outlet" isHeaderHidden>
                <SideNavItem
                  label="Customers"
                  icon={isSidebarCollapsed ? <Icon icon="nexus:customers" /> : undefined}
                  href={RoutePath.RETAIL_CUSTOMERS}
                  isSelected={
                    path === RoutePath.RETAIL ||
                    path === RoutePath.RETAIL_CUSTOMERS ||
                    path === RoutePath.RETAIL_DOCUMENTS
                  }
                />
                <SideNavItem
                  label="Service Requests"
                  icon={isSidebarCollapsed ? <Icon icon="nexus:requests" /> : undefined}
                  href={RoutePath.RETAIL_REQUESTS}
                  isSelected={path === RoutePath.RETAIL_REQUESTS}
                />
                <SideNavItem
                  label="Orders & Feedback"
                  icon={isSidebarCollapsed ? <Icon icon="nexus:orders" /> : undefined}
                  href={RoutePath.RETAIL_ORDERS}
                  isSelected={path === RoutePath.RETAIL_ORDERS}
                />
                <SideNavItem
                  label="Connections"
                  icon={isSidebarCollapsed ? <Icon icon="nexus:lifecycle" /> : undefined}
                  href={RoutePath.RETAIL_LIFECYCLE}
                  isSelected={
                    path === RoutePath.RETAIL_LIFECYCLE || path === RoutePath.RETAIL_PLAN_CHANGES
                  }
                />
                <SideNavItem
                  label="Billing & Payments"
                  icon={isSidebarCollapsed ? <Icon icon="nexus:billing" /> : undefined}
                  href={RoutePath.RETAIL_BILLING}
                  isSelected={path === RoutePath.RETAIL_BILLING}
                />
                <SideNavItem
                  label="Queries & FAQ"
                  icon={isSidebarCollapsed ? <Icon icon="nexus:queries" /> : undefined}
                  href={RoutePath.RETAIL_QUERIES}
                  isSelected={path === RoutePath.RETAIL_QUERIES}
                />
              </SideNavSection>
            )}

            {authenticatedRole === 'Technical' && (
              <SideNavSection title="Technical Department" isHeaderHidden>
                <SideNavItem
                  label="Feasibility Assessments"
                  icon={isSidebarCollapsed ? <Icon icon="nexus:assessments" /> : undefined}
                  href={RoutePath.TECHNICAL_ASSESSMENTS}
                  isSelected={
                    path === RoutePath.TECHNICAL || path === RoutePath.TECHNICAL_ASSESSMENTS
                  }
                />
                <SideNavItem
                  label="Connections"
                  icon={isSidebarCollapsed ? <Icon icon="nexus:connections" /> : undefined}
                  href={RoutePath.TECHNICAL_CONNECTIONS}
                  isSelected={
                    path === RoutePath.TECHNICAL_CONNECTIONS ||
                    path === RoutePath.TECHNICAL_LIFECYCLE ||
                    path === RoutePath.TECHNICAL_PLAN_CHANGES
                  }
                />
                <SideNavItem
                  label="Equipment & Maintenance"
                  icon={isSidebarCollapsed ? <Icon icon="nexus:equipment" /> : undefined}
                  href={RoutePath.TECHNICAL_EQUIPMENT}
                  isSelected={path === RoutePath.TECHNICAL_EQUIPMENT}
                />
                <SideNavItem
                  label="All Orders"
                  icon={isSidebarCollapsed ? <Icon icon="nexus:orders" /> : undefined}
                  href={RoutePath.TECHNICAL_ORDERS}
                  isSelected={path === RoutePath.TECHNICAL_ORDERS}
                />
              </SideNavSection>
            )}

            {authenticatedRole === 'Billing' && (
              <SideNavSection title="Billing Department" isHeaderHidden>
                <SideNavItem
                  label="Accounts & Invoicing"
                  icon={isSidebarCollapsed ? <Icon icon="nexus:invoices" /> : undefined}
                  href={RoutePath.BILLING_ACCOUNTS}
                  isSelected={
                    path === RoutePath.BILLING || path === RoutePath.BILLING_ACCOUNTS
                  }
                />
                <SideNavItem
                  label="Payment Processing"
                  icon={isSidebarCollapsed ? <Icon icon="nexus:payments" /> : undefined}
                  href={RoutePath.BILLING_PAYMENTS}
                  isSelected={path === RoutePath.BILLING_PAYMENTS}
                />
                <SideNavItem
                  label="Billing Registry"
                  icon={isSidebarCollapsed ? <Icon icon="nexus:registry" /> : undefined}
                  href={RoutePath.BILLING_REGISTRY}
                  isSelected={path === RoutePath.BILLING_REGISTRY}
                />
              </SideNavSection>
            )}

            {authenticatedRole === 'Customer' && (
              <SideNavSection title="Customer Portal" isHeaderHidden>
                <SideNavItem
                  label="Profile"
                  icon={isSidebarCollapsed ? <Icon icon="nexus:customers" /> : undefined}
                  href={RoutePath.CUSTOMER_PROFILE}
                  isSelected={
                    path === RoutePath.CUSTOMER || path === RoutePath.CUSTOMER_PROFILE
                  }
                />
                <SideNavItem
                  label="Orders & Requests"
                  icon={isSidebarCollapsed ? <Icon icon="nexus:orders" /> : undefined}
                  href={RoutePath.CUSTOMER_ORDERS}
                  isSelected={path === RoutePath.CUSTOMER_ORDERS}
                />
                <SideNavItem
                  label="Connections & Billing"
                  icon={isSidebarCollapsed ? <Icon icon="nexus:billing" /> : undefined}
                  href={RoutePath.CUSTOMER_BILLING}
                  isSelected={path === RoutePath.CUSTOMER_BILLING}
                />
                <SideNavItem
                  label="Support & Plan Change"
                  icon={isSidebarCollapsed ? <Icon icon="nexus:queries" /> : undefined}
                  href={RoutePath.CUSTOMER_SUPPORT}
                  isSelected={path === RoutePath.CUSTOMER_SUPPORT}
                />
              </SideNavSection>
            )}
          </SideNav>
        ) : undefined
      }
    >
      {showSideNav || isAuthRoute ? (
        renderRoute()
      ) : (
        <Center axis="horizontal" width="100%">
          <Section variant="transparent" width="100%" maxWidth={publicMaxWidth} padding={0}>
            {renderRoute()}
          </Section>
        </Center>
      )}
    </AppShell>
  );
}

export default function App() {
  return (
    <AuthProvider>
      <RouterProvider>
        <Theme theme={themes[defaultThemeSlug]} mode="light">
          <ToastViewport position="bottomEnd" maxVisible={4}>
            <LinkProvider component={RouterLink}>
              <NexusAppContent />
            </LinkProvider>
          </ToastViewport>
        </Theme>
      </RouterProvider>
    </AuthProvider>
  );
}

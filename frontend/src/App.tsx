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
import { BillingPortal } from './pages/billing/BillingPortal';
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
        description={`You are currently signed in as ${currentRole}. This route is restricted to a different department role.`}
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
        description="The requested Nexus page does not exist. Return to the home page or your department workspace."
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
              <VStack gap={5} width="100%" maxWidth={360}>
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
                      placeholder="e.g. retail.demo"
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
                      <Link href={RoutePath.HOME} type="supporting" color="secondary" hasUnderline>
                        Back to Home
                      </Link>
                    </HStack>
                  </FormLayout>
                </form>
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
  const isLoginRoute = path === RoutePath.LOGIN;
  const isStaffWorkspaceRoute =
    path.startsWith('/admin') ||
    path.startsWith('/retail') ||
    path.startsWith('/technical') ||
    path.startsWith('/billing');
  const isInOwnWorkspace = Boolean(
    authenticatedRole && path.startsWith(`/${authenticatedRole.toLowerCase()}`),
  );
  const showSideNav = Boolean(authenticatedRole) && isStaffWorkspaceRoute;
  const sidebarTitle =
    authenticatedRole === 'Admin'
      ? '▲ ADMIN OPERATIONS'
      : authenticatedRole === 'Retail'
        ? '▲ RETAIL OUTLET'
        : authenticatedRole === 'Technical'
          ? '▲ TECHNICAL DEPARTMENT'
          : authenticatedRole === 'Billing'
            ? '▲ BILLING DEPARTMENT'
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
      case RoutePath.TECHNICAL_ORDERS:
        return (
          <RoleGuard
            allowedRole="Technical"
            accessDenied={(role) => <AccessDeniedView currentRole={role} />}
          >
            <TechnicalPortal section="orders" />
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
      height={showSideNav || isLoginRoute ? 'fill' : 'auto'}
      contentPadding={isLoginRoute ? 0 : showSideNav ? 6 : 5}
      mobileNav={showSideNav ? { breakpoint: 'md' } : false}
      banner={backendOffline ? <OfflineBanner onRetry={refreshSession} /> : undefined}
      topNav={
        isLoginRoute ? undefined : (
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
                <Button
                  size="sm"
                  variant="primary"
                  label="Staff Sign In"
                  href={RoutePath.LOGIN}
                />
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
                  icon={isSidebarCollapsed ? <Icon icon="viewColumns" /> : undefined}
                  href={RoutePath.ADMIN_PLANS}
                  isSelected={path === RoutePath.ADMIN || path === RoutePath.ADMIN_PLANS}
                />
                <SideNavItem
                  label="Products & Equipment"
                  icon={isSidebarCollapsed ? <Icon icon="wrench" /> : undefined}
                  href={RoutePath.ADMIN_PRODUCTS}
                  isSelected={path === RoutePath.ADMIN_PRODUCTS}
                />
                <SideNavItem
                  label="Territory Cities"
                  icon={isSidebarCollapsed ? <Icon icon="externalLink" /> : undefined}
                  href={RoutePath.ADMIN_CITIES}
                  isSelected={path === RoutePath.ADMIN_CITIES}
                />
                <SideNavItem
                  label="Employees"
                  icon={isSidebarCollapsed ? <Icon icon="checkDouble" /> : undefined}
                  href={RoutePath.ADMIN_EMPLOYEES}
                  isSelected={path === RoutePath.ADMIN_EMPLOYEES}
                />
                <SideNavItem
                  label="Customers"
                  icon={isSidebarCollapsed ? <Icon icon="search" /> : undefined}
                  href={RoutePath.ADMIN_CUSTOMERS}
                  isSelected={path === RoutePath.ADMIN_CUSTOMERS}
                />
              </SideNavSection>
            )}

            {authenticatedRole === 'Retail' && (
              <SideNavSection title="Retail Outlet" isHeaderHidden>
                <SideNavItem
                  label="Customers"
                  icon={isSidebarCollapsed ? <Icon icon="search" /> : undefined}
                  href={RoutePath.RETAIL_CUSTOMERS}
                  isSelected={path === RoutePath.RETAIL || path === RoutePath.RETAIL_CUSTOMERS}
                />
                <SideNavItem
                  label="Service Requests"
                  icon={isSidebarCollapsed ? <Icon icon="upload" /> : undefined}
                  href={RoutePath.RETAIL_REQUESTS}
                  isSelected={path === RoutePath.RETAIL_REQUESTS}
                />
                <SideNavItem
                  label="Orders & Feedback"
                  icon={isSidebarCollapsed ? <Icon icon="viewColumns" /> : undefined}
                  href={RoutePath.RETAIL_ORDERS}
                  isSelected={path === RoutePath.RETAIL_ORDERS}
                />
                <SideNavItem
                  label="Billing & Payments"
                  icon={isSidebarCollapsed ? <Icon icon="check" /> : undefined}
                  href={RoutePath.RETAIL_BILLING}
                  isSelected={path === RoutePath.RETAIL_BILLING}
                />
              </SideNavSection>
            )}

            {authenticatedRole === 'Technical' && (
              <SideNavSection title="Technical Department" isHeaderHidden>
                <SideNavItem
                  label="Feasibility Assessments"
                  icon={isSidebarCollapsed ? <Icon icon="wrench" /> : undefined}
                  href={RoutePath.TECHNICAL_ASSESSMENTS}
                  isSelected={
                    path === RoutePath.TECHNICAL || path === RoutePath.TECHNICAL_ASSESSMENTS
                  }
                />
                <SideNavItem
                  label="Connection Activation"
                  icon={isSidebarCollapsed ? <Icon icon="checkDouble" /> : undefined}
                  href={RoutePath.TECHNICAL_CONNECTIONS}
                  isSelected={path === RoutePath.TECHNICAL_CONNECTIONS}
                />
                <SideNavItem
                  label="All Orders"
                  icon={isSidebarCollapsed ? <Icon icon="viewColumns" /> : undefined}
                  href={RoutePath.TECHNICAL_ORDERS}
                  isSelected={path === RoutePath.TECHNICAL_ORDERS}
                />
              </SideNavSection>
            )}

            {authenticatedRole === 'Billing' && (
              <SideNavSection title="Billing Department" isHeaderHidden>
                <SideNavItem
                  label="Accounts & Invoicing"
                  icon={isSidebarCollapsed ? <Icon icon="search" /> : undefined}
                  href={RoutePath.BILLING_ACCOUNTS}
                  isSelected={
                    path === RoutePath.BILLING || path === RoutePath.BILLING_ACCOUNTS
                  }
                />
                <SideNavItem
                  label="Payment Processing"
                  icon={isSidebarCollapsed ? <Icon icon="check" /> : undefined}
                  href={RoutePath.BILLING_PAYMENTS}
                  isSelected={path === RoutePath.BILLING_PAYMENTS}
                />
                <SideNavItem
                  label="Billing Registry"
                  icon={isSidebarCollapsed ? <Icon icon="viewColumns" /> : undefined}
                  href={RoutePath.BILLING_REGISTRY}
                  isSelected={path === RoutePath.BILLING_REGISTRY}
                />
              </SideNavSection>
            )}
          </SideNav>
        ) : undefined
      }
    >
      {showSideNav || isLoginRoute ? (
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

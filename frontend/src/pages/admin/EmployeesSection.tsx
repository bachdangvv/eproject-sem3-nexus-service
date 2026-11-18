import { useCallback, useEffect, useMemo, useRef, useState, type FormEvent, type JSX } from 'react';
import { Badge } from '@astryxdesign/core/Badge';
import { Button } from '@astryxdesign/core/Button';
import { Card } from '@astryxdesign/core/Card';
import { Center } from '@astryxdesign/core/Center';
import { Code } from '@astryxdesign/core/Code';
import { EmptyState } from '@astryxdesign/core/EmptyState';
import { FormLayout } from '@astryxdesign/core/FormLayout';
import { Grid } from '@astryxdesign/core/Grid';
import { HStack } from '@astryxdesign/core/HStack';
import { Heading } from '@astryxdesign/core/Heading';
import { Icon } from '@astryxdesign/core/Icon';
import { Selector } from '@astryxdesign/core/Selector';
import { Spinner } from '@astryxdesign/core/Spinner';
import { pixel, proportional, Table, type TableColumn } from '@astryxdesign/core/Table';
import { Text } from '@astryxdesign/core/Text';
import { TextInput } from '@astryxdesign/core/TextInput';
import { useToast } from '@astryxdesign/core/Toast';
import { Token, type TokenColor } from '@astryxdesign/core/Token';
import { VStack } from '@astryxdesign/core/VStack';
import { ApiErrorBanner } from '../../components/StatusViews';
import { TablePaginationFooter } from '../../components/TablePagination';
import { useClientPagination } from '../../hooks/useClientPagination';
import { createEmployee, getEmployees } from '../../services/staffApi';
import type { EmployeeView, UserRole } from '../../types/nexus';
import {
  extractErrorMessage,
  extractFieldErrors,
  STAFF_ROLE_OPTIONS,
  USERNAME_REGEX,
  type AdminSectionProps,
  type EmployeeRow,
} from './adminTypes';

const ROLE_TOKEN_COLOR: Record<UserRole, TokenColor> = {
  Admin: 'purple',
  Retail: 'blue',
  Technical: 'teal',
  Billing: 'green',
};

function RoleToken({ role }: { role: UserRole }): JSX.Element {
  return <Token size="sm" color={ROLE_TOKEN_COLOR[role] ?? 'default'} label={role} />;
}

export function EmployeesSection({
  refreshTrigger,
  onCountChange,
  onRefreshingChange,
}: AdminSectionProps): JSX.Element {
  const toast = useToast();
  const [employees, setEmployees] = useState<EmployeeView[]>([]);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState<string | null>(null);

  const [username, setUsername] = useState('');
  const [displayName, setDisplayName] = useState('');
  const [role, setRole] = useState<UserRole>('Retail');
  const [password, setPassword] = useState('');

  const [usernameTouched, setUsernameTouched] = useState(false);
  const [displayNameTouched, setDisplayNameTouched] = useState(false);
  const [passwordTouched, setPasswordTouched] = useState(false);

  const [serverFieldErrors, setServerFieldErrors] = useState<{
    username?: string;
    displayName?: string;
    role?: string;
    password?: string;
  }>({});
  const [submitError, setSubmitError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);

  const hasLoadedOnceRef = useRef(false);
  const isMountedRef = useRef(true);
  const requestSeqRef = useRef(0);

  useEffect(() => {
    isMountedRef.current = true;
    return () => {
      isMountedRef.current = false;
    };
  }, []);

  const loadEmployees = useCallback(
    async (silent = false) => {
      if (!isMountedRef.current) return;
      const seq = ++requestSeqRef.current;
      if (silent) {
        onRefreshingChange(true);
      } else {
        setLoading(true);
      }
      setLoadError(null);
      try {
        const data = await getEmployees();
        if (!isMountedRef.current || seq !== requestSeqRef.current) return;
        setEmployees(data);
        onCountChange(data.length);
      } catch (err) {
        if (!isMountedRef.current || seq !== requestSeqRef.current) return;
        setLoadError(extractErrorMessage(err, 'Failed to load staff roster.'));
      } finally {
        if (isMountedRef.current && seq === requestSeqRef.current) {
          setLoading(false);
          onRefreshingChange(false);
        }
      }
    },
    [onCountChange, onRefreshingChange],
  );

  useEffect(() => {
    const isSilent = hasLoadedOnceRef.current && refreshTrigger > 0;
    hasLoadedOnceRef.current = true;
    void loadEmployees(isSilent);
  }, [loadEmployees, refreshTrigger]);

  const trimmedUsername = username.trim();
  const trimmedDisplayName = displayName.trim();

  const isUsernameFormatValid = USERNAME_REGEX.test(trimmedUsername);
  const isDuplicateUsername = useMemo(
    () =>
      isUsernameFormatValid &&
      employees.some((emp) => emp.username.toLowerCase() === trimmedUsername.toLowerCase()),
    [employees, isUsernameFormatValid, trimmedUsername],
  );
  const isDisplayNameValid = trimmedDisplayName.length >= 1 && trimmedDisplayName.length <= 100;
  const isPasswordValid =
    password.trim().length > 0 && password.length >= 12 && password.length <= 128;

  const isFormValid =
    isUsernameFormatValid && !isDuplicateUsername && isDisplayNameValid && isPasswordValid;

  const usernameStatus = useMemo(() => {
    if (serverFieldErrors.username) {
      return { type: 'error' as const, message: serverFieldErrors.username };
    }
    if (!trimmedUsername && !usernameTouched) {
      return undefined;
    }
    if (!isUsernameFormatValid) {
      return {
        type: 'error' as const,
        message: 'Username must be 3–40 characters using letters, numbers, ".", "_", or "-".',
      };
    }
    if (isDuplicateUsername) {
      return {
        type: 'error' as const,
        message: `Username "${trimmedUsername.toLowerCase()}" is already registered.`,
      };
    }
    return {
      type: 'success' as const,
      message: `Available (will be stored as "${trimmedUsername.toLowerCase()}").`,
    };
  }, [
    isDuplicateUsername,
    isUsernameFormatValid,
    serverFieldErrors.username,
    trimmedUsername,
    usernameTouched,
  ]);

  const displayNameStatus = useMemo(() => {
    if (serverFieldErrors.displayName) {
      return { type: 'error' as const, message: serverFieldErrors.displayName };
    }
    if (!trimmedDisplayName && !displayNameTouched) {
      return undefined;
    }
    if (!trimmedDisplayName) {
      return { type: 'error' as const, message: 'Display name is required.' };
    }
    if (trimmedDisplayName.length > 100) {
      return { type: 'error' as const, message: 'Display name must be 100 characters or fewer.' };
    }
    return undefined;
  }, [displayNameTouched, serverFieldErrors.displayName, trimmedDisplayName]);

  const passwordStatus = useMemo(() => {
    if (serverFieldErrors.password) {
      return { type: 'error' as const, message: serverFieldErrors.password };
    }
    if (!password && !passwordTouched) {
      return undefined;
    }
    if (!password) {
      return { type: 'error' as const, message: 'Password is required (minimum 12 characters).' };
    }
    if (password.trim().length === 0) {
      return { type: 'error' as const, message: 'Password cannot consist solely of whitespace.' };
    }
    if (password.length < 12) {
      return {
        type: 'error' as const,
        message: `Password must be at least 12 characters (${password.length}/12).`,
      };
    }
    if (password.length > 128) {
      return {
        type: 'error' as const,
        message: 'Password must be 128 characters or fewer.',
      };
    }
    return {
      type: 'success' as const,
      message: `Password length valid (${password.length} characters).`,
    };
  }, [password, passwordTouched, serverFieldErrors.password]);

  const employeeRows = useMemo<EmployeeRow[]>(
    () => employees.map((emp) => ({ ...emp })),
    [employees],
  );
  const pagination = useClientPagination(employeeRows);

  const handleSubmit = async (e: FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    if (submitting) return;
    setUsernameTouched(true);
    setDisplayNameTouched(true);
    setPasswordTouched(true);
    setSubmitError(null);
    setServerFieldErrors({});

    if (!isFormValid) {
      return;
    }

    setSubmitting(true);
    try {
      const created = await createEmployee({
        username: trimmedUsername,
        displayName: trimmedDisplayName,
        role,
        password,
      });
      if (!isMountedRef.current) return;
      setUsername('');
      setDisplayName('');
      setPassword('');
      setRole('Retail');
      setUsernameTouched(false);
      setDisplayNameTouched(false);
      setPasswordTouched(false);
      toast({ body: `Registered staff account "${created.username}" (${created.role}).` });
      pagination.focusItem((item) => item.id === created.id);
      await loadEmployees(true);
    } catch (err) {
      if (!isMountedRef.current) return;
      const fields = extractFieldErrors(err);
      setServerFieldErrors({
        username: fields.username,
        displayName: fields.displayname,
        role: fields.role,
        password: fields.password,
      });
      setSubmitError(extractErrorMessage(err, 'Could not register staff account.'));
    } finally {
      if (isMountedRef.current) {
        setSubmitting(false);
      }
    }
  };

  const columns: TableColumn<EmployeeRow>[] = [
    {
      key: 'username',
      header: 'Username',
      width: proportional(1, { minWidth: 130 }),
      renderCell: (row) => <Code>{row.username}</Code>,
    },
    {
      key: 'displayName',
      header: 'Display Name',
      width: proportional(1.5, { minWidth: 150 }),
      renderCell: (row) => <Text weight="semibold">{row.displayName}</Text>,
    },
    {
      key: 'role',
      header: 'Role',
      width: pixel(120),
      renderCell: (row) => <RoleToken role={row.role} />,
    },
  ];

  return (
    <Grid columns={{ minWidth: 340, max: 2 }} gap={6} align="start">
      <Card padding={6}>
        <VStack gap={4}>
          <VStack gap={1}>
            <Heading level={2}>Register Staff Account</Heading>
            <Text type="supporting">
              Provision a new department login. Usernames are normalized to lowercase on creation.
            </Text>
          </VStack>

          <ApiErrorBanner
            title="Could not register employee"
            error={submitError}
            onDismiss={() => setSubmitError(null)}
          />

          <form onSubmit={(e) => void handleSubmit(e)}>
            <FormLayout>
              <TextInput
                label="Username"
                placeholder="e.g. retail.alice"
                autoComplete="off"
                description="3–40 characters: letters, numbers, '.', '_', or '-'."
                isRequired
                value={username}
                onChange={(value) => {
                  setUsername(value);
                  setUsernameTouched(true);
                  setServerFieldErrors((prev) => ({ ...prev, username: undefined }));
                  setSubmitError(null);
                }}
                status={usernameStatus}
              />
              <TextInput
                label="Display Name"
                placeholder="e.g. Alice Nguyen"
                isRequired
                value={displayName}
                onChange={(value) => {
                  setDisplayName(value);
                  setDisplayNameTouched(true);
                  setServerFieldErrors((prev) => ({ ...prev, displayName: undefined }));
                  setSubmitError(null);
                }}
                status={displayNameStatus}
              />
              <Selector
                label="Department Role"
                isRequired
                options={STAFF_ROLE_OPTIONS}
                value={role}
                onChange={(value) => {
                  setRole(value as UserRole);
                  setServerFieldErrors((prev) => ({ ...prev, role: undefined }));
                }}
                status={
                  serverFieldErrors.role
                    ? { type: 'error', message: serverFieldErrors.role }
                    : undefined
                }
              />
              <TextInput
                type="password"
                label="Password"
                placeholder="Minimum 12 characters"
                autoComplete="new-password"
                description="Must be between 12 and 128 characters."
                isRequired
                value={password}
                onChange={(value) => {
                  setPassword(value);
                  setPasswordTouched(true);
                  setServerFieldErrors((prev) => ({ ...prev, password: undefined }));
                  setSubmitError(null);
                }}
                status={passwordStatus}
              />
              <HStack gap={2} vAlign="center">
                <Button
                  type="submit"
                  variant="primary"
                  label="Register Staff"
                  isLoading={submitting}
                  isDisabled={!isFormValid || submitting}
                />
              </HStack>
            </FormLayout>
          </form>
        </VStack>
      </Card>

      <Card padding={6}>
        <VStack gap={4}>
          <HStack hAlign="between" vAlign="center" wrap="wrap" gap={2}>
            <HStack gap={2} vAlign="center">
              <Heading level={2}>Staff Roster</Heading>
              <Badge variant="neutral" label={employees.length} />
            </HStack>
          </HStack>

          <ApiErrorBanner
            title="Failed to load staff roster"
            error={loadError}
            onDismiss={() => setLoadError(null)}
          />

          {loading && employees.length === 0 ? (
            <Center padding={8}>
              <VStack gap={3} hAlign="center">
                <Spinner size="lg" label="Loading staff accounts..." />
                <Text type="supporting">Loading staff accounts...</Text>
              </VStack>
            </Center>
          ) : (
            <>
              <Table<EmployeeRow>
                aria-label="Staff Roster"
                density="compact"
                dividers="rows"
                hasHover
                idKey="id"
                columns={columns}
                data={pagination.paginatedItems}
                rowIndexStart={pagination.rowIndexStart}
                rowCount={pagination.totalItems}
                emptyState={
                  <EmptyState
                    title="No staff accounts found"
                    description="Use the form to register a department employee."
                    icon={<Icon icon="info" />}
                    isCompact
                  />
                }
              />
              <TablePaginationFooter
                page={pagination.page}
                pageSize={pagination.pageSize}
                totalItems={pagination.totalItems}
                onPageChange={pagination.setPage}
                onPageSizeChange={pagination.setPageSize}
                label="Staff roster pagination"
              />
            </>
          )}
        </VStack>
      </Card>
    </Grid>
  );
}

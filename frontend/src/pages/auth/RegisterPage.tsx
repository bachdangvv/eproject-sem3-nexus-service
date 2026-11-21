/**
 * Self-service customer registration page (/register) with public territory city lookup
 * and immediate cookie session hydration on account creation.
 */
import { useCallback, useEffect, useMemo, useState, type FormEvent, type JSX } from 'react';
import { AspectRatio } from '@astryxdesign/core/AspectRatio';
import { Button } from '@astryxdesign/core/Button';
import { Center } from '@astryxdesign/core/Center';
import { FormLayout } from '@astryxdesign/core/FormLayout';
import { Grid } from '@astryxdesign/core/Grid';
import { HStack } from '@astryxdesign/core/HStack';
import { Heading } from '@astryxdesign/core/Heading';
import { Link } from '@astryxdesign/core/Link';
import { Section } from '@astryxdesign/core/Section';
import { Selector } from '@astryxdesign/core/Selector';
import { StackItem } from '@astryxdesign/core/Stack';
import { Text } from '@astryxdesign/core/Text';
import { TextArea } from '@astryxdesign/core/TextArea';
import { TextInput } from '@astryxdesign/core/TextInput';
import { useToast } from '@astryxdesign/core/Toast';
import { TopNavHeading } from '@astryxdesign/core/TopNav';
import { VStack } from '@astryxdesign/core/VStack';
import nexusLoginIllustration from '../../assets/nexus-login-illustration.png';
import { ApiErrorBanner } from '../../components/StatusViews';
import { useAuth } from '../../context/AuthContext';
import { RoutePath, getDefaultRouteForRole, useRouter } from '../../router/router';
import { getPublicCities } from '../../services/publicApi';
import { ApiError, type CityView, type RegisterCustomerInput } from '../../types/nexus';

const USERNAME_REGEX = /^[a-zA-Z0-9._-]{3,40}$/;
const RESERVED_CUSTOMER_USERNAME_REGEX = /^cus-[0-9]+$/i;
const PHONE_REGEX = /^\+?[0-9]{7,15}$/;
const CITY_CODE_REGEX = /^[0-9]{3}$/;
const EMAIL_REGEX = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

const CUSTOMER_TYPE_OPTIONS: Array<{ value: string; label: string }> = [
  { value: 'Individual', label: 'Individual' },
  { value: 'Residential', label: 'Residential' },
  { value: 'Corporate', label: 'Corporate' },
  { value: 'Enterprise', label: 'Enterprise' },
  { value: 'Government', label: 'Government' },
];

interface RegisterFieldErrors {
  name?: string;
  email?: string;
  phone?: string;
  cityCode?: string;
  address?: string;
  username?: string;
  password?: string;
  contactPerson?: string;
  taxId?: string;
  customerType?: string;
}

function extractFieldErrors(err: unknown): Record<string, string> {
  if (!(err instanceof ApiError) || !err.errors) {
    return {};
  }
  const mapped: Record<string, string> = {};
  for (const [key, messages] of Object.entries(err.errors)) {
    if (Array.isArray(messages) && messages.length > 0 && messages[0]) {
      mapped[key.toLowerCase()] = messages[0];
    }
  }
  return mapped;
}

export function RegisterPage(): JSX.Element {
  const { session, isBootstrapping, register } = useAuth();
  const { replace } = useRouter();
  const toast = useToast();

  const [cities, setCities] = useState<CityView[]>([]);
  const [citiesLoading, setCitiesLoading] = useState(true);
  const [citiesError, setCitiesError] = useState<string | null>(null);

  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [phone, setPhone] = useState('');
  const [cityCode, setCityCode] = useState('');
  const [address, setAddress] = useState('');
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [customerType, setCustomerType] = useState<string | null>(null);
  const [contactPerson, setContactPerson] = useState('');
  const [taxId, setTaxId] = useState('');

  const [fieldErrors, setFieldErrors] = useState<RegisterFieldErrors>({});
  const [submitError, setSubmitError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);

  const authenticatedRole = session?.username && session?.role ? session.role : null;

  useEffect(() => {
    if (!isBootstrapping && authenticatedRole) {
      replace(getDefaultRouteForRole(authenticatedRole));
    }
  }, [authenticatedRole, isBootstrapping, replace]);

  const loadCities = useCallback(async () => {
    setCitiesLoading(true);
    setCitiesError(null);
    try {
      const list = await getPublicCities();
      setCities(list);
    } catch (err) {
      setCitiesError(
        err instanceof ApiError
          ? err.detail || err.message
          : 'Failed to load service territory cities.',
      );
    } finally {
      setCitiesLoading(false);
    }
  }, []);

  useEffect(() => {
    let cancelled = false;
    getPublicCities()
      .then((list) => {
        if (!cancelled) {
          setCities(list);
          setCitiesError(null);
        }
      })
      .catch((err) => {
        if (!cancelled) {
          setCitiesError(
            err instanceof ApiError
              ? err.detail || err.message
              : 'Failed to load service territory cities.',
          );
        }
      })
      .finally(() => {
        if (!cancelled) {
          setCitiesLoading(false);
        }
      });
    return () => {
      cancelled = true;
    };
  }, []);

  const cityOptions = useMemo(
    () =>
      cities.map((c) => ({
        value: c.code,
        label: `${c.code} — ${c.name}`,
      })),
    [cities],
  );

  const validateForm = (): RegisterFieldErrors => {
    const errors: RegisterFieldErrors = {};
    const trimmedName = name.trim();
    const trimmedEmail = email.trim();
    const trimmedPhone = phone.trim();
    const trimmedCity = cityCode.trim();
    const trimmedAddress = address.trim();
    const trimmedUsername = username.trim();

    if (!trimmedName) {
      errors.name = 'Full name or organization name is required.';
    } else if (trimmedName.length > 120) {
      errors.name = 'Name must be 120 characters or fewer.';
    }

    if (trimmedEmail && (!EMAIL_REGEX.test(trimmedEmail) || trimmedEmail.length > 160)) {
      errors.email = 'Enter a valid email address.';
    }

    if (!trimmedPhone) {
      errors.phone = 'Phone number is required.';
    } else if (!PHONE_REGEX.test(trimmedPhone)) {
      errors.phone = 'Phone must be 7-15 digits (optional leading +).';
    }

    if (!trimmedCity) {
      errors.cityCode = 'Select a service territory city.';
    } else if (!CITY_CODE_REGEX.test(trimmedCity)) {
      errors.cityCode = 'City code must be a valid 3-digit code.';
    }

    if (!trimmedAddress) {
      errors.address = 'Installation address is required.';
    } else if (trimmedAddress.length > 240) {
      errors.address = 'Address must be 240 characters or fewer.';
    }

    if (!trimmedUsername) {
      errors.username = 'Username is required.';
    } else if (RESERVED_CUSTOMER_USERNAME_REGEX.test(trimmedUsername)) {
      errors.username = 'Usernames matching "cus-<digits>" are reserved.';
    } else if (!USERNAME_REGEX.test(trimmedUsername)) {
      errors.username =
        'Username must be 3-40 characters using letters, numbers, ".", "_", or "-".';
    }

    if (!password) {
      errors.password = 'Password is required (12-128 characters).';
    } else if (password.trim().length === 0) {
      errors.password = 'Password cannot consist solely of whitespace.';
    } else if (password.length < 12 || password.length > 128) {
      errors.password = 'Password must be between 12 and 128 characters.';
    }

    if (contactPerson.trim().length > 120) {
      errors.contactPerson = 'Contact person must be 120 characters or fewer.';
    }
    if (taxId.trim().length > 32) {
      errors.taxId = 'Tax ID must be 32 characters or fewer.';
    }

    return errors;
  };

  const handleSubmit = async (e: FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    if (submitting) return;
    setSubmitError(null);

    const validationErrors = validateForm();
    setFieldErrors(validationErrors);
    if (Object.keys(validationErrors).length > 0) {
      return;
    }

    const payload: RegisterCustomerInput = {
      name: name.trim(),
      email: email.trim() || null,
      phone: phone.trim(),
      cityCode: cityCode.trim(),
      address: address.trim(),
      username: username.trim(),
      password,
      customerType: customerType ?? null,
      contactPerson: contactPerson.trim() || null,
      taxId: taxId.trim() || null,
    };

    setSubmitting(true);
    try {
      const nextSession = await register(payload);
      toast({
        body: `Account created for ${nextSession.displayName || payload.name}${nextSession.customerCode ? ` (${nextSession.customerCode})` : ''}.`,
      });
      replace(RoutePath.CUSTOMER_PROFILE);
    } catch (err) {
      const serverFields = extractFieldErrors(err);
      setFieldErrors((prev) => ({
        ...prev,
        name: serverFields.name ?? prev.name,
        email: serverFields.email ?? prev.email,
        phone: serverFields.phone ?? prev.phone,
        cityCode: serverFields.citycode ?? prev.cityCode,
        address: serverFields.address ?? prev.address,
        username: serverFields.username ?? prev.username,
        password: serverFields.password ?? prev.password,
        contactPerson: serverFields.contactperson ?? prev.contactPerson,
        taxId: serverFields.taxid ?? prev.taxId,
        customerType: serverFields.customertype ?? prev.customerType,
      }));
      setSubmitError(
        err instanceof ApiError
          ? err.detail || err.message
          : err instanceof Error
            ? err.message
            : 'Registration failed. Please verify your details and try again.',
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
            <Center width="100%" height="100%" paddingInline={6} paddingBlock={6}>
              <VStack gap={5} width="100%" maxWidth={460}>
                <VStack gap={1.5}>
                  <Heading level={1} type="display-3">
                    Create your Nexus account
                  </Heading>
                  <Text type="supporting">
                    Register as a subscriber to request services, track installations, and manage
                    your connections.
                  </Text>
                </VStack>

                <ApiErrorBanner
                  title="Could not load cities"
                  error={citiesError}
                  onDismiss={() => setCitiesError(null)}
                />
                {citiesError && (
                  <HStack hAlign="start">
                    <Button
                      size="sm"
                      variant="secondary"
                      label="Retry loading cities"
                      onClick={() => void loadCities()}
                    />
                  </HStack>
                )}

                <ApiErrorBanner
                  title="Registration failed"
                  error={submitError}
                  onDismiss={() => setSubmitError(null)}
                />

                <form onSubmit={(e) => void handleSubmit(e)}>
                  <FormLayout>
                    <TextInput
                      label="Full Name or Organization"
                      htmlName="name"
                      autoComplete="name"
                      placeholder="e.g. Jordan Rivera"
                      isRequired
                      value={name}
                      onChange={(value) => {
                        setName(value);
                        setFieldErrors((prev) => ({ ...prev, name: undefined }));
                      }}
                      status={
                        fieldErrors.name ? { type: 'error', message: fieldErrors.name } : undefined
                      }
                    />

                    <Grid columns={{ minWidth: 180, max: 2 }} gap={3}>
                      <TextInput
                        label="Email"
                        htmlName="email"
                        type="email"
                        autoComplete="email"
                        placeholder="e.g. jordan@example.com"
                        isOptional
                        value={email}
                        onChange={(value) => {
                          setEmail(value);
                          setFieldErrors((prev) => ({ ...prev, email: undefined }));
                        }}
                        status={
                          fieldErrors.email
                            ? { type: 'error', message: fieldErrors.email }
                            : undefined
                        }
                      />
                      <TextInput
                        label="Phone"
                        htmlName="phone"
                        type="tel"
                        autoComplete="tel"
                        placeholder="e.g. +15551234567"
                        isRequired
                        value={phone}
                        onChange={(value) => {
                          setPhone(value);
                          setFieldErrors((prev) => ({ ...prev, phone: undefined }));
                        }}
                        status={
                          fieldErrors.phone
                            ? { type: 'error', message: fieldErrors.phone }
                            : undefined
                        }
                      />
                    </Grid>

                    <Selector
                      label="Territory City"
                      htmlName="cityCode"
                      placeholder={citiesLoading ? 'Loading cities...' : 'Select your city'}
                      hasSearch
                      searchPlaceholder="Search city code or name..."
                      isLoading={citiesLoading}
                      isRequired
                      options={cityOptions}
                      value={cityCode}
                      onChange={(value) => {
                        setCityCode(value);
                        setFieldErrors((prev) => ({ ...prev, cityCode: undefined }));
                      }}
                      status={
                        fieldErrors.cityCode
                          ? { type: 'error', message: fieldErrors.cityCode }
                          : undefined
                      }
                    />

                    <TextArea
                      label="Installation Address"
                      htmlName="address"
                      autoComplete="street-address"
                      placeholder="Street address, suite, or building..."
                      rows={2}
                      maxLength={240}
                      isRequired
                      value={address}
                      onChange={(value) => {
                        setAddress(value);
                        setFieldErrors((prev) => ({ ...prev, address: undefined }));
                      }}
                      status={
                        fieldErrors.address
                          ? { type: 'error', message: fieldErrors.address }
                          : undefined
                      }
                    />

                    <Grid columns={{ minWidth: 180, max: 2 }} gap={3}>
                      <TextInput
                        label="Username"
                        htmlName="username"
                        autoComplete="username"
                        placeholder="e.g. jordan.rivera"
                        description="3-40 chars (letters, digits, ., _, -)."
                        isRequired
                        value={username}
                        onChange={(value) => {
                          setUsername(value);
                          setFieldErrors((prev) => ({ ...prev, username: undefined }));
                        }}
                        status={
                          fieldErrors.username
                            ? { type: 'error', message: fieldErrors.username }
                            : undefined
                        }
                      />
                      <TextInput
                        label="Password"
                        htmlName="password"
                        type="password"
                        autoComplete="new-password"
                        placeholder="12-128 characters"
                        description="Minimum 12 characters."
                        isRequired
                        value={password}
                        onChange={(value) => {
                          setPassword(value);
                          setFieldErrors((prev) => ({ ...prev, password: undefined }));
                        }}
                        status={
                          fieldErrors.password
                            ? { type: 'error', message: fieldErrors.password }
                            : undefined
                        }
                      />
                    </Grid>

                    <Grid columns={{ minWidth: 140, max: 3 }} gap={3}>
                      <Selector
                        label="Customer Type"
                        htmlName="customerType"
                        placeholder="Optional"
                        hasClear
                        isOptional
                        options={CUSTOMER_TYPE_OPTIONS}
                        value={customerType}
                        onChange={(value) => {
                          setCustomerType(value);
                          setFieldErrors((prev) => ({ ...prev, customerType: undefined }));
                        }}
                        status={
                          fieldErrors.customerType
                            ? { type: 'error', message: fieldErrors.customerType }
                            : undefined
                        }
                      />
                      <TextInput
                        label="Contact Person"
                        htmlName="contactPerson"
                        placeholder="Optional"
                        isOptional
                        value={contactPerson}
                        onChange={(value) => {
                          setContactPerson(value);
                          setFieldErrors((prev) => ({ ...prev, contactPerson: undefined }));
                        }}
                        status={
                          fieldErrors.contactPerson
                            ? { type: 'error', message: fieldErrors.contactPerson }
                            : undefined
                        }
                      />
                      <TextInput
                        label="Tax ID"
                        htmlName="taxId"
                        placeholder="Optional"
                        isOptional
                        value={taxId}
                        onChange={(value) => {
                          setTaxId(value);
                          setFieldErrors((prev) => ({ ...prev, taxId: undefined }));
                        }}
                        status={
                          fieldErrors.taxId
                            ? { type: 'error', message: fieldErrors.taxId }
                            : undefined
                        }
                      />
                    </Grid>

                    <HStack hAlign="between" vAlign="center" gap={3} wrap="wrap">
                      <Button
                        type="submit"
                        variant="primary"
                        label="Create Account"
                        isLoading={submitting}
                        isDisabled={submitting}
                      />
                      <HStack gap={3} vAlign="center" wrap="wrap">
                        <Link href={RoutePath.LOGIN} type="supporting" color="primary" hasUnderline>
                          Already have an account? Sign in
                        </Link>
                        <Link href={RoutePath.HOME} type="supporting" color="secondary" hasUnderline>
                          Back to Home
                        </Link>
                      </HStack>
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

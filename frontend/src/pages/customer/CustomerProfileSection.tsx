/**
 * Customer subscriber profile view and contact information editor (/customer/profile).
 */
import { useCallback, useEffect, useMemo, useRef, useState, type FormEvent, type JSX } from 'react';
import { Banner } from '@astryxdesign/core/Banner';
import { Button } from '@astryxdesign/core/Button';
import { Card } from '@astryxdesign/core/Card';
import { Center } from '@astryxdesign/core/Center';
import { Code } from '@astryxdesign/core/Code';
import { FormLayout } from '@astryxdesign/core/FormLayout';
import { Grid } from '@astryxdesign/core/Grid';
import { HStack } from '@astryxdesign/core/HStack';
import { Heading } from '@astryxdesign/core/Heading';
import { MetadataList, MetadataListItem } from '@astryxdesign/core/MetadataList';
import { Selector } from '@astryxdesign/core/Selector';
import { Spinner } from '@astryxdesign/core/Spinner';
import { Text } from '@astryxdesign/core/Text';
import { TextArea } from '@astryxdesign/core/TextArea';
import { TextInput } from '@astryxdesign/core/TextInput';
import { useToast } from '@astryxdesign/core/Toast';
import { VStack } from '@astryxdesign/core/VStack';
import {
  ApiErrorBanner,
  CopyableId,
  CustomerStatusPill,
  StatusLabel,
} from '../../components/StatusViews';
import { useAuth } from '../../context/AuthContext';
import { getProfile, updateProfile } from '../../services/customerApi';
import { getPublicCities } from '../../services/publicApi';
import type { CityView, CustomerProfileView } from '../../types/nexus';
import {
  CUSTOMER_TYPE_OPTIONS,
  extractErrorMessage,
  extractFieldErrors,
  type CustomerSectionProps,
} from './customerTypes';

const PHONE_REGEX = /^\+?[0-9]{7,15}$/;
const EMAIL_REGEX = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

interface ProfileFieldErrors {
  name?: string;
  phone?: string;
  email?: string;
  cityCode?: string;
  address?: string;
  contactPerson?: string;
  taxId?: string;
}

export function CustomerProfileSection({
  refreshTrigger,
  onCountChange,
  onRefreshingChange,
}: CustomerSectionProps): JSX.Element {
  const { refreshSession } = useAuth();
  const toast = useToast();

  const [profile, setProfile] = useState<CustomerProfileView | null>(null);
  const [cities, setCities] = useState<CityView[]>([]);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState<string | null>(null);

  const [name, setName] = useState('');
  const [phone, setPhone] = useState('');
  const [email, setEmail] = useState('');
  const [cityCode, setCityCode] = useState('');
  const [address, setAddress] = useState('');
  const [customerType, setCustomerType] = useState<string | null>(null);
  const [contactPerson, setContactPerson] = useState('');
  const [taxId, setTaxId] = useState('');

  const [fieldErrors, setFieldErrors] = useState<ProfileFieldErrors>({});
  const [saveError, setSaveError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);

  const isMountedRef = useRef(true);
  const hasLoadedRef = useRef(false);
  const seqRef = useRef(0);

  useEffect(() => {
    isMountedRef.current = true;
    return () => {
      isMountedRef.current = false;
    };
  }, []);

  const populateForm = useCallback((p: CustomerProfileView) => {
    setName(p.name);
    setPhone(p.phone);
    setEmail(p.email ?? '');
    setCityCode(p.cityCode);
    setAddress(p.address);
    setCustomerType(p.customerType ?? null);
    setContactPerson(p.contactPerson ?? '');
    setTaxId(p.taxId ?? '');
    setFieldErrors({});
  }, []);

  const loadData = useCallback(
    async (silent = false) => {
      const seq = ++seqRef.current;
      if (silent) {
        onRefreshingChange(true);
      } else {
        setLoading(true);
      }
      setLoadError(null);
      try {
        const [profileData, cityList] = await Promise.all([getProfile(), getPublicCities()]);
        if (!isMountedRef.current || seq !== seqRef.current) return;
        setProfile(profileData);
        setCities(cityList);
        populateForm(profileData);
        onCountChange(1);
      } catch (err) {
        if (!isMountedRef.current || seq !== seqRef.current) return;
        setLoadError(extractErrorMessage(err, 'Failed to load subscriber profile.'));
      } finally {
        if (isMountedRef.current && seq === seqRef.current) {
          setLoading(false);
          onRefreshingChange(false);
        }
      }
    },
    [onCountChange, onRefreshingChange, populateForm],
  );

  useEffect(() => {
    const silent = hasLoadedRef.current && refreshTrigger > 0;
    hasLoadedRef.current = true;
    void loadData(silent);
  }, [loadData, refreshTrigger]);

  const cityOptions = useMemo(
    () =>
      cities.map((c) => ({
        value: c.code,
        label: `${c.code} — ${c.name}`,
      })),
    [cities],
  );

  const isSuspended = profile?.status === 'SUSPENDED';

  const validate = (): ProfileFieldErrors => {
    const errors: ProfileFieldErrors = {};
    if (!name.trim()) {
      errors.name = 'Full name or organization name is required.';
    } else if (name.trim().length > 120) {
      errors.name = 'Name must be 120 characters or fewer.';
    }
    if (!phone.trim()) {
      errors.phone = 'Phone number is required.';
    } else if (!PHONE_REGEX.test(phone.trim())) {
      errors.phone = 'Phone must be 7-15 digits (optional leading +).';
    }
    if (email.trim() && (!EMAIL_REGEX.test(email.trim()) || email.trim().length > 160)) {
      errors.email = 'Enter a valid email address.';
    }
    if (!cityCode.trim()) {
      errors.cityCode = 'Select a territory city.';
    }
    if (!address.trim()) {
      errors.address = 'Installation address is required.';
    } else if (address.trim().length > 240) {
      errors.address = 'Address must be 240 characters or fewer.';
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
    if (!profile || saving) return;
    setSaveError(null);

    const validationErrors = validate();
    setFieldErrors(validationErrors);
    if (Object.keys(validationErrors).length > 0) {
      return;
    }

    setSaving(true);
    try {
      const updated = await updateProfile({
        name: name.trim(),
        phone: phone.trim(),
        address: address.trim(),
        cityCode: cityCode.trim(),
        email: email.trim() || null,
        contactPerson: contactPerson.trim() || null,
        taxId: taxId.trim() || null,
        customerType: customerType ?? null,
      });
      if (!isMountedRef.current) return;
      setProfile(updated);
      populateForm(updated);
      await refreshSession();
      toast({ body: 'Subscriber profile updated.' });
    } catch (err) {
      if (!isMountedRef.current) return;
      const serverFields = extractFieldErrors(err);
      setFieldErrors((prev) => ({
        ...prev,
        name: serverFields.name ?? prev.name,
        phone: serverFields.phone ?? prev.phone,
        email: serverFields.email ?? prev.email,
        cityCode: serverFields.citycode ?? prev.cityCode,
        address: serverFields.address ?? prev.address,
        contactPerson: serverFields.contactperson ?? prev.contactPerson,
        taxId: serverFields.taxid ?? prev.taxId,
      }));
      setSaveError(extractErrorMessage(err, 'Could not update profile.'));
    } finally {
      if (isMountedRef.current) {
        setSaving(false);
      }
    }
  };

  if (loading && !profile) {
    return (
      <Card padding={6}>
        <Center padding={6}>
          <VStack gap={3} hAlign="center">
            <Spinner size="lg" label="Loading subscriber profile..." />
            <Text type="supporting">Loading account profile and territory data...</Text>
          </VStack>
        </Center>
      </Card>
    );
  }

  return (
    <VStack gap={5}>
      <ApiErrorBanner
        title="Failed to load profile"
        error={loadError}
        onDismiss={() => setLoadError(null)}
      />

      {isSuspended && (
        <Banner
          status="warning"
          container="card"
          collapsible={false}
          title="Account Suspended"
          description="Your subscriber account is suspended. You can inspect your records in read-only mode, but profile edits, new requests, online payments, plan changes, queries, and feedback are blocked until an administrator reactivates your account."
        />
      )}

      {profile && (
        <Card padding={5}>
          <VStack gap={4}>
            <Heading level={2}>Account Overview</Heading>
            <MetadataList columns={2}>
              <MetadataListItem label="Customer Code">
                <CopyableId value={profile.code} label="Customer Code" />
              </MetadataListItem>
              <MetadataListItem label="Customer Status">
                <CustomerStatusPill status={profile.status} />
              </MetadataListItem>
              <MetadataListItem label="Portal Login">
                <StatusLabel
                  variant={profile.active ? 'success' : 'error'}
                  label={profile.active ? 'Active' : 'Deactivated'}
                />
              </MetadataListItem>
              <MetadataListItem label="Login Username">
                <Code>{profile.username}</Code>
              </MetadataListItem>
            </MetadataList>
          </VStack>
        </Card>
      )}

      <Card padding={5}>
        <VStack gap={4}>
          <VStack gap={1}>
            <Heading level={2}>Contact & Installation Details</Heading>
            <Text type="supporting">
              Keep your installation address, phone, and billing contact details up to date.
            </Text>
          </VStack>

          <ApiErrorBanner
            title="Could not save profile"
            error={saveError}
            onDismiss={() => setSaveError(null)}
          />

          <form onSubmit={(e) => void handleSubmit(e)}>
            <FormLayout>
              <Grid columns={{ minWidth: 220, max: 2 }} gap={4}>
                <TextInput
                  label="Full Name or Organization"
                  htmlName="name"
                  isRequired
                  isDisabled={isSuspended || saving}
                  value={name}
                  onChange={(val) => {
                    setName(val);
                    setFieldErrors((prev) => ({ ...prev, name: undefined }));
                  }}
                  status={
                    fieldErrors.name ? { type: 'error', message: fieldErrors.name } : undefined
                  }
                />
                <TextInput
                  label="Phone"
                  htmlName="phone"
                  type="tel"
                  isRequired
                  isDisabled={isSuspended || saving}
                  value={phone}
                  onChange={(val) => {
                    setPhone(val);
                    setFieldErrors((prev) => ({ ...prev, phone: undefined }));
                  }}
                  status={
                    fieldErrors.phone ? { type: 'error', message: fieldErrors.phone } : undefined
                  }
                />
                <TextInput
                  label="Email"
                  htmlName="email"
                  type="email"
                  isOptional
                  isDisabled={isSuspended || saving}
                  value={email}
                  onChange={(val) => {
                    setEmail(val);
                    setFieldErrors((prev) => ({ ...prev, email: undefined }));
                  }}
                  status={
                    fieldErrors.email ? { type: 'error', message: fieldErrors.email } : undefined
                  }
                />
                <Selector
                  label="Territory City"
                  htmlName="cityCode"
                  hasSearch
                  isRequired
                  isDisabled={isSuspended || saving}
                  options={cityOptions}
                  value={cityCode}
                  onChange={(val) => {
                    setCityCode(val);
                    setFieldErrors((prev) => ({ ...prev, cityCode: undefined }));
                  }}
                  status={
                    fieldErrors.cityCode
                      ? { type: 'error', message: fieldErrors.cityCode }
                      : undefined
                  }
                />
              </Grid>

              <TextArea
                label="Installation Address"
                htmlName="address"
                rows={2}
                maxLength={240}
                isRequired
                isDisabled={isSuspended || saving}
                value={address}
                onChange={(val) => {
                  setAddress(val);
                  setFieldErrors((prev) => ({ ...prev, address: undefined }));
                }}
                status={
                  fieldErrors.address ? { type: 'error', message: fieldErrors.address } : undefined
                }
              />

              <Grid columns={{ minWidth: 180, max: 3 }} gap={4}>
                <Selector
                  label="Customer Type"
                  htmlName="customerType"
                  placeholder="Optional"
                  hasClear
                  isOptional
                  isDisabled={isSuspended || saving}
                  options={CUSTOMER_TYPE_OPTIONS}
                  value={customerType}
                  onChange={setCustomerType}
                />
                <TextInput
                  label="Contact Person"
                  htmlName="contactPerson"
                  placeholder="Optional"
                  isOptional
                  isDisabled={isSuspended || saving}
                  value={contactPerson}
                  onChange={(val) => {
                    setContactPerson(val);
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
                  isDisabled={isSuspended || saving}
                  value={taxId}
                  onChange={(val) => {
                    setTaxId(val);
                    setFieldErrors((prev) => ({ ...prev, taxId: undefined }));
                  }}
                  status={
                    fieldErrors.taxId ? { type: 'error', message: fieldErrors.taxId } : undefined
                  }
                />
              </Grid>

              <HStack gap={2} wrap="wrap">
                <Button
                  type="submit"
                  variant="primary"
                  label="Save Changes"
                  isLoading={saving}
                  isDisabled={isSuspended || saving || !profile}
                />
                <Button
                  variant="secondary"
                  label="Reset"
                  isDisabled={isSuspended || saving || !profile}
                  onClick={() => {
                    if (profile) {
                      populateForm(profile);
                      setSaveError(null);
                    }
                  }}
                />
              </HStack>
            </FormLayout>
          </form>
        </VStack>
      </Card>
    </VStack>
  );
}

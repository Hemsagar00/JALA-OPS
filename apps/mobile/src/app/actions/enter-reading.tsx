import React, { useState, useEffect, useCallback } from 'react';
import {
  ActivityIndicator,
  Alert,
  Image,
  KeyboardAvoidingView,
  Platform,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from 'react-native';
import { useRouter } from 'expo-router';
import * as Location from 'expo-location';
import * as ImagePicker from 'expo-image-picker';
import NetInfo from '@react-native-community/netinfo';
import { BRAND } from '@jala-ops/constants';
import type { GpsStatus, CreateReadingPayload } from '@jala-ops/types';
import { createReadingSchema } from '@jala-ops/validation';
import { createApiClient } from '@jala-ops/api-client';
import { useSession } from '../../lib/auth-context';
import { getStoredToken, API_URL } from '../../lib/session';
import { enqueueReading } from '../../lib/offline-db';
import { processQueue } from '../../lib/sync-engine';

function generateUUID(): string {
  if (typeof crypto !== 'undefined' && typeof crypto.randomUUID === 'function') {
    return crypto.randomUUID();
  }
  return 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, (c) => {
    const r = (Math.random() * 16) | 0;
    const v = c === 'x' ? r : (r & 0x3) | 0x8;
    return v.toString(16);
  });
}

export default function EnterReadingScreen() {
  const router = useRouter();
  const { activeStation, assignedStations, setActiveStationId, pumps } = useSession();

  // Selected pump (optional)
  const [selectedPumpId, setSelectedPumpId] = useState<string | null>(null);

  // Form fields
  const [flowMeter, setFlowMeter] = useState('');
  const [energyMeter, setEnergyMeter] = useState('');
  const [inletPressure, setInletPressure] = useState('');
  const [outletPressure, setOutletPressure] = useState('');
  const [tankLevelPct, setTankLevelPct] = useState('');

  // Optional fields
  const [showAdvanced, setShowAdvanced] = useState(false);
  const [residualChlorine, setResidualChlorine] = useState('');
  const [turbidity, setTurbidity] = useState('');
  const [remarks, setRemarks] = useState('');

  // Photo
  const [photoUri, setPhotoUri] = useState<string | null>(null);

  // GPS state
  const [gpsStatus, setGpsStatus] = useState<GpsStatus>('NOT_AVAILABLE');
  const [coords, setCoords] = useState<{
    latitude: number | null;
    longitude: number | null;
    accuracy: number | null;
  }>({ latitude: null, longitude: null, accuracy: null });
  const [gpsLoading, setGpsLoading] = useState(false);

  // Submission state
  const [submitting, setSubmitting] = useState(false);
  const [errors, setErrors] = useState<Record<string, string>>({});

  // Capture GPS coordinates on load
  const captureGps = useCallback(async () => {
    setGpsLoading(true);
    try {
      const { status } = await Location.requestForegroundPermissionsAsync();
      if (status !== 'granted') {
        setGpsStatus('PERMISSION_DENIED');
        setCoords({ latitude: null, longitude: null, accuracy: null });
        setGpsLoading(false);
        return;
      }

      const location = await Location.getCurrentPositionAsync({
        accuracy: Location.Accuracy.Balanced,
      });

      const acc = location.coords.accuracy ?? null;
      const statusValue: GpsStatus = acc && acc > 100 ? 'LOW_ACCURACY' : 'CAPTURED';

      setGpsStatus(statusValue);
      setCoords({
        latitude: location.coords.latitude,
        longitude: location.coords.longitude,
        accuracy: acc,
      });
    } catch {
      setGpsStatus('NOT_AVAILABLE');
      setCoords({ latitude: null, longitude: null, accuracy: null });
    } finally {
      setGpsLoading(false);
    }
  }, []);

  useEffect(() => {
    captureGps();
  }, [captureGps]);

  // Photo selection/capture
  const takePhoto = async () => {
    try {
      const { status } = await ImagePicker.requestCameraPermissionsAsync();
      if (status !== 'granted') {
        Alert.alert(
          'Camera Permission Required',
          'Camera permission is needed to take reading evidence photos.',
        );
        return;
      }

      const result = await ImagePicker.launchCameraAsync({
        mediaTypes: ImagePicker.MediaTypeOptions.Images,
        allowsEditing: false,
        quality: 0.7,
      });

      if (!result.canceled && result.assets && result.assets.length > 0) {
        const firstAsset = result.assets[0];
        if (firstAsset) {
          setPhotoUri(firstAsset.uri);
        }
      }
    } catch (err: unknown) {
      console.warn('Camera launch error:', err);
    }
  };

  const choosePhoto = async () => {
    try {
      const result = await ImagePicker.launchImageLibraryAsync({
        mediaTypes: ImagePicker.MediaTypeOptions.Images,
        allowsEditing: false,
        quality: 0.7,
      });

      if (!result.canceled && result.assets && result.assets.length > 0) {
        const firstAsset = result.assets[0];
        if (firstAsset) {
          setPhotoUri(firstAsset.uri);
        }
      }
    } catch (err: unknown) {
      console.warn('Gallery pick error:', err);
    }
  };

  const removePhoto = () => {
    setPhotoUri(null);
  };

  // Submission handler
  const handleSubmit = async () => {
    setErrors({});

    if (!activeStation) {
      Alert.alert('No Station', 'Please select an assigned station first.');
      return;
    }

    const clientUuid = generateUUID();
    const recordedAt = new Date().toISOString();

    const payloadRaw = {
      clientUuid,
      stationId: activeStation.id,
      pumpId: selectedPumpId || undefined,
      flowMeter: parseFloat(flowMeter),
      energyMeter: parseFloat(energyMeter),
      inletPressure: parseFloat(inletPressure),
      outletPressure: parseFloat(outletPressure),
      tankLevelPct: parseFloat(tankLevelPct),
      residualChlorine: residualChlorine ? parseFloat(residualChlorine) : undefined,
      turbidity: turbidity ? parseFloat(turbidity) : undefined,
      remarks: remarks.trim() ? remarks.trim() : undefined,
      latitude: coords.latitude ?? undefined,
      longitude: coords.longitude ?? undefined,
      gpsAccuracyM: coords.accuracy ?? undefined,
      gpsStatus,
      sourceType: 'MANUAL' as const,
      syncSource: 'ONLINE' as const,
      recordedAt,
    };

    const parsed = createReadingSchema.safeParse(payloadRaw);
    if (!parsed.success) {
      const fieldErrors: Record<string, string> = {};
      for (const issue of parsed.error.issues) {
        const path = issue.path[0] as string;
        if (!fieldErrors[path]) {
          fieldErrors[path] = issue.message;
        }
      }
      setErrors(fieldErrors);
      Alert.alert('Validation Error', 'Please check highlighted fields before submitting.');
      return;
    }

    setSubmitting(true);

    try {
      const netState = await NetInfo.fetch();
      const isOnline = Boolean(netState.isConnected && netState.isInternetReachable !== false);

      const token = await getStoredToken();

      if (isOnline && token) {
        // Attempt online upload
        try {
          const client = createApiClient(API_URL, { token });
          let photoKey: string | undefined = undefined;

          if (photoUri) {
            try {
              const fileResp = await fetch(photoUri);
              const blob = await fileResp.blob();
              const uploadRes = await client.uploadPhoto(activeStation.id, blob);
              photoKey = uploadRes.photoKey;
            } catch (pErr) {
              console.warn('Online photo upload failed, proceeding with reading:', pErr);
            }
          }

          const finalPayload: CreateReadingPayload = {
            ...parsed.data,
            photoKey,
            syncSource: 'ONLINE',
          };

          await client.createReading(finalPayload);

          Alert.alert('Reading Recorded', 'Station reading successfully uploaded and verified.', [
            { text: 'OK', onPress: () => router.replace('/(tabs)/readings') },
          ]);
          return;
        } catch (onlineErr: unknown) {
          console.warn('Online submit failed, enqueuing offline:', onlineErr);
          // Fall through to offline queue
        }
      }

      // Offline or fallback to offline queue
      const offlinePayload: CreateReadingPayload = {
        ...parsed.data,
        syncSource: 'OFFLINE_QUEUE',
      };

      await enqueueReading(offlinePayload, photoUri);

      // Trigger sync engine background check
      processQueue(token).catch(console.error);

      Alert.alert(
        'Saved Offline',
        'Reading saved locally. It will synchronize automatically when connection is restored.',
        [{ text: 'OK', onPress: () => router.replace('/(tabs)/readings') }],
      );
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : 'An error occurred while saving reading.';
      Alert.alert('Save Failed', msg);
    } finally {
      setSubmitting(false);
    }
  };

  const getGpsBadge = () => {
    switch (gpsStatus) {
      case 'CAPTURED':
        return { text: 'GPS CAPTURED', bg: '#ECFDF5', textCol: '#065F46', dot: BRAND.success };
      case 'LOW_ACCURACY':
        return {
          text: `LOW ACCURACY (±${Math.round(coords.accuracy || 0)}m)`,
          bg: '#FFFBEB',
          textCol: '#92400E',
          dot: BRAND.orange,
        };
      case 'PERMISSION_DENIED':
        return {
          text: 'GPS DENIED (SAVING WITHOUT)',
          bg: '#FEF2F2',
          textCol: '#991B1B',
          dot: BRAND.critical,
        };
      case 'NOT_AVAILABLE':
      default:
        return {
          text: 'GPS UNAVAILABLE (SAVING WITHOUT)',
          bg: '#F1F5F9',
          textCol: '#475569',
          dot: BRAND.muted,
        };
    }
  };

  const gpsBadge = getGpsBadge();

  return (
    <KeyboardAvoidingView
      behavior={Platform.OS === 'ios' ? 'padding' : undefined}
      style={{ flex: 1, backgroundColor: BRAND.background }}
    >
      <ScrollView
        contentContainerStyle={styles.scrollContainer}
        keyboardShouldPersistTaps="handled"
      >
        {/* Header summary banner */}
        <View style={styles.summaryCard}>
          <View style={styles.cardRow}>
            <View style={{ flex: 1 }}>
              <Text style={styles.stationLabel}>OPERATIONAL STATION</Text>
              <Text style={styles.stationName}>
                {activeStation ? activeStation.name : 'No Station'}
              </Text>
              <Text style={styles.stationCode}>
                {activeStation ? `Code: ${activeStation.code}` : ''}
              </Text>
            </View>
            <View style={[styles.statusBadge, { backgroundColor: gpsBadge.bg }]}>
              <View style={[styles.statusDot, { backgroundColor: gpsBadge.dot }]} />
              <Text style={[styles.statusText, { color: gpsBadge.textCol }]}>{gpsBadge.text}</Text>
            </View>
          </View>

          {/* Station Switcher if multiple */}
          {assignedStations.length > 1 && (
            <ScrollView horizontal showsHorizontalScrollIndicator={false} style={styles.stationRow}>
              {assignedStations.map((st) => (
                <TouchableOpacity
                  key={st.id}
                  onPress={() => setActiveStationId(st.id)}
                  style={[
                    styles.stationChip,
                    activeStation?.id === st.id && styles.activeStationChip,
                  ]}
                >
                  <Text
                    style={[
                      styles.stationChipText,
                      activeStation?.id === st.id && styles.activeStationChipText,
                    ]}
                  >
                    {st.name}
                  </Text>
                </TouchableOpacity>
              ))}
            </ScrollView>
          )}

          {/* Pump selector optional */}
          {pumps.length > 0 && (
            <View style={styles.pumpSelector}>
              <Text style={styles.pumpLabel}>TARGET PUMP (OPTIONAL):</Text>
              <ScrollView horizontal showsHorizontalScrollIndicator={false} style={styles.pumpsRow}>
                <TouchableOpacity
                  onPress={() => setSelectedPumpId(null)}
                  style={[styles.pumpChip, selectedPumpId === null && styles.activePumpChip]}
                >
                  <Text
                    style={[
                      styles.pumpChipText,
                      selectedPumpId === null && styles.activePumpChipText,
                    ]}
                  >
                    Station General
                  </Text>
                </TouchableOpacity>
                {pumps.map((p) => (
                  <TouchableOpacity
                    key={p.id}
                    onPress={() => setSelectedPumpId(p.id)}
                    style={[styles.pumpChip, selectedPumpId === p.id && styles.activePumpChip]}
                  >
                    <Text
                      style={[
                        styles.pumpChipText,
                        selectedPumpId === p.id && styles.activePumpChipText,
                      ]}
                    >
                      {p.code} ({p.name})
                    </Text>
                  </TouchableOpacity>
                ))}
              </ScrollView>
            </View>
          )}

          {/* GPS refresh / retry link */}
          <View style={styles.gpsRow}>
            <Text style={styles.gpsMeta}>
              {coords.latitude !== null && coords.longitude !== null
                ? `Coordinates: ${coords.latitude.toFixed(5)}, ${coords.longitude.toFixed(5)}`
                : 'Reading will be submitted with non-blocking GPS status.'}
            </Text>
            <TouchableOpacity
              onPress={captureGps}
              disabled={gpsLoading}
              style={styles.gpsRetryButton}
            >
              {gpsLoading ? (
                <ActivityIndicator size="small" color={BRAND.navy} />
              ) : (
                <Text style={styles.gpsRetryText}>Retry GPS</Text>
              )}
            </TouchableOpacity>
          </View>
        </View>

        {/* Primary Required Fields Form */}
        <View style={styles.formCard}>
          <Text style={styles.formSectionTitle}>PRIMARY METER READINGS</Text>
          <Text style={styles.formSectionSub}>
            Standard operational readings required every shift.
          </Text>

          {/* Flow Meter */}
          <View style={styles.fieldGroup}>
            <View style={styles.labelRow}>
              <Text style={styles.fieldLabel}>Flow Meter</Text>
              <Text style={styles.unitTag}>m³ (Cubic Meters)</Text>
            </View>
            <TextInput
              style={[styles.input, errors.flowMeter && styles.inputError]}
              placeholder="e.g. 145020.5"
              placeholderTextColor={BRAND.muted}
              value={flowMeter}
              onChangeText={setFlowMeter}
              keyboardType="decimal-pad"
              returnKeyType="next"
            />
            {errors.flowMeter ? <Text style={styles.errorText}>{errors.flowMeter}</Text> : null}
          </View>

          {/* Energy Meter */}
          <View style={styles.fieldGroup}>
            <View style={styles.labelRow}>
              <Text style={styles.fieldLabel}>Energy Meter</Text>
              <Text style={styles.unitTag}>kWh (Cumulative)</Text>
            </View>
            <TextInput
              style={[styles.input, errors.energyMeter && styles.inputError]}
              placeholder="e.g. 89210.0"
              placeholderTextColor={BRAND.muted}
              value={energyMeter}
              onChangeText={setEnergyMeter}
              keyboardType="decimal-pad"
              returnKeyType="next"
            />
            {errors.energyMeter ? <Text style={styles.errorText}>{errors.energyMeter}</Text> : null}
          </View>

          {/* Pressure Row */}
          <View style={styles.twoColumnRow}>
            <View style={[styles.fieldGroup, { flex: 1 }]}>
              <View style={styles.labelRow}>
                <Text style={styles.fieldLabel}>Inlet Pressure</Text>
                <Text style={styles.unitTag}>kg/cm²</Text>
              </View>
              <TextInput
                style={[styles.input, errors.inletPressure && styles.inputError]}
                placeholder="e.g. 1.8"
                placeholderTextColor={BRAND.muted}
                value={inletPressure}
                onChangeText={setInletPressure}
                keyboardType="decimal-pad"
                returnKeyType="next"
              />
              {errors.inletPressure ? (
                <Text style={styles.errorText}>{errors.inletPressure}</Text>
              ) : null}
            </View>

            <View style={[styles.fieldGroup, { flex: 1 }]}>
              <View style={styles.labelRow}>
                <Text style={styles.fieldLabel}>Outlet Pressure</Text>
                <Text style={styles.unitTag}>kg/cm²</Text>
              </View>
              <TextInput
                style={[styles.input, errors.outletPressure && styles.inputError]}
                placeholder="e.g. 6.4"
                placeholderTextColor={BRAND.muted}
                value={outletPressure}
                onChangeText={setOutletPressure}
                keyboardType="decimal-pad"
                returnKeyType="next"
              />
              {errors.outletPressure ? (
                <Text style={styles.errorText}>{errors.outletPressure}</Text>
              ) : null}
            </View>
          </View>

          {/* Tank Level % */}
          <View style={styles.fieldGroup}>
            <View style={styles.labelRow}>
              <Text style={styles.fieldLabel}>Clear Water Tank Level</Text>
              <Text style={styles.unitTag}>% (0 to 100)</Text>
            </View>
            <TextInput
              style={[styles.input, errors.tankLevelPct && styles.inputError]}
              placeholder="e.g. 78.5"
              placeholderTextColor={BRAND.muted}
              value={tankLevelPct}
              onChangeText={setTankLevelPct}
              keyboardType="decimal-pad"
              returnKeyType="done"
            />
            {errors.tankLevelPct ? (
              <Text style={styles.errorText}>{errors.tankLevelPct}</Text>
            ) : null}
          </View>
        </View>

        {/* Optional Expandable Section */}
        <View style={styles.optionalCard}>
          <TouchableOpacity
            activeOpacity={0.8}
            onPress={() => setShowAdvanced(!showAdvanced)}
            style={styles.expandHeader}
          >
            <View>
              <Text style={styles.optionalTitle}>Water Quality & Remarks (Optional)</Text>
              <Text style={styles.optionalSubtitle}>
                Chlorine, turbidity, photo evidence, remarks
              </Text>
            </View>
            <Text style={styles.expandIcon}>{showAdvanced ? '▲' : '▼'}</Text>
          </TouchableOpacity>

          {showAdvanced && (
            <View style={styles.expandedContent}>
              <View style={styles.twoColumnRow}>
                <View style={[styles.fieldGroup, { flex: 1 }]}>
                  <View style={styles.labelRow}>
                    <Text style={styles.fieldLabel}>Residual Cl₂</Text>
                    <Text style={styles.unitTag}>mg/L</Text>
                  </View>
                  <TextInput
                    style={[styles.input, errors.residualChlorine && styles.inputError]}
                    placeholder="e.g. 0.5"
                    placeholderTextColor={BRAND.muted}
                    value={residualChlorine}
                    onChangeText={setResidualChlorine}
                    keyboardType="decimal-pad"
                  />
                  {errors.residualChlorine ? (
                    <Text style={styles.errorText}>{errors.residualChlorine}</Text>
                  ) : null}
                </View>

                <View style={[styles.fieldGroup, { flex: 1 }]}>
                  <View style={styles.labelRow}>
                    <Text style={styles.fieldLabel}>Turbidity</Text>
                    <Text style={styles.unitTag}>NTU</Text>
                  </View>
                  <TextInput
                    style={[styles.input, errors.turbidity && styles.inputError]}
                    placeholder="e.g. 1.2"
                    placeholderTextColor={BRAND.muted}
                    value={turbidity}
                    onChangeText={setTurbidity}
                    keyboardType="decimal-pad"
                  />
                  {errors.turbidity ? (
                    <Text style={styles.errorText}>{errors.turbidity}</Text>
                  ) : null}
                </View>
              </View>

              {/* Remarks */}
              <View style={styles.fieldGroup}>
                <Text style={styles.fieldLabel}>Operational Remarks</Text>
                <TextInput
                  style={[styles.input, styles.textArea, errors.remarks && styles.inputError]}
                  placeholder="Optional notes regarding voltage, maintenance, or shift status..."
                  placeholderTextColor={BRAND.muted}
                  value={remarks}
                  onChangeText={setRemarks}
                  multiline
                  numberOfLines={3}
                />
                {errors.remarks ? <Text style={styles.errorText}>{errors.remarks}</Text> : null}
              </View>

              {/* Photo Evidence */}
              <View style={styles.fieldGroup}>
                <Text style={styles.fieldLabel}>Meter Photo Evidence</Text>
                {photoUri ? (
                  <View style={styles.photoPreviewCard}>
                    <Image source={{ uri: photoUri }} style={styles.photoPreview} />
                    <View style={styles.photoActions}>
                      <TouchableOpacity
                        onPress={takePhoto}
                        style={[styles.photoButton, styles.retakeButton]}
                      >
                        <Text style={styles.photoButtonText}>Retake</Text>
                      </TouchableOpacity>
                      <TouchableOpacity
                        onPress={removePhoto}
                        style={[styles.photoButton, styles.removeButton]}
                      >
                        <Text style={[styles.photoButtonText, { color: BRAND.critical }]}>
                          Remove
                        </Text>
                      </TouchableOpacity>
                    </View>
                  </View>
                ) : (
                  <View style={styles.photoButtonRow}>
                    <TouchableOpacity
                      onPress={takePhoto}
                      style={[styles.photoButton, styles.cameraButton]}
                    >
                      <Text style={styles.cameraButtonText}>📷 Open Camera</Text>
                    </TouchableOpacity>
                    <TouchableOpacity
                      onPress={choosePhoto}
                      style={[styles.photoButton, styles.galleryButton]}
                    >
                      <Text style={styles.galleryButtonText}>Choose File</Text>
                    </TouchableOpacity>
                  </View>
                )}
              </View>
            </View>
          )}
        </View>

        {/* Submit Button */}
        <TouchableOpacity
          activeOpacity={0.8}
          onPress={handleSubmit}
          disabled={submitting}
          style={[styles.submitButton, submitting && styles.submitButtonDisabled]}
        >
          {submitting ? (
            <ActivityIndicator color="#FFFFFF" />
          ) : (
            <Text style={styles.submitButtonText}>Submit Meter Reading</Text>
          )}
        </TouchableOpacity>
      </ScrollView>
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  scrollContainer: {
    padding: 16,
    paddingBottom: 40,
    backgroundColor: BRAND.background,
  },
  summaryCard: {
    backgroundColor: '#FFFFFF',
    borderRadius: 14,
    padding: 16,
    marginBottom: 16,
    borderWidth: 1,
    borderColor: '#E2E8F0',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.05,
    shadowRadius: 3,
    elevation: 2,
  },
  cardRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
  },
  stationLabel: {
    fontSize: 11,
    fontWeight: '700',
    color: BRAND.muted,
    letterSpacing: 0.5,
  },
  stationName: {
    fontSize: 18,
    fontWeight: '800',
    color: BRAND.navy,
    marginTop: 2,
  },
  stationCode: {
    fontSize: 12,
    color: BRAND.muted,
    marginTop: 2,
  },
  statusBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 5,
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 8,
  },
  statusDot: {
    width: 6,
    height: 6,
    borderRadius: 3,
  },
  statusText: {
    fontSize: 10,
    fontWeight: '700',
  },
  stationRow: {
    marginTop: 12,
  },
  stationChip: {
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 8,
    backgroundColor: '#F1F5F9',
    marginRight: 8,
  },
  activeStationChip: {
    backgroundColor: BRAND.navy,
  },
  stationChipText: {
    fontSize: 12,
    fontWeight: '600',
    color: BRAND.navy,
  },
  activeStationChipText: {
    color: '#FFFFFF',
  },
  pumpSelector: {
    marginTop: 14,
    borderTopWidth: 1,
    borderTopColor: '#F1F5F9',
    paddingTop: 10,
  },
  pumpLabel: {
    fontSize: 11,
    fontWeight: '700',
    color: BRAND.muted,
    marginBottom: 6,
  },
  pumpsRow: {
    flexDirection: 'row',
  },
  pumpChip: {
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderRadius: 8,
    backgroundColor: '#F8FAFC',
    borderWidth: 1,
    borderColor: '#E2E8F0',
    marginRight: 8,
  },
  activePumpChip: {
    backgroundColor: BRAND.waterBlue,
    borderColor: BRAND.waterBlue,
  },
  pumpChipText: {
    fontSize: 12,
    fontWeight: '600',
    color: BRAND.navy,
  },
  activePumpChipText: {
    color: '#FFFFFF',
  },
  gpsRow: {
    marginTop: 12,
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingTop: 8,
    borderTopWidth: 1,
    borderTopColor: '#F1F5F9',
  },
  gpsMeta: {
    fontSize: 11,
    color: BRAND.muted,
    flex: 1,
  },
  gpsRetryButton: {
    paddingVertical: 4,
    paddingHorizontal: 8,
    marginLeft: 8,
  },
  gpsRetryText: {
    fontSize: 11,
    fontWeight: '700',
    color: BRAND.waterBlue,
  },
  formCard: {
    backgroundColor: '#FFFFFF',
    borderRadius: 14,
    padding: 16,
    marginBottom: 16,
    borderWidth: 1,
    borderColor: '#E2E8F0',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.05,
    shadowRadius: 3,
    elevation: 2,
  },
  formSectionTitle: {
    fontSize: 13,
    fontWeight: '800',
    color: BRAND.navy,
    letterSpacing: 0.5,
  },
  formSectionSub: {
    fontSize: 12,
    color: BRAND.muted,
    marginBottom: 14,
    marginTop: 2,
  },
  fieldGroup: {
    marginBottom: 14,
  },
  labelRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 6,
  },
  fieldLabel: {
    fontSize: 13,
    fontWeight: '700',
    color: BRAND.navy,
  },
  unitTag: {
    fontSize: 11,
    fontWeight: '600',
    color: BRAND.waterBlue,
    backgroundColor: '#F0F9FF',
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius: 4,
  },
  input: {
    borderWidth: 1,
    borderColor: '#CBD5E1',
    borderRadius: 10,
    paddingHorizontal: 14,
    paddingVertical: 12,
    fontSize: 15,
    color: BRAND.navy,
    backgroundColor: '#FFFFFF',
  },
  inputError: {
    borderColor: BRAND.critical,
    backgroundColor: '#FEF2F2',
  },
  errorText: {
    fontSize: 11,
    color: BRAND.critical,
    marginTop: 4,
    fontWeight: '600',
  },
  twoColumnRow: {
    flexDirection: 'row',
    gap: 12,
  },
  optionalCard: {
    backgroundColor: '#FFFFFF',
    borderRadius: 14,
    marginBottom: 20,
    borderWidth: 1,
    borderColor: '#E2E8F0',
    overflow: 'hidden',
  },
  expandHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    padding: 16,
    backgroundColor: '#F8FAFC',
  },
  optionalTitle: {
    fontSize: 14,
    fontWeight: '700',
    color: BRAND.navy,
  },
  optionalSubtitle: {
    fontSize: 11,
    color: BRAND.muted,
    marginTop: 2,
  },
  expandIcon: {
    fontSize: 14,
    color: BRAND.navy,
    fontWeight: '700',
  },
  expandedContent: {
    padding: 16,
    backgroundColor: '#FFFFFF',
  },
  textArea: {
    height: 70,
    textAlignVertical: 'top',
  },
  photoPreviewCard: {
    alignItems: 'center',
    marginTop: 6,
  },
  photoPreview: {
    width: '100%',
    height: 200,
    borderRadius: 10,
    resizeMode: 'cover',
  },
  photoActions: {
    flexDirection: 'row',
    gap: 12,
    marginTop: 10,
  },
  photoButtonRow: {
    flexDirection: 'row',
    gap: 10,
    marginTop: 6,
  },
  photoButton: {
    paddingVertical: 10,
    paddingHorizontal: 16,
    borderRadius: 8,
    alignItems: 'center',
    justifyContent: 'center',
  },
  cameraButton: {
    flex: 1,
    backgroundColor: BRAND.navy,
  },
  cameraButtonText: {
    color: '#FFFFFF',
    fontWeight: '700',
    fontSize: 13,
  },
  galleryButton: {
    flex: 1,
    backgroundColor: '#F1F5F9',
    borderWidth: 1,
    borderColor: '#CBD5E1',
  },
  galleryButtonText: {
    color: BRAND.navy,
    fontWeight: '600',
    fontSize: 13,
  },
  retakeButton: {
    backgroundColor: '#F1F5F9',
    borderWidth: 1,
    borderColor: '#CBD5E1',
    flex: 1,
  },
  removeButton: {
    backgroundColor: '#FEF2F2',
    borderWidth: 1,
    borderColor: '#FECACA',
    flex: 1,
  },
  photoButtonText: {
    fontSize: 12,
    fontWeight: '700',
    color: BRAND.navy,
  },
  submitButton: {
    backgroundColor: BRAND.navy,
    borderRadius: 12,
    paddingVertical: 16,
    alignItems: 'center',
    justifyContent: 'center',
    shadowColor: BRAND.navy,
    shadowOffset: { width: 0, height: 3 },
    shadowOpacity: 0.2,
    shadowRadius: 5,
    elevation: 3,
  },
  submitButtonDisabled: {
    opacity: 0.6,
  },
  submitButtonText: {
    color: '#FFFFFF',
    fontSize: 16,
    fontWeight: '800',
    letterSpacing: 0.5,
  },
});

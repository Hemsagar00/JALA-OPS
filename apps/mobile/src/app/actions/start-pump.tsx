import React, { useState, useEffect } from 'react';
import {
  ActivityIndicator,
  Alert,
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
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { BRAND } from '@jala-ops/constants';
import { createApiClient } from '@jala-ops/api-client';
import { useSession } from '../../lib/auth-context';
import { getStoredToken } from '../../lib/session';
import type { Pump, SopItem } from '@jala-ops/types';

const BASE_URL = process.env.EXPO_PUBLIC_API_URL ?? 'http://localhost:8787';

const DEFAULT_START_SOP: SopItem[] = [
  {
    id: 'sop-item-s1',
    templateId: 'sop-tpl-start',
    sequenceNo: 1,
    label: 'Lubrication / oil condition checked',
    required: true,
    active: true,
  },
  {
    id: 'sop-item-s2',
    templateId: 'sop-tpl-start',
    sequenceNo: 2,
    label: 'Electrical panel normal',
    required: true,
    active: true,
  },
  {
    id: 'sop-item-s3',
    templateId: 'sop-tpl-start',
    sequenceNo: 3,
    label: 'Suction condition normal',
    required: true,
    active: true,
  },
  {
    id: 'sop-item-s4',
    templateId: 'sop-tpl-start',
    sequenceNo: 4,
    label: 'Discharge valve position confirmed',
    required: true,
    active: true,
  },
  {
    id: 'sop-item-s5',
    templateId: 'sop-tpl-start',
    sequenceNo: 5,
    label: 'No visible leakage',
    required: true,
    active: true,
  },
  {
    id: 'sop-item-s6',
    templateId: 'sop-tpl-start',
    sequenceNo: 6,
    label: 'Flow meter available',
    required: true,
    active: true,
  },
  {
    id: 'sop-item-s7',
    templateId: 'sop-tpl-start',
    sequenceNo: 7,
    label: 'Energy meter available',
    required: true,
    active: true,
  },
  {
    id: 'sop-item-s8',
    templateId: 'sop-tpl-start',
    sequenceNo: 8,
    label: 'Pressure gauges normal',
    required: true,
    active: true,
  },
];

export default function StartPumpScreen() {
  const insets = useSafeAreaInsets();
  const router = useRouter();
  const { activeStation, pumps, refreshPumps } = useSession();

  const [step, setStep] = useState<1 | 2>(1);
  const [selectedPumpId, setSelectedPumpId] = useState<string>('');
  const [sopItems, setSopItems] = useState<SopItem[]>(DEFAULT_START_SOP);
  const [sopChecks, setSopChecks] = useState<Record<string, boolean>>({});
  const [flowMeter, setFlowMeter] = useState('');
  const [energyMeter, setEnergyMeter] = useState('');
  const [inletPressure, setInletPressure] = useState('1.5');
  const [outletPressure, setOutletPressure] = useState('4.2');
  const [tankLevel, setTankLevel] = useState('80');
  const [remarks, setRemarks] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [showSummary, setShowSummary] = useState(false);
  const [successInfo, setSuccessInfo] = useState<{ pumpCode: string; startedAt: string } | null>(
    null,
  );

  const eligiblePumps = pumps.filter((p) => p.status === 'STOPPED');

  useEffect(() => {
    if (eligiblePumps.length > 0 && !selectedPumpId) {
      const first = eligiblePumps[0];
      if (first) {
        setSelectedPumpId(first.id);
      }
    }
  }, [eligiblePumps, selectedPumpId]);

  useEffect(() => {
    async function loadSop() {
      try {
        const token = await getStoredToken();
        const client = createApiClient(BASE_URL, { token });
        const res = await client.listSopTemplates('START');
        if (res.templates.length > 0) {
          const firstTpl = res.templates[0];
          if (firstTpl && firstTpl.items.length > 0) {
            setSopItems(firstTpl.items);
          }
        }
      } catch {
        // Fallback to default items
      }
    }
    loadSop();
  }, []);

  const toggleCheck = (itemId: string) => {
    setSopChecks((prev) => ({
      ...prev,
      [itemId]: !prev[itemId],
    }));
  };

  const allRequiredChecked = sopItems
    .filter((i) => i.required)
    .every((i) => Boolean(sopChecks[i.id]));

  const selectedPump: Pump | undefined = pumps.find((p) => p.id === selectedPumpId);

  const handleProceedToReadings = () => {
    if (!selectedPumpId) {
      Alert.alert('Selection Required', 'Please select a pump to start.');
      return;
    }
    if (!allRequiredChecked) {
      Alert.alert(
        'Safety Incomplete',
        'All required standard operating checklist items must be confirmed.',
      );
      return;
    }
    setStep(2);
  };

  const handleSubmitStart = async () => {
    const flowNum = parseFloat(flowMeter);
    const energyNum = parseFloat(energyMeter);

    if (isNaN(flowNum) || flowNum < 0) {
      Alert.alert(
        'Invalid Input',
        'Please enter a valid non-negative Opening Flow Meter reading (m³).',
      );
      return;
    }
    if (isNaN(energyNum) || energyNum < 0) {
      Alert.alert(
        'Invalid Input',
        'Please enter a valid non-negative Opening Energy Meter reading (kWh).',
      );
      return;
    }
    if (!activeStation || !selectedPump) {
      Alert.alert('Error', 'Active station or pump information missing.');
      return;
    }

    setSubmitting(true);
    try {
      const token = await getStoredToken();
      const client = createApiClient(BASE_URL, { token });

      const clientUuid = crypto.randomUUID();
      const sopResponses = sopItems.map((i) => ({
        sopItemId: i.id,
        response: sopChecks[i.id] ? 1 : 0,
      }));

      const res = await client.startPump({
        clientUuid,
        stationId: activeStation.id,
        pumpId: selectedPump.id,
        openingFlowMeter: flowNum,
        openingEnergyMeter: energyNum,
        inletPressure: inletPressure ? parseFloat(inletPressure) : undefined,
        outletPressure: outletPressure ? parseFloat(outletPressure) : undefined,
        tankLevel: tankLevel ? parseFloat(tankLevel) : undefined,
        sopResponses,
        remarks: remarks.trim() || undefined,
      });

      await refreshPumps();
      setSuccessInfo({
        pumpCode: selectedPump.code,
        startedAt: new Date(res.operation.startedAt).toLocaleTimeString('en-IN', {
          hour: '2-digit',
          minute: '2-digit',
          second: '2-digit',
        }),
      });
    } catch (err: unknown) {
      const msg =
        err instanceof Error ? err.message : 'Failed to start pump. Please check readings.';
      Alert.alert('Start Operation Failed', msg);
    } finally {
      setSubmitting(false);
    }
  };

  if (successInfo) {
    return (
      <View style={[styles.successContainer, { paddingTop: insets.top + 40 }]}>
        <View style={styles.successCard}>
          <Text style={styles.successIcon}>✓</Text>
          <Text style={styles.successTitle}>PUMP STARTED</Text>
          <Text style={styles.successSubtitle}>
            {successInfo.pumpCode} is now RUNNING at {activeStation?.name}
          </Text>

          <View style={styles.successDetailBox}>
            <Text style={styles.successDetailRow}>
              Start Timestamp: <Text style={{ fontWeight: '700' }}>{successInfo.startedAt}</Text>
            </Text>
            <Text style={styles.successDetailRow}>
              Status: <Text style={{ color: BRAND.success, fontWeight: '800' }}>RUNNING</Text>
            </Text>
            <Text style={styles.successDetailRow}>
              Flow Meter: <Text style={{ fontWeight: '700' }}>{flowMeter} m³</Text>
            </Text>
            <Text style={styles.successDetailRow}>
              Energy Meter: <Text style={{ fontWeight: '700' }}>{energyMeter} kWh</Text>
            </Text>
          </View>

          <TouchableOpacity
            activeOpacity={0.8}
            onPress={() => router.replace('/(tabs)')}
            style={styles.homeReturnButton}
          >
            <Text style={styles.homeReturnButtonText}>Return to Operator Home</Text>
          </TouchableOpacity>
        </View>
      </View>
    );
  }

  return (
    <KeyboardAvoidingView
      behavior={Platform.OS === 'ios' ? 'padding' : undefined}
      style={{ flex: 1, backgroundColor: BRAND.background }}
    >
      <ScrollView
        contentContainerStyle={[
          styles.container,
          { paddingTop: insets.top + 16, paddingBottom: insets.bottom + 24 },
        ]}
      >
        <View style={styles.content}>
          {/* Header */}
          <View style={styles.header}>
            <View>
              <Text style={styles.caption}>FIELD OPERATION</Text>
              <Text style={styles.title}>Start Pump Workflow</Text>
              <Text style={styles.stationLabel}>
                Station:{' '}
                {activeStation ? `${activeStation.name} (${activeStation.code})` : 'No Station'}
              </Text>
            </View>
            <View style={styles.stepBadge}>
              <Text style={styles.stepBadgeText}>Step {step} of 2</Text>
            </View>
          </View>

          {/* Pump Picker */}
          <View style={styles.card}>
            <Text style={styles.sectionHeader}>1. SELECT STOPPED PUMP</Text>
            {eligiblePumps.length === 0 ? (
              <View style={styles.noPumpsBox}>
                <Text style={styles.noPumpsText}>
                  No stopped pumps available to start at this station. (All pumps are currently
                  running, in maintenance, or breakdown).
                </Text>
              </View>
            ) : (
              <View style={styles.pumpList}>
                {eligiblePumps.map((p) => {
                  const isSelected = p.id === selectedPumpId;
                  return (
                    <TouchableOpacity
                      key={p.id}
                      activeOpacity={0.7}
                      onPress={() => setSelectedPumpId(p.id)}
                      style={[styles.pumpItem, isSelected && styles.pumpItemSelected]}
                    >
                      <View style={{ flex: 1 }}>
                        <Text style={[styles.pumpCode, isSelected && styles.pumpCodeSelected]}>
                          {p.code} — {p.name}
                        </Text>
                        <Text style={styles.pumpSpecs}>
                          {p.ratedPowerKw} kW • {p.capacityM3H} m³/h
                        </Text>
                      </View>
                      <View style={[styles.radioCircle, isSelected && styles.radioCircleSelected]}>
                        {isSelected ? <View style={styles.radioDot} /> : null}
                      </View>
                    </TouchableOpacity>
                  );
                })}
              </View>
            )}
          </View>

          {step === 1 ? (
            /* STEP 1: SAFETY SOP CHECKLIST */
            <View style={styles.card}>
              <View style={styles.cardHeaderRow}>
                <Text style={styles.sectionHeader}>2. MANDATORY SAFETY SOP CHECKLIST</Text>
                <Text style={styles.requiredNotice}>*All items mandatory</Text>
              </View>

              <View style={styles.sopList}>
                {sopItems.map((item, idx) => {
                  const checked = Boolean(sopChecks[item.id]);
                  return (
                    <TouchableOpacity
                      key={item.id}
                      activeOpacity={0.7}
                      onPress={() => toggleCheck(item.id)}
                      style={[styles.sopRow, checked && styles.sopRowChecked]}
                    >
                      <View style={[styles.checkbox, checked && styles.checkboxChecked]}>
                        {checked ? <Text style={styles.checkboxTick}>✓</Text> : null}
                      </View>
                      <Text style={[styles.sopLabel, checked && styles.sopLabelChecked]}>
                        {idx + 1}. {item.label}
                      </Text>
                    </TouchableOpacity>
                  );
                })}
              </View>

              <TouchableOpacity
                activeOpacity={0.8}
                disabled={!allRequiredChecked || eligiblePumps.length === 0}
                onPress={handleProceedToReadings}
                style={[
                  styles.primaryButton,
                  (!allRequiredChecked || eligiblePumps.length === 0) && styles.disabledButton,
                ]}
              >
                <Text style={styles.primaryButtonText}>Continue to Opening Readings →</Text>
              </TouchableOpacity>
            </View>
          ) : (
            /* STEP 2: OPENING READINGS FORM */
            <View style={styles.card}>
              <View style={styles.cardHeaderRow}>
                <Text style={styles.sectionHeader}>2. OPENING READINGS & PARAMETERS</Text>
                <TouchableOpacity onPress={() => setStep(1)}>
                  <Text style={styles.editSopLink}>← Edit SOP</Text>
                </TouchableOpacity>
              </View>

              {/* Flow Meter */}
              <View style={styles.inputGroup}>
                <Text style={styles.inputLabel}>
                  Opening Flow Meter Reading <Text style={styles.requiredStar}>*</Text>
                </Text>
                <View style={styles.inputWrapper}>
                  <TextInput
                    value={flowMeter}
                    onChangeText={setFlowMeter}
                    placeholder="e.g. 12450.5"
                    keyboardType="numeric"
                    style={styles.textInput}
                  />
                  <Text style={styles.unitSuffix}>m³ (kL)</Text>
                </View>
              </View>

              {/* Energy Meter */}
              <View style={styles.inputGroup}>
                <Text style={styles.inputLabel}>
                  Opening Energy Meter Reading <Text style={styles.requiredStar}>*</Text>
                </Text>
                <View style={styles.inputWrapper}>
                  <TextInput
                    value={energyMeter}
                    onChangeText={setEnergyMeter}
                    placeholder="e.g. 8450.0"
                    keyboardType="numeric"
                    style={styles.textInput}
                  />
                  <Text style={styles.unitSuffix}>kWh</Text>
                </View>
              </View>

              {/* Pressure Row */}
              <View style={styles.twoColumnRow}>
                <View style={[styles.inputGroup, { flex: 1 }]}>
                  <Text style={styles.inputLabel}>Inlet Pressure</Text>
                  <View style={styles.inputWrapper}>
                    <TextInput
                      value={inletPressure}
                      onChangeText={setInletPressure}
                      placeholder="1.5"
                      keyboardType="numeric"
                      style={styles.textInput}
                    />
                    <Text style={styles.unitSuffix}>kg/cm²</Text>
                  </View>
                </View>

                <View style={[styles.inputGroup, { flex: 1 }]}>
                  <Text style={styles.inputLabel}>Outlet Pressure</Text>
                  <View style={styles.inputWrapper}>
                    <TextInput
                      value={outletPressure}
                      onChangeText={setOutletPressure}
                      placeholder="4.2"
                      keyboardType="numeric"
                      style={styles.textInput}
                    />
                    <Text style={styles.unitSuffix}>kg/cm²</Text>
                  </View>
                </View>
              </View>

              {/* Tank Level */}
              <View style={styles.inputGroup}>
                <Text style={styles.inputLabel}>Sump / Tank Level</Text>
                <View style={styles.inputWrapper}>
                  <TextInput
                    value={tankLevel}
                    onChangeText={setTankLevel}
                    placeholder="80"
                    keyboardType="numeric"
                    style={styles.textInput}
                  />
                  <Text style={styles.unitSuffix}>%</Text>
                </View>
              </View>

              {/* Remarks */}
              <View style={styles.inputGroup}>
                <Text style={styles.inputLabel}>Operational Remarks (Optional)</Text>
                <TextInput
                  value={remarks}
                  onChangeText={setRemarks}
                  placeholder="Routine morning pumping cycle"
                  style={[styles.textInput, styles.textArea]}
                  multiline
                />
              </View>

              {/* Confirmation Preview */}
              {showSummary ? (
                <View style={styles.summaryBox}>
                  <Text style={styles.summaryTitle}>Verify Start Parameters</Text>
                  <Text style={styles.summaryLine}>
                    Pump: <Text style={{ fontWeight: '700' }}>{selectedPump?.code}</Text>
                  </Text>
                  <Text style={styles.summaryLine}>
                    Opening Flow: <Text style={{ fontWeight: '700' }}>{flowMeter || '0'} m³</Text>
                  </Text>
                  <Text style={styles.summaryLine}>
                    Opening Energy:{' '}
                    <Text style={{ fontWeight: '700' }}>{energyMeter || '0'} kWh</Text>
                  </Text>
                  <Text style={styles.summaryLine}>
                    SOP Checklist:{' '}
                    <Text style={{ color: BRAND.success, fontWeight: '700' }}>All 8 Confirmed</Text>
                  </Text>
                </View>
              ) : null}

              <View style={styles.buttonRow}>
                {!showSummary ? (
                  <TouchableOpacity
                    activeOpacity={0.8}
                    onPress={() => setShowSummary(true)}
                    style={styles.previewButton}
                  >
                    <Text style={styles.previewButtonText}>Review & Confirm Start</Text>
                  </TouchableOpacity>
                ) : (
                  <TouchableOpacity
                    activeOpacity={0.8}
                    disabled={submitting}
                    onPress={handleSubmitStart}
                    style={styles.startButton}
                  >
                    {submitting ? (
                      <ActivityIndicator color="#FFFFFF" />
                    ) : (
                      <Text style={styles.startButtonText}>▶ CONFIRM & START PUMP</Text>
                    )}
                  </TouchableOpacity>
                )}
              </View>
            </View>
          )}
        </View>
      </ScrollView>
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  container: {
    flexGrow: 1,
    paddingHorizontal: 16,
  },
  content: {
    maxWidth: 600,
    width: '100%',
    alignSelf: 'center',
  },
  header: {
    backgroundColor: BRAND.navy,
    borderRadius: 14,
    padding: 18,
    marginBottom: 14,
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
  },
  caption: {
    color: BRAND.lightBlue,
    fontSize: 10,
    fontWeight: '800',
    letterSpacing: 0.8,
  },
  title: {
    color: '#FFFFFF',
    fontSize: 20,
    fontWeight: '800',
    marginTop: 2,
  },
  stationLabel: {
    color: BRAND.lightBlue,
    fontSize: 12,
    marginTop: 4,
  },
  stepBadge: {
    backgroundColor: 'rgba(255, 255, 255, 0.2)',
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 8,
  },
  stepBadgeText: {
    color: '#FFFFFF',
    fontSize: 11,
    fontWeight: '800',
  },
  card: {
    backgroundColor: BRAND.surface,
    borderRadius: 14,
    padding: 16,
    borderWidth: 1,
    borderColor: BRAND.border,
    marginBottom: 14,
  },
  cardHeaderRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 12,
  },
  sectionHeader: {
    fontSize: 12,
    fontWeight: '800',
    color: BRAND.navy,
    letterSpacing: 0.6,
  },
  requiredNotice: {
    fontSize: 11,
    color: BRAND.critical,
    fontWeight: '600',
  },
  editSopLink: {
    fontSize: 12,
    color: BRAND.waterBlue,
    fontWeight: '700',
  },
  noPumpsBox: {
    padding: 16,
    backgroundColor: '#FEF2F2',
    borderRadius: 8,
    borderWidth: 1,
    borderColor: '#FECACA',
    marginTop: 8,
  },
  noPumpsText: {
    color: '#991B1B',
    fontSize: 13,
    lineHeight: 18,
  },
  pumpList: {
    gap: 8,
    marginTop: 8,
  },
  pumpItem: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: 12,
    borderRadius: 10,
    borderWidth: 1.5,
    borderColor: BRAND.border,
    backgroundColor: '#FAFAFA',
  },
  pumpItemSelected: {
    borderColor: BRAND.navy,
    backgroundColor: '#F0F7FF',
  },
  pumpCode: {
    fontSize: 14,
    fontWeight: '700',
    color: BRAND.text,
  },
  pumpCodeSelected: {
    color: BRAND.navy,
    fontWeight: '800',
  },
  pumpSpecs: {
    fontSize: 12,
    color: BRAND.muted,
    marginTop: 2,
  },
  radioCircle: {
    width: 22,
    height: 22,
    borderRadius: 11,
    borderWidth: 2,
    borderColor: BRAND.border,
    alignItems: 'center',
    justifyContent: 'center',
  },
  radioCircleSelected: {
    borderColor: BRAND.navy,
  },
  radioDot: {
    width: 10,
    height: 10,
    borderRadius: 5,
    backgroundColor: BRAND.navy,
  },
  sopList: {
    gap: 8,
    marginVertical: 10,
  },
  sopRow: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 10,
    paddingHorizontal: 12,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: BRAND.border,
    backgroundColor: '#FAFAFA',
    minHeight: 48,
  },
  sopRowChecked: {
    backgroundColor: '#ECFDF5',
    borderColor: '#A7F3D0',
  },
  checkbox: {
    width: 24,
    height: 24,
    borderRadius: 6,
    borderWidth: 2,
    borderColor: BRAND.border,
    marginRight: 12,
    alignItems: 'center',
    justifyContent: 'center',
  },
  checkboxChecked: {
    backgroundColor: BRAND.success,
    borderColor: BRAND.success,
  },
  checkboxTick: {
    color: '#FFFFFF',
    fontSize: 14,
    fontWeight: '800',
  },
  sopLabel: {
    fontSize: 13,
    color: BRAND.text,
    flex: 1,
    fontWeight: '600',
  },
  sopLabelChecked: {
    color: '#065F46',
  },
  primaryButton: {
    backgroundColor: BRAND.navy,
    height: 50,
    borderRadius: 8,
    alignItems: 'center',
    justifyContent: 'center',
    marginTop: 14,
  },
  disabledButton: {
    opacity: 0.5,
  },
  primaryButtonText: {
    color: '#FFFFFF',
    fontSize: 15,
    fontWeight: '700',
  },
  inputGroup: {
    marginBottom: 14,
  },
  inputLabel: {
    fontSize: 12,
    fontWeight: '700',
    color: BRAND.text,
    marginBottom: 6,
  },
  requiredStar: {
    color: BRAND.critical,
  },
  inputWrapper: {
    flexDirection: 'row',
    alignItems: 'center',
    borderWidth: 1,
    borderColor: BRAND.border,
    borderRadius: 8,
    backgroundColor: '#FFFFFF',
    paddingHorizontal: 12,
    height: 48,
  },
  textInput: {
    flex: 1,
    fontSize: 16,
    color: BRAND.text,
    fontWeight: '600',
  },
  unitSuffix: {
    fontSize: 13,
    fontWeight: '700',
    color: BRAND.muted,
    marginLeft: 8,
  },
  twoColumnRow: {
    flexDirection: 'row',
    gap: 12,
  },
  textArea: {
    height: 60,
    borderWidth: 1,
    borderColor: BRAND.border,
    borderRadius: 8,
    padding: 10,
    textAlignVertical: 'top',
  },
  summaryBox: {
    backgroundColor: '#F8FAFC',
    borderWidth: 1,
    borderColor: '#E2E8F0',
    borderRadius: 10,
    padding: 14,
    marginVertical: 12,
    gap: 4,
  },
  summaryTitle: {
    fontSize: 13,
    fontWeight: '800',
    color: BRAND.navy,
    marginBottom: 4,
  },
  summaryLine: {
    fontSize: 12,
    color: BRAND.text,
  },
  buttonRow: {
    marginTop: 10,
  },
  previewButton: {
    backgroundColor: BRAND.surface,
    borderWidth: 1.5,
    borderColor: BRAND.navy,
    height: 50,
    borderRadius: 8,
    alignItems: 'center',
    justifyContent: 'center',
  },
  previewButtonText: {
    color: BRAND.navy,
    fontSize: 15,
    fontWeight: '700',
  },
  startButton: {
    backgroundColor: BRAND.success,
    height: 52,
    borderRadius: 8,
    alignItems: 'center',
    justifyContent: 'center',
  },
  startButtonText: {
    color: '#FFFFFF',
    fontSize: 16,
    fontWeight: '800',
    letterSpacing: 0.5,
  },
  successContainer: {
    flex: 1,
    backgroundColor: BRAND.background,
    justifyContent: 'center',
    alignItems: 'center',
    padding: 20,
  },
  successCard: {
    maxWidth: 480,
    width: '100%',
    backgroundColor: BRAND.surface,
    borderRadius: 16,
    padding: 24,
    borderWidth: 1,
    borderColor: BRAND.border,
    alignItems: 'center',
  },
  successIcon: {
    width: 64,
    height: 64,
    borderRadius: 32,
    backgroundColor: '#DCFCE7',
    color: BRAND.success,
    fontSize: 32,
    fontWeight: '800',
    textAlign: 'center',
    lineHeight: 64,
    marginBottom: 16,
  },
  successTitle: {
    fontSize: 22,
    fontWeight: '800',
    color: BRAND.navy,
  },
  successSubtitle: {
    fontSize: 14,
    color: BRAND.muted,
    textAlign: 'center',
    marginTop: 4,
    marginBottom: 20,
  },
  successDetailBox: {
    width: '100%',
    backgroundColor: '#F8FAFC',
    borderRadius: 10,
    padding: 14,
    borderWidth: 1,
    borderColor: '#E2E8F0',
    gap: 8,
    marginBottom: 24,
  },
  successDetailRow: {
    fontSize: 13,
    color: BRAND.text,
  },
  homeReturnButton: {
    width: '100%',
    height: 48,
    backgroundColor: BRAND.navy,
    borderRadius: 8,
    alignItems: 'center',
    justifyContent: 'center',
  },
  homeReturnButtonText: {
    color: '#FFFFFF',
    fontSize: 15,
    fontWeight: '700',
  },
});

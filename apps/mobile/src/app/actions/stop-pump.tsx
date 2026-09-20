import React, { useState, useEffect, useMemo } from 'react';
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
import type { Pump, SopItem, PumpOperationDetail } from '@jala-ops/types';

const BASE_URL = process.env.EXPO_PUBLIC_API_URL ?? 'http://localhost:8787';

const DEFAULT_STOP_SOP: SopItem[] = [
  {
    id: 'sop-item-e1',
    templateId: 'sop-tpl-stop',
    sequenceNo: 1,
    label: 'Closing readings captured',
    required: true,
    active: true,
  },
  {
    id: 'sop-item-e2',
    templateId: 'sop-tpl-stop',
    sequenceNo: 2,
    label: 'Abnormal sound/vibration checked',
    required: true,
    active: true,
  },
  {
    id: 'sop-item-e3',
    templateId: 'sop-tpl-stop',
    sequenceNo: 3,
    label: 'Leakage checked',
    required: true,
    active: true,
  },
  {
    id: 'sop-item-e4',
    templateId: 'sop-tpl-stop',
    sequenceNo: 4,
    label: 'Shutdown reason recorded where required',
    required: true,
    active: true,
  },
];

const SHUTDOWN_REASONS = [
  'Normal Scheduled Shutdown',
  'Target Tank Level Reached',
  'Power Outage / Grid Failure',
  'Low Suction Sump Level',
  'Maintenance Requirement',
  'Emergency Stop Triggered',
  'High Bearing Temperature',
  'Grid Voltage Fluctuation',
];

export default function StopPumpScreen() {
  const insets = useSafeAreaInsets();
  const router = useRouter();
  const { activeStation, pumps, refreshPumps } = useSession();

  const runningPumps = useMemo(() => pumps.filter((p) => p.status === 'RUNNING'), [pumps]);

  const [selectedPumpId, setSelectedPumpId] = useState<string>('');
  const [activeOperation, setActiveOperation] = useState<PumpOperationDetail | null>(null);
  const [loadingActiveOp, setLoadingActiveOp] = useState(false);

  const [sopItems, setSopItems] = useState<SopItem[]>(DEFAULT_STOP_SOP);
  const [sopChecks, setSopChecks] = useState<Record<string, boolean>>({});

  const [closingFlow, setClosingFlow] = useState('');
  const [closingEnergy, setClosingEnergy] = useState('');
  const [inletPressure, setInletPressure] = useState('1.5');
  const [outletPressure, setOutletPressure] = useState('4.2');
  const [tankLevel, setTankLevel] = useState('95');
  const [shutdownReason, setShutdownReason] = useState(SHUTDOWN_REASONS[0]);
  const [remarks, setRemarks] = useState('');

  const [submitting, setSubmitting] = useState(false);
  const [successData, setSuccessData] = useState<{
    pumpCode: string;
    runtimeSec: number;
    waterPumped: number;
    energyUsed: number;
    specificEnergy: number;
    stoppedAt: string;
  } | null>(null);

  useEffect(() => {
    if (runningPumps.length > 0 && !selectedPumpId) {
      const first = runningPumps[0];
      if (first) {
        setSelectedPumpId(first.id);
      }
    }
  }, [runningPumps, selectedPumpId]);

  useEffect(() => {
    async function loadActiveOp(pumpId: string) {
      setLoadingActiveOp(true);
      try {
        const token = await getStoredToken();
        const client = createApiClient(BASE_URL, { token });
        const res = await client.getActivePumpOperation(pumpId);
        setActiveOperation(res.operation);
        if (res.operation) {
          // Pre-populate closing reading suggestions
          setClosingFlow((res.operation.openingFlowMeter + 50).toFixed(1));
          setClosingEnergy((res.operation.openingEnergyMeter + 35).toFixed(1));
        }
      } catch {
        setActiveOperation(null);
      } finally {
        setLoadingActiveOp(false);
      }
    }

    if (selectedPumpId) {
      loadActiveOp(selectedPumpId);
    }
  }, [selectedPumpId]);

  useEffect(() => {
    async function loadSop() {
      try {
        const token = await getStoredToken();
        const client = createApiClient(BASE_URL, { token });
        const res = await client.listSopTemplates('STOP');
        if (res.templates.length > 0) {
          const first = res.templates[0];
          if (first && first.items.length > 0) {
            setSopItems(first.items);
          }
        }
      } catch {
        // Default fallback
      }
    }
    loadSop();
  }, []);

  const toggleCheck = (id: string) => {
    setSopChecks((prev) => ({ ...prev, [id]: !prev[id] }));
  };

  const allRequiredChecked = sopItems
    .filter((i) => i.required)
    .every((i) => Boolean(sopChecks[i.id]));

  const selectedPump: Pump | undefined = pumps.find((p) => p.id === selectedPumpId);

  // Live calculation preview
  const preview = useMemo(() => {
    if (!activeOperation) return null;
    const flowNum = parseFloat(closingFlow);
    const energyNum = parseFloat(closingEnergy);
    const openFlow = activeOperation.openingFlowMeter;
    const openEnergy = activeOperation.openingEnergyMeter;

    const water =
      !isNaN(flowNum) && flowNum >= openFlow ? Number((flowNum - openFlow).toFixed(3)) : 0;
    const energy =
      !isNaN(energyNum) && energyNum >= openEnergy
        ? Number((energyNum - openEnergy).toFixed(3))
        : 0;
    const specificEnergy = water > 0 ? Number((energy / water).toFixed(4)) : 0;

    const startMs = new Date(activeOperation.startedAt).getTime();
    const elapsedSec = Math.max(0, Math.round((Date.now() - startMs) / 1000));
    const hours = Math.floor(elapsedSec / 3600);
    const mins = Math.floor((elapsedSec % 3600) / 60);

    return {
      water,
      energy,
      specificEnergy,
      durationStr: `${hours}h ${mins}m`,
      validMeters:
        !isNaN(flowNum) && flowNum >= openFlow && !isNaN(energyNum) && energyNum >= openEnergy,
    };
  }, [activeOperation, closingFlow, closingEnergy]);

  const handleSubmitStop = async () => {
    if (!activeStation || !selectedPump || !activeOperation) {
      Alert.alert('Error', 'Missing station, pump, or active operation data.');
      return;
    }

    const flowNum = parseFloat(closingFlow);
    const energyNum = parseFloat(closingEnergy);

    if (isNaN(flowNum) || flowNum < activeOperation.openingFlowMeter) {
      Alert.alert(
        'Invalid Meter Reading',
        `Closing flow meter (${closingFlow}) cannot be less than opening reading (${activeOperation.openingFlowMeter} m³).`,
      );
      return;
    }
    if (isNaN(energyNum) || energyNum < activeOperation.openingEnergyMeter) {
      Alert.alert(
        'Invalid Meter Reading',
        `Closing energy meter (${closingEnergy}) cannot be less than opening reading (${activeOperation.openingEnergyMeter} kWh).`,
      );
      return;
    }
    if (!allRequiredChecked) {
      Alert.alert('SOP Incomplete', 'All required stop checklist items must be confirmed.');
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

      const res = await client.stopPump({
        clientUuid,
        stationId: activeStation.id,
        pumpId: selectedPump.id,
        closingFlowMeter: flowNum,
        closingEnergyMeter: energyNum,
        inletPressure: inletPressure ? parseFloat(inletPressure) : undefined,
        outletPressure: outletPressure ? parseFloat(outletPressure) : undefined,
        tankLevel: tankLevel ? parseFloat(tankLevel) : undefined,
        shutdownReason: shutdownReason || undefined,
        sopResponses,
        remarks: remarks.trim() || undefined,
      });

      await refreshPumps();
      setSuccessData({
        pumpCode: selectedPump.code,
        runtimeSec: res.operation.runningDurationSeconds ?? 0,
        waterPumped: res.operation.waterPumped ?? 0,
        energyUsed: res.operation.energyUsedKwh ?? 0,
        specificEnergy: res.operation.energyPerUnit ?? 0,
        stoppedAt: new Date(res.operation.stoppedAt ?? Date.now()).toLocaleTimeString('en-IN', {
          hour: '2-digit',
          minute: '2-digit',
          second: '2-digit',
        }),
      });
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : 'Failed to stop pump. Please check values.';
      Alert.alert('Stop Operation Failed', msg);
    } finally {
      setSubmitting(false);
    }
  };

  if (successData) {
    const hours = Math.floor(successData.runtimeSec / 3600);
    const mins = Math.floor((successData.runtimeSec % 3600) / 60);

    return (
      <View style={[styles.successContainer, { paddingTop: insets.top + 40 }]}>
        <View style={styles.successCard}>
          <Text style={styles.stopIcon}>⏹</Text>
          <Text style={styles.successTitle}>PUMP SHUTDOWN COMPLETE</Text>
          <Text style={styles.successSubtitle}>
            {successData.pumpCode} at {activeStation?.name} is now STOPPED.
          </Text>

          <View style={styles.metricsBox}>
            <Text style={styles.metricsHeader}>Authoritative Operation Calculations</Text>
            <View style={styles.metricsRow}>
              <Text style={styles.metricLabel}>Running Duration:</Text>
              <Text style={styles.metricValue}>
                {hours}h {mins}m ({successData.runtimeSec}s)
              </Text>
            </View>
            <View style={styles.metricsRow}>
              <Text style={styles.metricLabel}>Total Water Discharged:</Text>
              <Text style={[styles.metricValue, { color: BRAND.navy }]}>
                {successData.waterPumped} m³ (kL)
              </Text>
            </View>
            <View style={styles.metricsRow}>
              <Text style={styles.metricLabel}>Total Energy Consumed:</Text>
              <Text style={styles.metricValue}>{successData.energyUsed} kWh</Text>
            </View>
            <View style={styles.metricsRow}>
              <Text style={styles.metricLabel}>Specific Energy:</Text>
              <Text style={styles.metricValue}>{successData.specificEnergy} kWh/m³</Text>
            </View>
            <View style={styles.metricsRow}>
              <Text style={styles.metricLabel}>Stopped Timestamp:</Text>
              <Text style={styles.metricValue}>{successData.stoppedAt}</Text>
            </View>
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
              <Text style={styles.title}>Stop Pump Workflow</Text>
              <Text style={styles.stationLabel}>
                Station:{' '}
                {activeStation ? `${activeStation.name} (${activeStation.code})` : 'No Station'}
              </Text>
            </View>
            <View style={styles.stopBadge}>
              <Text style={styles.stopBadgeText}>SHUTDOWN</Text>
            </View>
          </View>

          {/* Running Pump Picker */}
          <View style={styles.card}>
            <Text style={styles.sectionHeader}>1. SELECT RUNNING PUMP</Text>
            {runningPumps.length === 0 ? (
              <View style={styles.noRunningBox}>
                <Text style={styles.noRunningTitle}>No Active Running Pumps</Text>
                <Text style={styles.noRunningText}>
                  All pumps at this station are currently stopped. You cannot perform a stop
                  procedure without an active running pump.
                </Text>
                <TouchableOpacity
                  activeOpacity={0.8}
                  onPress={() => router.back()}
                  style={styles.backLink}
                >
                  <Text style={styles.backLinkText}>← Back to Home</Text>
                </TouchableOpacity>
              </View>
            ) : (
              <View style={styles.pumpList}>
                {runningPumps.map((p) => {
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
                        <View style={styles.runningPill}>
                          <View style={styles.runningDot} />
                          <Text style={styles.runningText}>RUNNING</Text>
                        </View>
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

          {runningPumps.length > 0 && selectedPump ? (
            <>
              {/* Active Operation Details */}
              <View style={styles.card}>
                <Text style={styles.sectionHeader}>2. ACTIVE RUNNING CONTEXT</Text>
                {loadingActiveOp ? (
                  <ActivityIndicator color={BRAND.navy} style={{ padding: 12 }} />
                ) : activeOperation ? (
                  <View style={styles.opContextBox}>
                    <View style={styles.contextRow}>
                      <Text style={styles.contextLabel}>Started At:</Text>
                      <Text style={styles.contextValue}>
                        {new Date(activeOperation.startedAt).toLocaleTimeString('en-IN', {
                          hour: '2-digit',
                          minute: '2-digit',
                          day: 'numeric',
                          month: 'short',
                        })}
                      </Text>
                    </View>
                    <View style={styles.contextRow}>
                      <Text style={styles.contextLabel}>Opening Flow Meter:</Text>
                      <Text style={[styles.contextValue, { fontWeight: '700' }]}>
                        {activeOperation.openingFlowMeter} m³
                      </Text>
                    </View>
                    <View style={styles.contextRow}>
                      <Text style={styles.contextLabel}>Opening Energy Meter:</Text>
                      <Text style={[styles.contextValue, { fontWeight: '700' }]}>
                        {activeOperation.openingEnergyMeter} kWh
                      </Text>
                    </View>
                  </View>
                ) : (
                  <Text style={styles.warningText}>
                    Warning: Could not fetch active start operation record.
                  </Text>
                )}
              </View>

              {/* Closing Readings Form */}
              <View style={styles.card}>
                <Text style={styles.sectionHeader}>3. CLOSING READINGS & REASON</Text>

                {/* Closing Flow Meter */}
                <View style={styles.inputGroup}>
                  <Text style={styles.inputLabel}>
                    Closing Flow Meter Reading{' '}
                    <Text style={styles.requiredStar}>
                      * (min: {activeOperation?.openingFlowMeter ?? 0})
                    </Text>
                  </Text>
                  <View style={styles.inputWrapper}>
                    <TextInput
                      value={closingFlow}
                      onChangeText={setClosingFlow}
                      placeholder="e.g. 12510.0"
                      keyboardType="numeric"
                      style={styles.textInput}
                    />
                    <Text style={styles.unitSuffix}>m³ (kL)</Text>
                  </View>
                </View>

                {/* Closing Energy Meter */}
                <View style={styles.inputGroup}>
                  <Text style={styles.inputLabel}>
                    Closing Energy Meter Reading{' '}
                    <Text style={styles.requiredStar}>
                      * (min: {activeOperation?.openingEnergyMeter ?? 0})
                    </Text>
                  </Text>
                  <View style={styles.inputWrapper}>
                    <TextInput
                      value={closingEnergy}
                      onChangeText={setClosingEnergy}
                      placeholder="e.g. 8495.0"
                      keyboardType="numeric"
                      style={styles.textInput}
                    />
                    <Text style={styles.unitSuffix}>kWh</Text>
                  </View>
                </View>

                {/* Pressures Row */}
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
                  <Text style={styles.inputLabel}>Tank Level %</Text>
                  <View style={styles.inputWrapper}>
                    <TextInput
                      value={tankLevel}
                      onChangeText={setTankLevel}
                      placeholder="e.g. 95"
                      keyboardType="numeric"
                      style={styles.textInput}
                    />
                    <Text style={styles.unitSuffix}>%</Text>
                  </View>
                </View>

                {/* Shutdown Reason Selector */}
                <View style={styles.inputGroup}>
                  <Text style={styles.inputLabel}>Shutdown Reason</Text>
                  <ScrollView
                    horizontal
                    showsHorizontalScrollIndicator={false}
                    style={styles.reasonScroll}
                  >
                    {SHUTDOWN_REASONS.map((r) => (
                      <TouchableOpacity
                        key={r}
                        onPress={() => setShutdownReason(r)}
                        style={[
                          styles.reasonChip,
                          shutdownReason === r && styles.reasonChipSelected,
                        ]}
                      >
                        <Text
                          style={[
                            styles.reasonChipText,
                            shutdownReason === r && styles.reasonChipTextSelected,
                          ]}
                        >
                          {r}
                        </Text>
                      </TouchableOpacity>
                    ))}
                  </ScrollView>
                </View>

                {/* Remarks */}
                <View style={styles.inputGroup}>
                  <Text style={styles.inputLabel}>Operational Remarks (Optional)</Text>
                  <TextInput
                    value={remarks}
                    onChangeText={setRemarks}
                    placeholder="Duty shift completed normally"
                    style={[styles.textInput, styles.textArea]}
                    multiline
                  />
                </View>
              </View>

              {/* Stop SOP Checklist */}
              <View style={styles.card}>
                <View style={styles.cardHeaderRow}>
                  <Text style={styles.sectionHeader}>4. SHUTDOWN SAFETY CHECKLIST</Text>
                  <Text style={styles.requiredNotice}>*All mandatory</Text>
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
              </View>

              {/* Live Preview Calculations Card */}
              {preview ? (
                <View style={styles.previewCard}>
                  <Text style={styles.previewTitle}>Live Discharge & Energy Preview</Text>
                  <View style={styles.previewRow}>
                    <Text style={styles.previewLabel}>Estimated Running Time:</Text>
                    <Text style={styles.previewValue}>{preview.durationStr}</Text>
                  </View>
                  <View style={styles.previewRow}>
                    <Text style={styles.previewLabel}>Estimated Water Pumped:</Text>
                    <Text style={[styles.previewValue, { color: BRAND.navy }]}>
                      {preview.water} m³
                    </Text>
                  </View>
                  <View style={styles.previewRow}>
                    <Text style={styles.previewLabel}>Estimated Energy Used:</Text>
                    <Text style={styles.previewValue}>{preview.energy} kWh</Text>
                  </View>
                  <View style={styles.previewRow}>
                    <Text style={styles.previewLabel}>Specific Energy:</Text>
                    <Text style={styles.previewValue}>{preview.specificEnergy} kWh/m³</Text>
                  </View>
                  <Text style={styles.previewNote}>
                    *Final authoritative calculations recorded on backend
                  </Text>
                </View>
              ) : null}

              {/* Submit Button */}
              <TouchableOpacity
                activeOpacity={0.8}
                disabled={submitting || !allRequiredChecked || !preview?.validMeters}
                onPress={handleSubmitStop}
                style={[
                  styles.stopButton,
                  (submitting || !allRequiredChecked || !preview?.validMeters) &&
                    styles.disabledButton,
                ]}
              >
                {submitting ? (
                  <ActivityIndicator color="#FFFFFF" />
                ) : (
                  <Text style={styles.stopButtonText}>⏹ CONFIRM & SHUTDOWN PUMP</Text>
                )}
              </TouchableOpacity>
            </>
          ) : null}
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
    backgroundColor: BRAND.deepNavy,
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
  stopBadge: {
    backgroundColor: BRAND.critical,
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 8,
  },
  stopBadgeText: {
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
  sectionHeader: {
    fontSize: 12,
    fontWeight: '800',
    color: BRAND.navy,
    letterSpacing: 0.6,
    marginBottom: 10,
  },
  noRunningBox: {
    padding: 16,
    backgroundColor: '#F8FAFC',
    borderRadius: 8,
    borderWidth: 1,
    borderColor: '#E2E8F0',
    alignItems: 'center',
  },
  noRunningTitle: {
    fontSize: 15,
    fontWeight: '700',
    color: BRAND.text,
    marginBottom: 6,
  },
  noRunningText: {
    fontSize: 13,
    color: BRAND.muted,
    textAlign: 'center',
    lineHeight: 18,
    marginBottom: 12,
  },
  backLink: {
    paddingVertical: 8,
    paddingHorizontal: 14,
    backgroundColor: BRAND.navy,
    borderRadius: 6,
  },
  backLinkText: {
    color: '#FFFFFF',
    fontWeight: '700',
    fontSize: 13,
  },
  pumpList: {
    gap: 8,
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
    borderColor: BRAND.critical,
    backgroundColor: '#FFF5F5',
  },
  pumpCode: {
    fontSize: 14,
    fontWeight: '700',
    color: BRAND.text,
  },
  pumpCodeSelected: {
    color: BRAND.critical,
    fontWeight: '800',
  },
  runningPill: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    marginTop: 4,
  },
  runningDot: {
    width: 6,
    height: 6,
    borderRadius: 3,
    backgroundColor: BRAND.success,
  },
  runningText: {
    fontSize: 11,
    fontWeight: '800',
    color: BRAND.success,
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
    borderColor: BRAND.critical,
  },
  radioDot: {
    width: 10,
    height: 10,
    borderRadius: 5,
    backgroundColor: BRAND.critical,
  },
  opContextBox: {
    backgroundColor: '#F1F5F9',
    borderRadius: 8,
    padding: 12,
    gap: 6,
  },
  contextRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
  },
  contextLabel: {
    fontSize: 12,
    color: BRAND.muted,
  },
  contextValue: {
    fontSize: 13,
    color: BRAND.text,
  },
  warningText: {
    fontSize: 12,
    color: BRAND.critical,
    fontStyle: 'italic',
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
    fontSize: 11,
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
  reasonScroll: {
    flexDirection: 'row',
    marginVertical: 4,
  },
  reasonChip: {
    backgroundColor: '#F1F5F9',
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: 8,
    marginRight: 8,
    borderWidth: 1,
    borderColor: '#E2E8F0',
  },
  reasonChipSelected: {
    backgroundColor: BRAND.navy,
    borderColor: BRAND.navy,
  },
  reasonChipText: {
    color: BRAND.text,
    fontSize: 12,
    fontWeight: '600',
  },
  reasonChipTextSelected: {
    color: '#FFFFFF',
  },
  textArea: {
    height: 54,
    borderWidth: 1,
    borderColor: BRAND.border,
    borderRadius: 8,
    padding: 10,
    textAlignVertical: 'top',
  },
  cardHeaderRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 10,
  },
  requiredNotice: {
    fontSize: 11,
    color: BRAND.critical,
    fontWeight: '600',
  },
  sopList: {
    gap: 8,
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
    minHeight: 46,
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
  previewCard: {
    backgroundColor: '#EFF6FF',
    borderRadius: 12,
    padding: 14,
    borderWidth: 1,
    borderColor: '#BFDBFE',
    marginBottom: 14,
    gap: 6,
  },
  previewTitle: {
    fontSize: 13,
    fontWeight: '800',
    color: BRAND.navy,
    marginBottom: 2,
  },
  previewRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
  },
  previewLabel: {
    fontSize: 12,
    color: '#1E40AF',
  },
  previewValue: {
    fontSize: 13,
    fontWeight: '700',
    color: '#1E40AF',
  },
  previewNote: {
    fontSize: 10,
    color: BRAND.muted,
    fontStyle: 'italic',
    marginTop: 4,
  },
  stopButton: {
    backgroundColor: BRAND.critical,
    height: 52,
    borderRadius: 8,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 20,
  },
  disabledButton: {
    opacity: 0.5,
  },
  stopButtonText: {
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
    maxWidth: 500,
    width: '100%',
    backgroundColor: BRAND.surface,
    borderRadius: 16,
    padding: 24,
    borderWidth: 1,
    borderColor: BRAND.border,
    alignItems: 'center',
  },
  stopIcon: {
    width: 64,
    height: 64,
    borderRadius: 32,
    backgroundColor: '#FEE2E2',
    color: BRAND.critical,
    fontSize: 28,
    fontWeight: '800',
    textAlign: 'center',
    lineHeight: 64,
    marginBottom: 16,
  },
  successTitle: {
    fontSize: 20,
    fontWeight: '800',
    color: BRAND.navy,
  },
  successSubtitle: {
    fontSize: 13,
    color: BRAND.muted,
    textAlign: 'center',
    marginTop: 4,
    marginBottom: 18,
  },
  metricsBox: {
    width: '100%',
    backgroundColor: '#F8FAFC',
    borderRadius: 10,
    padding: 14,
    borderWidth: 1,
    borderColor: '#E2E8F0',
    gap: 8,
    marginBottom: 20,
  },
  metricsHeader: {
    fontSize: 12,
    fontWeight: '800',
    color: BRAND.navy,
    letterSpacing: 0.5,
    marginBottom: 2,
  },
  metricsRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
  },
  metricLabel: {
    fontSize: 12,
    color: BRAND.muted,
  },
  metricValue: {
    fontSize: 13,
    fontWeight: '700',
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

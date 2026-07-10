import { router } from 'expo-router';
import { useEffect, useState } from 'react';
import { ScrollView, View } from 'react-native';
import type { PurchasesOffering, PurchasesPackage } from 'react-native-purchases';

import { Button, Chip, Screen, Typography } from '@/components/ui';
import { mockUpgrade } from '@/lib/api/billing';
import { queryClient } from '@/lib/api/queryClient';
import {
  PRO_PRICES_FALLBACK,
  getProOffering,
  isPurchasesConfigured,
  purchaseProPackage,
  restorePurchases,
} from '@/lib/billing/purchases';

// 只列已上线能力（PRD 清单里的未上线功能不写，避免过审/退款风险）
const PRO_BENEFITS = [
  'Unlimited recipes (free: 10)',
  '30 AI imports / month (free: 5)',
  'More PRO features on the way',
] as const;

export function PaywallScreen() {
  const [offering, setOffering] = useState<PurchasesOffering | null>(null);
  const [busy, setBusy] = useState(false);
  const [notice, setNotice] = useState<string | null>(null);
  const configured = isPurchasesConfigured();

  useEffect(() => {
    getProOffering().then(setOffering);
  }, []);

  const finishAsPro = () => {
    queryClient.invalidateQueries({ queryKey: ['billing'] });
    router.back();
  };

  const handlePurchase = async (pkg: PurchasesPackage | null | undefined) => {
    if (!configured || !pkg) return;
    setBusy(true);
    setNotice(null);
    const result = await purchaseProPackage(pkg);
    setBusy(false);
    if (result.hasPro) {
      finishAsPro();
    } else if (!result.cancelled) {
      setNotice('Purchase did not complete. Please try again.');
    }
  };

  const handleRestore = async () => {
    setBusy(true);
    setNotice(null);
    const result = await restorePurchases();
    setBusy(false);
    if (result.hasPro) {
      finishAsPro();
    } else {
      setNotice('No previous purchase found.');
    }
  };

  const handleMockUpgrade = async () => {
    setBusy(true);
    setNotice(null);
    try {
      await mockUpgrade();
      finishAsPro();
    } catch (e) {
      setNotice(e instanceof Error ? e.message : String(e));
    } finally {
      setBusy(false);
    }
  };

  const monthlyPrice = offering?.monthly?.product?.priceString ?? PRO_PRICES_FALLBACK.monthly;
  const annualPrice = offering?.annual?.product?.priceString ?? PRO_PRICES_FALLBACK.annual;

  return (
    <Screen>
      <ScrollView contentContainerStyle={{ padding: 24, gap: 16 }}>
        <View className="flex-row">
          <Button variant="secondary" label="Close" onPress={() => router.back()} />
        </View>

        <View className="flex-row items-center gap-2">
          <Typography variant="headlineMd">Precision Kitchen</Typography>
          <Chip label="PRO" tone="tertiarySoft" />
        </View>

        <View className="gap-2">
          {PRO_BENEFITS.map((b) => (
            <View key={b} className="flex-row items-center gap-2">
              <Typography variant="bodyLg">•</Typography>
              <Typography variant="bodyLg">{b}</Typography>
            </View>
          ))}
        </View>

        <View className="gap-3">
          <View className="rounded-xl border border-outline-variant p-4">
            <Typography variant="labelCaps" className="text-on-surface-variant">
              Monthly
            </Typography>
            <Typography variant="headlineMd">{monthlyPrice}</Typography>
            <Button
              variant="cta"
              label={busy ? 'Processing...' : 'Subscribe monthly'}
              disabled={busy || !configured}
              onPress={() => handlePurchase(offering?.monthly)}
              className="mt-2"
            />
          </View>

          <View className="rounded-xl border border-outline-variant p-4">
            <Typography variant="labelCaps" className="text-on-surface-variant">
              Annual
            </Typography>
            <Typography variant="headlineMd">{annualPrice}</Typography>
            <Button
              variant="cta"
              label={busy ? 'Processing...' : 'Subscribe annual'}
              disabled={busy || !configured}
              onPress={() => handlePurchase(offering?.annual)}
              className="mt-2"
            />
          </View>
        </View>

        {!configured && (
          <Typography variant="bodyMd" className="text-on-surface-variant">
            Purchases unavailable in this build (store setup pending).
          </Typography>
        )}

        <Button
          variant="secondary"
          label="Restore purchases"
          disabled={busy}
          onPress={handleRestore}
        />

        {__DEV__ && (
          <Button
            variant="secondary"
            label="Mock upgrade (dev)"
            disabled={busy}
            onPress={handleMockUpgrade}
          />
        )}

        {notice && (
          <Typography variant="bodyMd" className="text-on-surface-variant">
            {notice}
          </Typography>
        )}
      </ScrollView>
    </Screen>
  );
}

import { Ionicons } from "@expo/vector-icons";
import { router } from "expo-router";
import { useEffect, useMemo, useState } from "react";
import { Alert, Linking, Platform, Pressable, Share, Text, View } from "react-native";
import { AppButton } from "@/components/AppButton";
import { EmptyState } from "@/components/EmptyState";
import { Screen } from "@/components/Screen";
import { SectionCard } from "@/components/SectionCard";
import { StatCard } from "@/components/StatCard";
import { colors } from "@/constants/colors";
import { buildOwnerExport, ExportRangeKey, OwnerExportReport } from "@/lib/ownerExport";

const RANGE_OPTIONS: { key: ExportRangeKey; title: string; subtitle: string }[] = [
  { key: "today", title: "Today", subtitle: "Daily closing" },
  { key: "week", title: "7 Days", subtitle: "Recent clinic work" },
  { key: "month", title: "Month", subtitle: "Current month" },
  { key: "all", title: "All", subtitle: "All available rows" },
];

function money(value?: number) {
  return `₹${Math.round(Number(value || 0)).toLocaleString("en-IN")}`;
}

function errorMessage(error: unknown) {
  if (error instanceof Error) return error.message;
  if (typeof error === "string") return error;
  if (typeof error === "object" && error && "message" in error) {
    return String((error as { message?: unknown }).message);
  }
  return "Please try again.";
}

function canDownloadExcelOnWeb() {
  const globalAny = globalThis as any;
  return Platform.OS === "web" && Boolean(globalAny.document && globalAny.Blob && globalAny.URL);
}

function downloadExcelOnWeb(report: OwnerExportReport) {
  const globalAny = globalThis as any;
  const blob = new globalAny.Blob([report.excelHtml], {
    type: "application/vnd.ms-excel;charset=utf-8;",
  });
  const url = globalAny.URL.createObjectURL(blob);
  const anchor = globalAny.document.createElement("a");

  anchor.href = url;
  anchor.download = report.excelFileName;
  anchor.style.display = "none";
  globalAny.document.body.appendChild(anchor);
  anchor.click();
  globalAny.document.body.removeChild(anchor);
  globalAny.URL.revokeObjectURL(url);
}

export default function OwnerExportScreen() {
  const [range, setRange] = useState<ExportRangeKey>("today");
  const [report, setReport] = useState<OwnerExportReport | null>(null);
  const [loading, setLoading] = useState(true);
  const [sharing, setSharing] = useState(false);
  const [downloadingExcel, setDownloadingExcel] = useState(false);

  const preview = useMemo(() => {
    if (!report) return "";
    const lines = report.exportText.split("\n");
    return lines.slice(0, 260).join("\n");
  }, [report]);

  async function load(nextRange = range) {
    try {
      setLoading(true);
      const data = await buildOwnerExport(nextRange);
      setReport(data);
    } catch (error) {
      Alert.alert("Export load failed", errorMessage(error));
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    load(range);
  }, [range]);

  async function downloadExcelSheet() {
    if (!report) return;

    try {
      setDownloadingExcel(true);

      if (canDownloadExcelOnWeb()) {
        downloadExcelOnWeb(report);
        return;
      }

      await Share.share({
        title: report.excelFileName,
        message: report.exportText,
      });
      Alert.alert(
        "Excel download is web-ready",
        "On browser, this downloads an Excel-compatible .xls file. On Android app, shared text is used until native file sharing is added."
      );
    } catch (error) {
      Alert.alert("Excel export failed", errorMessage(error));
    } finally {
      setDownloadingExcel(false);
    }
  }

  async function shareExport() {
    if (!report) return;

    try {
      setSharing(true);
      await Share.share({
        title: report.title,
        message: report.exportText,
      });
    } catch (error) {
      try {
        const subject = encodeURIComponent(report.title);
        const body = encodeURIComponent(report.exportText.slice(0, 12000));
        await Linking.openURL(`mailto:?subject=${subject}&body=${body}`);
      } catch {
        Alert.alert("Share failed", errorMessage(error));
      }
    } finally {
      setSharing(false);
    }
  }

  return (
    <Screen refreshing={loading} onRefresh={() => load(range)}>
      <View style={{ gap: 6 }}>
        <Text style={{ color: colors.text, fontSize: 30, fontWeight: "900" }}>
          Owner Export
        </Text>
        <Text style={{ color: colors.muted, fontSize: 15, lineHeight: 21 }}>
          Human-readable clinic export for owner review. Internal database IDs are hidden.
        </Text>
      </View>

      <SectionCard title="Export Range" subtitle="Choose what owner wants to review or share.">
        <View style={{ flexDirection: "row", flexWrap: "wrap", gap: 10 }}>
          {RANGE_OPTIONS.map((item) => {
            const selected = range === item.key;
            return (
              <Pressable
                key={item.key}
                onPress={() => setRange(item.key)}
                style={{
                  width: "47%",
                  minHeight: 82,
                  borderRadius: 20,
                  padding: 12,
                  backgroundColor: selected ? colors.primary : colors.background,
                  borderWidth: 1,
                  borderColor: selected ? colors.primary : colors.border,
                  justifyContent: "space-between",
                }}
              >
                <Text style={{ color: selected ? colors.white : colors.text, fontSize: 17, fontWeight: "900" }}>
                  {item.title}
                </Text>
                <Text style={{ color: selected ? "rgba(255,255,255,0.78)" : colors.muted, fontWeight: "800" }}>
                  {item.subtitle}
                </Text>
              </Pressable>
            );
          })}
        </View>
      </SectionCard>

      {report ? (
        <>
          <View style={{ flexDirection: "row", flexWrap: "wrap", gap: 10 }}>
            <StatCard label="Patients" value={loading ? "..." : report.summary.patients} icon="people-outline" />
            <StatCard label="Visits" value={loading ? "..." : report.summary.visits} icon="clipboard-outline" />
            <StatCard label="Revenue" value={loading ? "..." : money(report.summary.revenue)} icon="cash-outline" tone="success" />
            <StatCard label="Pending" value={loading ? "..." : money(report.summary.pending)} icon="wallet-outline" tone="warning" />
          </View>

          <SectionCard title="Export Sections" subtitle={`Generated ${report.generatedAt} • ${report.rangeLabel}`}>
            <View style={{ gap: 10 }}>
              {report.sections.map((item) => (
                <View
                  key={item.title}
                  style={{
                    borderRadius: 18,
                    borderWidth: 1,
                    borderColor: colors.border,
                    backgroundColor: colors.background,
                    padding: 12,
                    flexDirection: "row",
                    alignItems: "center",
                    gap: 10,
                  }}
                >
                  <Ionicons name="document-text-outline" size={21} color={colors.primary} />
                  <Text style={{ flex: 1, color: colors.text, fontWeight: "900" }}>{item.title}</Text>
                  <Text style={{ color: colors.muted, fontWeight: "900" }}>{item.rowCount}</Text>
                </View>
              ))}
            </View>
          </SectionCard>

          <SectionCard title="Excel Sheet" subtitle="Downloads an Excel-compatible .xls file in web browser.">
            <AppButton
              title="Download Excel Sheet"
              icon="download-outline"
              onPress={downloadExcelSheet}
              loading={downloadingExcel || loading}
              loadingTitle="Preparing Excel..."
            />
            <Text selectable style={{ color: colors.muted, lineHeight: 20 }}>
              File: {report.excelFileName}
            </Text>
          </SectionCard>

          <SectionCard title="Share / Copy Export" subtitle="Use Share for WhatsApp/email, or long-press text to copy selected data.">
            <AppButton
              title="Share Export Text"
              icon="share-social-outline"
              onPress={shareExport}
              loading={sharing || loading}
              loadingTitle="Preparing export..."
            />
            <Text style={{ color: colors.muted, lineHeight: 20 }}>
              For very large exports, share may open only part of the text. The full preview below remains selectable.
            </Text>
          </SectionCard>

          <SectionCard title="CSV Preview" subtitle="Selectable owner-friendly CSV. No UUIDs or technical IDs shown.">
            <Text selectable style={{ color: colors.text, lineHeight: 20, fontSize: 12 }}>
              {preview}
              {preview !== report.exportText ? "\n\n...Preview shortened on screen. Use Share Export Text for full text." : ""}
            </Text>
          </SectionCard>
        </>
      ) : (
        <SectionCard>
          <EmptyState title="No export loaded" message="Pull down to refresh and generate export." icon="document-text-outline" />
        </SectionCard>
      )}

      <View style={{ flexDirection: "row", gap: 10 }}>
        <AppButton title="Refresh" icon="refresh-outline" variant="secondary" onPress={() => load(range)} loading={loading} style={{ flex: 1 }} />
        <AppButton title="Back to Report" icon="arrow-back-outline" variant="ghost" onPress={() => router.replace("/reports/clinic" as never)} style={{ flex: 1 }} />
      </View>
    </Screen>
  );
}

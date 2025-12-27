import { useState } from "react";
import { format } from "date-fns";
import { toast } from "sonner";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import {
  Download,
  FileText,
  FileSpreadsheet,
  Share2,
  Loader2,
} from "lucide-react";
import {
  exportDailyStatsToCSV,
  exportSummaryReportWithChartsToPDF,
  shareReport,
  generateShareableText,
  isShareSupported,
  isFileShareSupported,
  generateSummaryReportPDFWithCharts,
  createShareablePDFFile,
  type DailyStatsExport,
  type SummaryStatsExport,
} from "@/lib/export";

interface StatsExportDialogProps {
  dailyStats: DailyStatsExport[];
  summary: SummaryStatsExport;
  periodType: "week" | "month";
  periodLabel: string;
  trigger?: React.ReactNode;
}

export function StatsExportDialog({
  dailyStats,
  summary,
  periodType,
  periodLabel,
  trigger,
}: StatsExportDialogProps) {
  const [isExporting, setIsExporting] = useState<string | null>(null);
  const [isOpen, setIsOpen] = useState(false);

  const handleExportCSV = async () => {
    setIsExporting("csv");
    try {
      const filename = `pumping-stats-${periodType}-${format(new Date(), "yyyy-MM-dd")}.csv`;
      exportDailyStatsToCSV(dailyStats, filename);
      toast.success("CSV berhasil diunduh", {
        description: filename,
      });
      setIsOpen(false);
    } catch (error) {
      console.error("Failed to export CSV:", error);
      toast.error("Gagal mengunduh CSV");
    } finally {
      setIsExporting(null);
    }
  };

  const handleExportPDF = async () => {
    setIsExporting("pdf");
    try {
      const filename = `pumping-${periodType}-report-${format(new Date(), "yyyy-MM-dd")}.pdf`;
      await exportSummaryReportWithChartsToPDF(dailyStats, summary, periodType, filename);
      toast.success("PDF dengan grafik berhasil diunduh", {
        description: filename,
      });
      setIsOpen(false);
    } catch (error) {
      console.error("Failed to export PDF:", error);
      toast.error("Gagal mengunduh PDF");
    } finally {
      setIsExporting(null);
    }
  };

  const handleShare = async () => {
    if (!isShareSupported()) {
      toast.error("Fitur berbagi tidak didukung di browser ini");
      return;
    }

    setIsExporting("share");
    try {
      if (isFileShareSupported()) {
        // Try to share PDF file with charts
        const doc = await generateSummaryReportPDFWithCharts(dailyStats, summary, periodType);
        const filename = `pumping-${periodType}-report-${format(new Date(), "yyyy-MM-dd")}.pdf`;
        const file = await createShareablePDFFile(doc, filename);

        const shared = await shareReport(
          `Laporan Pumping ${periodLabel}`,
          generateShareableText(summary, periodLabel),
          undefined,
          [file]
        );

        if (shared) {
          toast.success("Berhasil dibagikan");
          setIsOpen(false);
        }
      } else {
        // Fallback to text sharing
        const shared = await shareReport(
          `Laporan Pumping ${periodLabel}`,
          generateShareableText(summary, periodLabel)
        );

        if (shared) {
          toast.success("Berhasil dibagikan");
          setIsOpen(false);
        }
      }
    } catch (error) {
      console.error("Failed to share:", error);
      toast.error("Gagal membagikan laporan");
    } finally {
      setIsExporting(null);
    }
  };

  return (
    <Dialog open={isOpen} onOpenChange={setIsOpen}>
      <DialogTrigger asChild>
        {trigger || (
          <Button variant="outline" size="sm">
            <Download className="h-4 w-4 mr-2" />
            Ekspor Laporan
          </Button>
        )}
      </DialogTrigger>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>Ekspor Laporan {periodLabel}</DialogTitle>
          <DialogDescription>
            Bagikan laporan dengan dokter atau konsultan laktasi
          </DialogDescription>
        </DialogHeader>
        <div className="grid gap-3 py-4">
          {/* CSV Export */}
          <Card
            className="cursor-pointer hover:bg-accent transition-colors"
            onClick={() => void handleExportCSV()}
          >
            <CardContent className="flex items-center gap-4 py-3">
              <div className="h-10 w-10 rounded-full bg-green-100 dark:bg-green-900 flex items-center justify-center">
                <FileSpreadsheet className="h-5 w-5 text-green-600 dark:text-green-400" />
              </div>
              <div className="flex-1">
                <p className="font-medium">Ekspor CSV</p>
                <p className="text-sm text-muted-foreground">
                  Data harian untuk spreadsheet
                </p>
              </div>
              {isExporting === "csv" ? (
                <Loader2 className="h-5 w-5 animate-spin" />
              ) : (
                <Download className="h-5 w-5 text-muted-foreground" />
              )}
            </CardContent>
          </Card>

          {/* PDF Export */}
          <Card
            className="cursor-pointer hover:bg-accent transition-colors"
            onClick={() => void handleExportPDF()}
          >
            <CardContent className="flex items-center gap-4 py-3">
              <div className="h-10 w-10 rounded-full bg-red-100 dark:bg-red-900 flex items-center justify-center">
                <FileText className="h-5 w-5 text-red-600 dark:text-red-400" />
              </div>
              <div className="flex-1">
                <p className="font-medium">Ekspor PDF dengan Grafik</p>
                <p className="text-sm text-muted-foreground">
                  Laporan lengkap dengan grafik untuk dokter
                </p>
              </div>
              {isExporting === "pdf" ? (
                <Loader2 className="h-5 w-5 animate-spin" />
              ) : (
                <Download className="h-5 w-5 text-muted-foreground" />
              )}
            </CardContent>
          </Card>

          {/* Share */}
          {isShareSupported() && (
            <Card
              className="cursor-pointer hover:bg-accent transition-colors"
              onClick={() => void handleShare()}
            >
              <CardContent className="flex items-center gap-4 py-3">
                <div className="h-10 w-10 rounded-full bg-blue-100 dark:bg-blue-900 flex items-center justify-center">
                  <Share2 className="h-5 w-5 text-blue-600 dark:text-blue-400" />
                </div>
                <div className="flex-1">
                  <p className="font-medium">Bagikan Langsung</p>
                  <p className="text-sm text-muted-foreground">
                    Kirim via WhatsApp, Email, dll
                  </p>
                </div>
                {isExporting === "share" ? (
                  <Loader2 className="h-5 w-5 animate-spin" />
                ) : (
                  <Share2 className="h-5 w-5 text-muted-foreground" />
                )}
              </CardContent>
            </Card>
          )}
        </div>
      </DialogContent>
    </Dialog>
  );
}

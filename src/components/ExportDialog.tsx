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
  Printer,
  Loader2,
} from "lucide-react";
import {
  exportSessionsToCSV,
  exportSessionsToPDF,
  shareReport,
  generateShareableText,
  isShareSupported,
  isFileShareSupported,
  generateSessionsPDF,
  createShareablePDFFile,
  type SessionExport,
  type SummaryStatsExport,
} from "@/lib/export";

interface ExportDialogProps {
  sessions: SessionExport[];
  summary?: SummaryStatsExport;
  dateRange?: { start: Date; end: Date };
  periodLabel?: string;
  trigger?: React.ReactNode;
}

export function ExportDialog({
  sessions,
  summary,
  dateRange,
  periodLabel = "All Sessions",
  trigger,
}: ExportDialogProps) {
  const [isExporting, setIsExporting] = useState<string | null>(null);
  const [isOpen, setIsOpen] = useState(false);

  const handleExportCSV = async () => {
    setIsExporting("csv");
    try {
      const filename = `pumping-sessions-${format(new Date(), "yyyy-MM-dd")}.csv`;
      exportSessionsToCSV(sessions, filename);
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
      const title = `Laporan Sesi Pumping - ${periodLabel}`;
      const filename = `pumping-sessions-${format(new Date(), "yyyy-MM-dd")}.pdf`;
      exportSessionsToPDF(sessions, title, dateRange, filename);
      toast.success("PDF berhasil diunduh", {
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
      if (isFileShareSupported() && summary) {
        // Try to share PDF file
        const doc = generateSessionsPDF(
          sessions,
          `Laporan Sesi Pumping - ${periodLabel}`,
          dateRange
        );
        const filename = `pumping-report-${format(new Date(), "yyyy-MM-dd")}.pdf`;
        const file = await createShareablePDFFile(doc, filename);

        const shared = await shareReport(
          "Laporan Pumping",
          generateShareableText(summary, periodLabel),
          undefined,
          [file]
        );

        if (shared) {
          toast.success("Berhasil dibagikan");
          setIsOpen(false);
        }
      } else if (summary) {
        // Fallback to text sharing
        const shared = await shareReport(
          "Laporan Pumping",
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

  const handlePrint = () => {
    window.print();
    setIsOpen(false);
  };

  return (
    <Dialog open={isOpen} onOpenChange={setIsOpen}>
      <DialogTrigger asChild>
        {trigger || (
          <Button variant="outline" size="sm">
            <Download className="h-4 w-4 mr-2" />
            Ekspor
          </Button>
        )}
      </DialogTrigger>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>Ekspor Data</DialogTitle>
          <DialogDescription>
            Pilih format ekspor untuk {sessions.length} sesi
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
                  Untuk spreadsheet (Excel, Google Sheets)
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
                <p className="font-medium">Ekspor PDF</p>
                <p className="text-sm text-muted-foreground">
                  Laporan untuk dokter/konsultan laktasi
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
          {isShareSupported() && summary && (
            <Card
              className="cursor-pointer hover:bg-accent transition-colors"
              onClick={() => void handleShare()}
            >
              <CardContent className="flex items-center gap-4 py-3">
                <div className="h-10 w-10 rounded-full bg-blue-100 dark:bg-blue-900 flex items-center justify-center">
                  <Share2 className="h-5 w-5 text-blue-600 dark:text-blue-400" />
                </div>
                <div className="flex-1">
                  <p className="font-medium">Bagikan</p>
                  <p className="text-sm text-muted-foreground">
                    Kirim ke WhatsApp, Email, dll
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

          {/* Print */}
          <Card
            className="cursor-pointer hover:bg-accent transition-colors"
            onClick={handlePrint}
          >
            <CardContent className="flex items-center gap-4 py-3">
              <div className="h-10 w-10 rounded-full bg-purple-100 dark:bg-purple-900 flex items-center justify-center">
                <Printer className="h-5 w-5 text-purple-600 dark:text-purple-400" />
              </div>
              <div className="flex-1">
                <p className="font-medium">Cetak</p>
                <p className="text-sm text-muted-foreground">
                  Cetak halaman ini
                </p>
              </div>
              <Printer className="h-5 w-5 text-muted-foreground" />
            </CardContent>
          </Card>
        </div>
      </DialogContent>
    </Dialog>
  );
}

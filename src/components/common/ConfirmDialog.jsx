/**
 * Reusable confirmation dialog with record name display.
 * Usage: <ConfirmDialog open={open} onConfirm={fn} onCancel={fn} title="..." description="..." confirmLabel="Delete" variant="destructive" />
 */
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { AlertTriangle } from "lucide-react";

export default function ConfirmDialog({ open, onConfirm, onCancel, title, description, confirmLabel = "Delete", variant = "destructive", confirmVariant, loading = false }) {
  const btnVariant = confirmVariant || (variant === "destructive" ? "destructive" : "default");
  return (
    <Dialog open={open} onOpenChange={v => !v && onCancel()}>
      <DialogContent className="max-w-sm">
        <DialogHeader>
          <div className="flex items-center gap-3 mb-1">
            <div className={`w-9 h-9 rounded-full flex items-center justify-center flex-shrink-0 ${btnVariant === "destructive" ? "bg-red-50" : "bg-emerald-50"}`}>
              <AlertTriangle className={`w-4 h-4 ${btnVariant === "destructive" ? "text-red-500" : "text-emerald-500"}`} />
            </div>
            <DialogTitle className="text-base">{title}</DialogTitle>
          </div>
        </DialogHeader>
        {description && <p className="text-sm text-gray-500 mt-1 ml-12">{description}</p>}
        <DialogFooter className="mt-4 gap-2">
          <Button variant="outline" onClick={onCancel} disabled={loading}>Cancel</Button>
          <Button variant={btnVariant} onClick={onConfirm} disabled={loading}>
            {confirmLabel}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}